/**
 * Nigerian Standard Result Checker PIN & Scratch-Card System
 * Modeled after national WAEC, NECO, and BECE examination scratch cards.
 */

export interface ResultCheckerPin {
  id: string;
  school_id: string;
  serial_no: string; // e.g. "EDU-2026-9A8B7C6D"
  pin: string; // 12-digit numeric PIN, formatted as "XXXX-XXXX-XXXX"
  session: string; // e.g. "2025/2026"
  term?: "first" | "second" | "third" | "all";
  student_id?: string | null;
  student_name?: string | null;
  student_admission_no?: string | null;
  class_id?: string | null;
  class_name?: string | null;
  max_uses: number; // default 5 checks allowed per card
  times_used: number;
  is_active: boolean;
  created_at: string;
  last_used_at?: string | null;
  unlocked_report_ids?: string[];
}

/**
 * Generate a cryptographically secure 12-digit PIN formatted as XXXX-XXXX-XXXX
 */
export function generateTwelveDigitPin(): string {
  // Generate 12 digits [0-9]
  let digits = "";
  for (let i = 0; i < 12; i++) {
    const digit = Math.floor(Math.random() * 10);
    digits += digit.toString();
  }
  // Format as 4-4-4
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}`;
}

/**
 * Generate a standard Nigerian serial number e.g. "EDU-2026-XXXX-XXXX"
 */
export function generateSerialNumber(prefix = "EDU", session = "2026"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // omits confusing O/0/1/I
  let suffix = "";
  for (let i = 0; i < 8; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${session.slice(0, 4)}-${suffix.slice(0, 4)}-${suffix.slice(4, 8)}`;
}

/**
 * Normalize PIN input by removing dashes, spaces, and formatting
 */
export function normalizePin(raw: string): string {
  return String(raw || "").replace(/[^0-9]/g, "");
}

/**
 * Normalize Serial Number input
 */
export function normalizeSerial(raw: string): string {
  return String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Validate PIN format (must be 12 digits)
 */
export function isValidPinFormat(raw: string): boolean {
  const norm = normalizePin(raw);
  return norm.length === 12 && /^\d{12}$/.test(norm);
}

/**
 * Validate a scratch card against a report card check request
 */
export function verifyScratchCardAccess(params: {
  card: ResultCheckerPin;
  pinEntered: string;
  serialEntered: string;
  studentId: string;
  reportCardId?: string;
  session?: string;
}): {
  allowed: boolean;
  error?: string;
  isAlreadyUnlocked: boolean;
  remainingUses: number;
} {
  const { card, pinEntered, serialEntered, studentId, reportCardId, session } = params;

  // 1. Check card active status
  if (!card.is_active) {
    return {
      allowed: false,
      error: "This scratch card has been deactivated or revoked by the school administration.",
      isAlreadyUnlocked: false,
      remainingUses: Math.max(0, card.max_uses - card.times_used),
    };
  }

  // 2. Verify Serial Number match
  const normEnteredSerial = normalizeSerial(serialEntered);
  const normCardSerial = normalizeSerial(card.serial_no);
  if (normEnteredSerial !== normCardSerial) {
    return {
      allowed: false,
      error: "Invalid Serial Number. Please verify the serial number printed on your scratch card.",
      isAlreadyUnlocked: false,
      remainingUses: Math.max(0, card.max_uses - card.times_used),
    };
  }

  // 3. Verify PIN match
  const normEnteredPin = normalizePin(pinEntered);
  const normCardPin = normalizePin(card.pin);
  if (normEnteredPin !== normCardPin) {
    return {
      allowed: false,
      error: "Invalid 12-digit PIN. Please carefully re-enter the scratched PIN code.",
      isAlreadyUnlocked: false,
      remainingUses: Math.max(0, card.max_uses - card.times_used),
    };
  }

  // 4. Session constraint (if specific session bound)
  if (session && card.session && card.session !== "all" && card.session !== session) {
    return {
      allowed: false,
      error: `This scratch card is valid only for the ${card.session} academic session.`,
      isAlreadyUnlocked: false,
      remainingUses: Math.max(0, card.max_uses - card.times_used),
    };
  }

  // 5. Student binding constraint
  // If card is already bound to a different student, prevent usage
  if (card.student_id && card.student_id !== studentId) {
    return {
      allowed: false,
      error: "This scratch card is already bound to another student record and cannot be reused for different students.",
      isAlreadyUnlocked: false,
      remainingUses: Math.max(0, card.max_uses - card.times_used),
    };
  }

  // 6. Check if this report card was already unlocked with this card
  const alreadyUnlocked = Boolean(
    reportCardId && Array.isArray(card.unlocked_report_ids) && card.unlocked_report_ids.includes(reportCardId)
  );

  // 7. Check usage count (if not already unlocked for this report card)
  if (!alreadyUnlocked && card.times_used >= card.max_uses) {
    return {
      allowed: false,
      error: `Scratch card exhausted. This card has reached its maximum allowance of ${card.max_uses} result checks. Please purchase a new card.`,
      isAlreadyUnlocked: false,
      remainingUses: 0,
    };
  }

  const remaining = alreadyUnlocked
    ? Math.max(0, card.max_uses - card.times_used)
    : Math.max(0, card.max_uses - (card.times_used + 1));

  return {
    allowed: true,
    isAlreadyUnlocked: alreadyUnlocked,
    remainingUses: remaining,
  };
}

/**
 * Generate a batch of scratch card PINs
 */
export function createPinBatch(params: {
  school_id: string;
  count: number;
  session: string;
  term?: "first" | "second" | "third" | "all";
  max_uses?: number;
  students?: Array<{ id: string; name: string; admission_no: string; class_id?: string; class_name?: string }>;
}): ResultCheckerPin[] {
  const { school_id, count, session, term = "all", max_uses = 5, students = [] } = params;
  const cards: ResultCheckerPin[] = [];
  const now = new Date().toISOString();

  const total = students.length > 0 ? students.length : count;

  for (let i = 0; i < total; i++) {
    const student = students[i];
    cards.push({
      id: `pin-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      school_id,
      serial_no: generateSerialNumber("EDU", session),
      pin: generateTwelveDigitPin(),
      session,
      term,
      student_id: student?.id || null,
      student_name: student?.name || null,
      student_admission_no: student?.admission_no || null,
      class_id: student?.class_id || null,
      class_name: student?.class_name || null,
      max_uses,
      times_used: 0,
      is_active: true,
      created_at: now,
      unlocked_report_ids: [],
    });
  }

  return cards;
}
