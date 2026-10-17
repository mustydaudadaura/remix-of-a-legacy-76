/**
 * Nigerian Dedicated Student Virtual Account Engine (NUBAN & Central Bank of Nigeria Standard)
 * Generates and validates dedicated 10-digit virtual accounts for automated bank transfer fee clearing.
 */

export interface NigerianBankPartner {
  code: string;
  name: string;
  shortName: string;
  prefix: string;
}

export const SUPPORTED_VIRTUAL_BANKS: NigerianBankPartner[] = [
  { code: "035", name: "Wema Bank / ALAT", shortName: "Wema Bank", prefix: "99" },
  { code: "101", name: "Providus Bank", shortName: "Providus Bank", prefix: "88" },
  { code: "232", name: "Sterling Bank", shortName: "Sterling", prefix: "77" },
  { code: "50211", name: "Kuda Microfinance Bank", shortName: "Kuda Bank", prefix: "66" },
  { code: "50515", name: "Moniepoint MFB", shortName: "Moniepoint", prefix: "55" },
];

export interface StudentVirtualAccount {
  accountNumber: string; // 10-digit NUBAN
  accountName: string;   // e.g. "BSS / AISHA DAUDA"
  bankName: string;
  bankCode: string;
  studentId: string;
  admissionNo: string;
  paymentReference: string; // e.g. "VA-BSS-2026-0042"
  status: "active" | "dormant";
  settlementType: "instant_clearing";
  schoolCode: string;
}

/**
 * Deterministically generates a stable 10-digit NUBAN virtual account for a student.
 * Uses the student's unique admission number and school code so the student keeps
 * the exact same virtual account number across terms and sessions.
 */
export function generateStudentVirtualAccount(params: {
  schoolCode?: string | null;
  schoolName?: string | null;
  studentId: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  bankIndex?: number;
}): StudentVirtualAccount {
  const schoolCode = (params.schoolCode || "SCH").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const adm = params.admissionNo.toUpperCase().trim();
  const bank = SUPPORTED_VIRTUAL_BANKS[(params.bankIndex ?? 0) % SUPPORTED_VIRTUAL_BANKS.length];

  // Hash or combine the input to get a stable 8-digit suffix
  const combined = `${schoolCode}:${adm}:${params.studentId}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }

  // Ensure positive number and pad to 8 digits
  const absHash = Math.abs(hash);
  const hashSuffix = (absHash % 100000000).toString().padStart(8, "0");

  // 10-digit NUBAN = 2-digit bank prefix + 8-digit deterministic hash
  const accountNumber = `${bank.prefix}${hashSuffix}`;

  const cleanFirstName = params.firstName.trim().toUpperCase();
  const cleanLastName = params.lastName.trim().toUpperCase();
  const schoolAbbr = schoolCode.length > 5 ? schoolCode.slice(0, 5) : schoolCode;
  const accountName = `${schoolAbbr} / ${cleanFirstName} ${cleanLastName}`.slice(0, 40);

  // Serial numeric part for payment reference
  const serialNo = (absHash % 10000).toString().padStart(4, "0");
  const paymentReference = `VA-${schoolAbbr}-${serialNo}`;

  return {
    accountNumber,
    accountName,
    bankName: bank.name,
    bankCode: bank.code,
    studentId: params.studentId,
    admissionNo: params.admissionNo,
    paymentReference,
    status: "active",
    settlementType: "instant_clearing",
    schoolCode,
  };
}

/**
 * Validates whether a given account number meets the Nigerian 10-digit NUBAN format.
 */
export function isValidNubanAccountNumber(acc: string): boolean {
  const clean = acc.replace(/\D/g, "");
  return clean.length === 10;
}

/**
 * Formats a 10-digit account number with standard Nigerian readability spaces (e.g. 9923 847 102).
 */
export function formatNubanDisplay(acc: string): string {
  const clean = acc.replace(/\D/g, "");
  if (clean.length !== 10) return acc;
  return `${clean.slice(0, 4)} ${clean.slice(4, 7)} ${clean.slice(7)}`;
}

/**
 * Simulated incoming bank transfer transaction payload
 * representing an instant NIP (NIBSS Instant Payment) to a dedicated virtual account.
 */
export interface VirtualAccountWebhookPayload {
  event: "charge.success" | "transfer.completed" | "payment.received";
  transaction_reference: string;
  account_number: string;
  amount: number;
  payer_name?: string;
  payer_bank?: string;
  payment_date?: string;
  narration?: string;
  channel?: "instant_bank_transfer" | "nip" | "card";
  currency?: string;
}

/**
 * Normalizes incoming webhook transaction references.
 */
export function generateTransactionReference(prefix: string = "TX-NUBAN"): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${dateStr}-${randomStr}`;
}
