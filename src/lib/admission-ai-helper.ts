import * as XLSX from "xlsx";

export type GenderType = "male" | "female";
export type RelationshipType = "father" | "mother" | "guardian" | "sponsor";

export interface ExtractedAdmissionStudent {
  id: string; // Internal temporary UUID
  first_name: string;
  middle_name?: string;
  last_name: string;
  gender?: GenderType;
  dob?: string; // YYYY-MM-DD
  admission_no?: string;
  class_applied_id?: string;
  class_name?: string;
  academic_session?: string;
  previous_school?: string;
  state_of_origin?: string;
  residential_address?: string;

  // Guardian details
  parent_name?: string;
  father_name?: string;
  mother_name?: string;
  parent_phone?: string;
  parent_email?: string;
  relationship: RelationshipType;

  // Passport photo
  passport_url?: string;
  passport_data?: string; // base64 preview

  // Confidence & Verification
  confidence: number; // 0.0 - 1.0
  review_flags: string[]; // e.g. ["Uncertain DOB", "Missing phone", "Unreadable text"]
  source_page?: number;
  source_row?: number;
  source_snippet?: string;
  is_selected?: boolean;
  status: "ready" | "needs_review" | "duplicate" | "saved" | "error";
  duplicate_info?: {
    match_type: "admission_no" | "exact_name" | "phone_match" | "possible_name";
    record_type: "student" | "admission";
    existing_id: string;
    existing_identifier: string;
    existing_name: string;
    similarity: number;
  };
}

export interface DuplicateRecordCandidate {
  id: string;
  type: "student" | "admission";
  identifier: string; // admission_no or application_no
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  parent_phone?: string | null;
  dob?: string | null;
}

/**
 * Normalizes Nigerian phone numbers while strictly preserving leading zeros as text.
 * Examples:
 *   "0803 123 4567" -> "08031234567"
 *   "+234 803 123 4567" -> "08031234567"
 *   "2348031234567" -> "08031234567"
 *   "080-312-34567" -> "08031234567"
 */
export function normalizeNigerianPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";

  // If starts with 234 and is 13 digits, convert to 11 digits with 0
  if (digits.startsWith("234") && digits.length === 13) {
    digits = "0" + digits.slice(3);
  } else if (digits.length === 10 && !digits.startsWith("0")) {
    digits = "0" + digits;
  }
  return digits;
}

/**
 * Validates a Nigerian phone number format.
 */
export function isValidNigerianPhone(phone: string): boolean {
  const norm = normalizeNigerianPhone(phone);
  if (!norm) return false;
  // Nigerian mobile numbers are 11 digits starting with 070, 080, 081, 090, 091, 071, 01, etc.
  return /^0[789][01]\d{8}$/.test(norm) || (norm.length === 11 && norm.startsWith("0"));
}

/**
 * Normalizes a name string for duplicate comparison (lowercase, trimmed, strip punct).
 */
export function normalizeName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Simple token-based name matching score (0.0 to 1.0)
 */
export function computeNameSimilarity(nameA: string, nameB: string): number {
  const a = normalizeName(nameA);
  const b = normalizeName(nameB);
  if (!a || !b) return 0;
  if (a === b) return 1.0;

  const tokensA = new Set(a.split(" ").filter(Boolean));
  const tokensB = new Set(b.split(" ").filter(Boolean));
  if (!tokensA.size || !tokensB.size) return 0;

  let common = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) common++;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return common / union;
}

/**
 * Validate a student record before saving to database.
 */
