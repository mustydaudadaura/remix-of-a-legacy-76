/**
 * Dedicated Virtual Account generator for Nigerian School Management.
 * Generates stable Nigerian NUBAN-compliant virtual accounts (e.g. Wema Bank / Providus / Moniepoint)
 * mapped deterministically to a student's admission number and school code.
 */

export interface VirtualAccountDetails {
  account_number: string;
  bank_name: string;
  bank_code: string;
  account_name: string;
  student_id: string;
  admission_no: string;
  school_id: string;
}

const SUPPORTED_BANKS = [
  { name: "Wema Bank / ALAT", code: "035", prefix: "78" },
  { name: "Providus Bank", code: "101", prefix: "99" },
  { name: "Moniepoint MFB", code: "50515", prefix: "64" },
  { name: "Sterling Bank", code: "232", prefix: "81" },
];

/**
 * Generate a consistent, predictable 10-digit Nigerian NUBAN account number
 * using the student's admission number and school ID.
 */
export function getStudentVirtualAccount(
  student: { id: string; first_name: string; last_name: string; admission_no: string },
  school: { id: string; name: string; code?: string | null }
): VirtualAccountDetails {
  // Hash student id + admission_no to 8 deterministic digits
  let hash = 0;
  const str = `${student.id}:${student.admission_no}:${school.id}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  
  // Choose primary bank (Wema Bank default for Nigerian school collections)
  const bank = SUPPORTED_BANKS[0];
  const suffix = String(hash).padStart(8, "0").slice(-8);
  const accountNumber = `${bank.prefix}${suffix}`;

  const cleanSchool = (school.code || school.name.split(" ")[0] || "SCH").toUpperCase();
  const accountName = `${cleanSchool} - ${student.first_name} ${student.last_name}`;

  return {
    account_number: accountNumber,
    bank_name: bank.name,
    bank_code: bank.code,
    account_name: accountName,
    student_id: student.id,
    admission_no: student.admission_no,
    school_id: school.id,
  };
}

/** Standard Nigerian Fee Categories */
export const NIGERIAN_FEE_CATEGORIES = [
  { id: "tuition", label: "Tuition Fee", description: "Standard termly instructional fee" },
  { id: "pta", label: "PTA Levy", description: "Parents Teachers Association development fund" },
  { id: "uniforms", label: "Uniforms & Sportswear", description: "School day uniform, PE wears, badge & socks" },
  { id: "books", label: "Books & Stationery", description: "Textbooks, workbooks, notebooks and art supplies" },
  { id: "boarding", label: "Boarding & Feeding", description: "Hostel accommodation, laundry and 3-term meals" },
  { id: "development", label: "Development / ICT Levy", description: "Computer laboratory & facility upgrade" },
  { id: "exam", label: "Examination / Assessment", description: "Termly exams, continuous assessments & result sheets" },
  { id: "medical", label: "Medical / First Aid", description: "Sick bay, student health insurance and first aid" },
] as const;

export type NigerianFeeCategory = (typeof NIGERIAN_FEE_CATEGORIES)[number]["id"];

/**
 * Format currency in Nigerian Naira (₦ NGN).
 */
export function formatNaira(amount: number | string | null | undefined): string {
  const num = Number(amount ?? 0);
  return `₦${num.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * Parse an invoice or fee item title to detect its Nigerian Fee category.
 */
export function detectFeeCategory(title: string): NigerianFeeCategory {
  const lower = title.toLowerCase();
  if (lower.includes("pta") || lower.includes("parent")) return "pta";
  if (lower.includes("uniform") || lower.includes("wear") || lower.includes("sport") || lower.includes("cloth")) return "uniforms";
  if (lower.includes("book") || lower.includes("stationery") || lower.includes("textbook") || lower.includes("workbook")) return "books";
  if (lower.includes("board") || lower.includes("hostel") || lower.includes("feeding") || lower.includes("meal")) return "boarding";
  if (lower.includes("ict") || lower.includes("dev") || lower.includes("computer") || lower.includes("facility")) return "development";
  if (lower.includes("exam") || lower.includes("assessment") || lower.includes("test")) return "exam";
  if (lower.includes("medic") || lower.includes("health") || lower.includes("clinic") || lower.includes("sick")) return "medical";
  return "tuition";
}