export function validateAdmissionStudent(student: Partial<ExtractedAdmissionStudent>): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const firstName = student.first_name?.trim();
  const lastName = student.last_name?.trim();

  if (!firstName || firstName.length < 2) {
    errors.push("First name is required (minimum 2 characters).");
  }

  if (!lastName || lastName.length < 2) {
    errors.push("Last name / surname is required (minimum 2 characters).");
  }

  if (student.gender && !["male", "female"].includes(student.gender)) {
    warnings.push("Gender should be 'male' or 'female'.");
  }

  if (student.dob) {
    const d = new Date(student.dob);
    if (isNaN(d.getTime())) {
      errors.push("Date of birth format is invalid.");
    } else {
      const now = new Date();
      if (d > now) {
        errors.push("Date of birth cannot be in the future.");
      }
      const age = now.getFullYear() - d.getFullYear();
      if (age < 1 || age > 35) {
        warnings.push(`Student age (${age} years) seems unusual. Please verify.`);
      }
    }
  }

  if (student.parent_phone) {
    const norm = normalizeNigerianPhone(student.parent_phone);
    if (!norm) {
      warnings.push("Parent phone number could not be recognized.");
    } else if (norm.length !== 11) {
      warnings.push(`Parent phone number has ${norm.length} digits (expected 11 for Nigeria).`);
    }
  } else {
    warnings.push("Parent phone number is missing.");
  }

  if (student.parent_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.parent_email)) {
    errors.push("Parent email address is invalid.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Detect possible duplicates against existing student and admission records.
 */
export function findDuplicateRecord(
  extracted: ExtractedAdmissionStudent,
  existingList: DuplicateRecordCandidate[]
): ExtractedAdmissionStudent["duplicate_info"] | undefined {
  const extractedFullName = `${extracted.first_name} ${extracted.last_name}`.trim();
  const extractedPhone = normalizeNigerianPhone(extracted.parent_phone);
  const extractedAdmNo = extracted.admission_no?.trim().toUpperCase();

  for (const candidate of existingList) {
    // 1. Exact Admission Number Match
    if (
      extractedAdmNo &&
      candidate.identifier &&
      candidate.identifier.trim().toUpperCase() === extractedAdmNo
    ) {
      return {
        match_type: "admission_no",
        record_type: candidate.type,
        existing_id: candidate.id,
        existing_identifier: candidate.identifier,
        existing_name: `${candidate.first_name} ${candidate.last_name}`,
        similarity: 1.0,
      };
    }

    // 2. Exact Name Match
    const candidateFullName = `${candidate.first_name} ${candidate.last_name}`.trim();
    const similarity = computeNameSimilarity(extractedFullName, candidateFullName);

    if (similarity >= 1.0) {
      // If DOB also matches or is absent
      return {
        match_type: "exact_name",
        record_type: candidate.type,
        existing_id: candidate.id,
        existing_identifier: candidate.identifier,
        existing_name: candidateFullName,
        similarity,
      };
    }

    // 3. High name similarity (e.g. 0.8+)
    if (similarity >= 0.8) {
      return {
        match_type: "possible_name",
        record_type: candidate.type,
        existing_id: candidate.id,
        existing_identifier: candidate.identifier,
        existing_name: candidateFullName,
        similarity,
      };
    }

    // 4. Same parent phone + same surname (possible sibling or re-application)
    const candidatePhone = normalizeNigerianPhone(candidate.parent_phone);
    if (
      extractedPhone &&
      candidatePhone &&
      extractedPhone === candidatePhone &&
      normalizeName(extracted.last_name) === normalizeName(candidate.last_name)
    ) {
      return {
        match_type: "phone_match",
        record_type: candidate.type,
        existing_id: candidate.id,
        existing_identifier: candidate.identifier,
        existing_name: candidateFullName,
        similarity: 0.85,
      };
    }
  }

  return undefined;
}

/**
 * Generate an Excel workbook and trigger download preserving phone numbers as text.
 */
export function exportAdmissionBatchToExcel(
  records: ExtractedAdmissionStudent[],
  filename: string = "Verified_Admissions_Export.xlsx"
) {
  const headers = [
    "S/N",
    "Application / Admission No",
    "First Name",
    "Middle Name",
    "Last Name / Surname",
    "Gender",
    "Date of Birth",
    "Class Applied",
    "Parent / Guardian Name",
    "Relationship",
    "Parent Phone",
    "Parent Email",
    "State of Origin",
    "Residential Address",
    "Previous School",
    "Academic Session",
    "Passport Photo Attached",
    "Confidence (%)",
    "Review Flags",
  ];

  const dataRows = records.map((r, index) => [
    index + 1,
    r.admission_no || `APP-PENDING-${index + 1}`,
    r.first_name || "",
    r.middle_name || "",
    r.last_name || "",
    r.gender || "",
    r.dob || "",
    r.class_name || "",
    r.parent_name || r.father_name || r.mother_name || "",
    r.relationship || "parent",
    // Prefix phone with tab or apostrophe to force Excel text format if needed, but in cell definition we mark as string
    r.parent_phone ? normalizeNigerianPhone(r.parent_phone) : "",
    r.parent_email || "",
    r.state_of_origin || "",
    r.residential_address || "",
    r.previous_school || "",
    r.academic_session || "2026/2027",
    r.passport_url || r.passport_data ? "Yes" : "No",
    Math.round((r.confidence || 0.9) * 100) + "%",
    (r.review_flags || []).join(", "),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

  // Set explicit cell types for phone numbers so Excel never strips leading zeros
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
  const phoneColIndex = 10; // "Parent Phone" is column 10 (0-indexed)
  for (let R = 1; R <= range.e.r; ++R) {
    const cellAddress = XLSX.utils.encode_cell({ r: R, c: phoneColIndex });
    if (ws[cellAddress]) {
      ws[cellAddress].t = "s"; // string type
    }
  }

  // Adjust column widths
  ws["!cols"] = [
    { wch: 6 }, // S/N
    { wch: 22 }, // App No
    { wch: 15 }, // First
    { wch: 15 }, // Middle
    { wch: 18 }, // Last
    { wch: 10 }, // Gender
    { wch: 14 }, // DOB
    { wch: 14 }, // Class
    { wch: 24 }, // Parent
    { wch: 14 }, // Rel
    { wch: 16 }, // Phone
    { wch: 22 }, // Email
    { wch: 16 }, // State
    { wch: 28 }, // Address
    { wch: 24 }, // Prev School
    { wch: 16 }, // Session
    { wch: 14 }, // Photo
    { wch: 14 }, // Confidence
    { wch: 28 }, // Flags
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Admissions");
  XLSX.writeFile(wb, filename);
}
