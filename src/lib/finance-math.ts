/** Money the school agreed not to collect: invoice total minus discount minus what has been paid. */
export function invoiceOutstanding(inv: {
  amount_due: number | string;
  discount_amount?: number | string | null;
  amount_paid: number | string;
}): number {
  return Number(inv.amount_due) - Number(inv.discount_amount ?? 0) - Number(inv.amount_paid);
}

/** How much of an invoice is still collectable after a proposed discount, so a waiver never erases a payment. */
export function maxDiscount(inv: {
  amount_due: number | string;
  amount_paid: number | string;
}): number {
  return Math.max(Number(inv.amount_due) - Number(inv.amount_paid), 0);
}

/** Percentage of net payable amount that has been paid (0 to 100). */
export function paymentProgressPercentage(inv: {
  amount_due: number | string;
  discount_amount?: number | string | null;
  amount_paid: number | string;
}): number {
  const netDue = Math.max(Number(inv.amount_due) - Number(inv.discount_amount ?? 0), 0);
  if (netDue <= 0) return 100;
  const paid = Math.max(Number(inv.amount_paid), 0);
  return Math.min(100, Math.round((paid / netDue) * 100));
}

/** Standard Nigerian School Fee Categories */
export const NIGERIAN_FEE_CATEGORIES = [
  { id: "tuition", label: "Tuition & Academic Instruction", shortLabel: "Tuition", icon: "GraduationCap" },
  { id: "pta", label: "PTA (Parent-Teacher Association) Levy", shortLabel: "PTA Levy", icon: "Users" },
  { id: "uniforms", label: "School Uniforms & Sportswear", shortLabel: "Uniforms", icon: "Shirt" },
  { id: "books", label: "Textbooks, Workbooks & Stationery", shortLabel: "Books & Materials", icon: "BookOpen" },
  { id: "boarding", label: "Boarding House & Hostel / Feeding", shortLabel: "Boarding / Hostel", icon: "Home" },
  { id: "development", label: "Development & Infrastructure Levy", shortLabel: "Development", icon: "Building" },
  { id: "ict", label: "ICT & Computer Laboratory Fee", shortLabel: "ICT / Lab", icon: "Laptop" },
  { id: "exam", label: "Examination & Assessment (BECE/WAEC/NECO)", shortLabel: "Exam Fees", icon: "FileText" },
] as const;

export type NigerianFeeCategoryId = (typeof NIGERIAN_FEE_CATEGORIES)[number]["id"];

export interface FeeBreakdownItem {
  category: NigerianFeeCategoryId;
  name: string;
  amount: number;
  mandatory?: boolean;
}

/** Standard default Nigerian fee breakdown distribution ratios for secondary & primary schools. */
export const DEFAULT_NIGERIAN_FEE_RATIOS: Record<NigerianFeeCategoryId, number> = {
  tuition: 0.55,    // 55% Tuition
  pta: 0.05,        // 5% PTA
  books: 0.15,      // 15% Books & Materials
  uniforms: 0.15,   // 15% Uniforms
  boarding: 0.00,   // Optional (0% for day school by default)
  development: 0.05,// 5% Development
  ict: 0.03,        // 3% ICT
  exam: 0.02,       // 2% Exam
};

/** Sum all amounts in an itemized breakdown. */
export function sumBreakdown(items: FeeBreakdownItem[]): number {
  return items.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
}

/**
 * Intelligent helper to extract or reconstruct Nigerian fee breakdown items.
 * If custom items are stored in title or metadata, parses them; otherwise
 * generates a structured breakdown for Tuition, PTA, Uniforms, Books, and Boarding.
 */
export function resolveFeeBreakdown(
  title: string,
  totalAmount: number,
  customBreakdown?: FeeBreakdownItem[] | null,
  isBoardingStudent: boolean = false
): FeeBreakdownItem[] {
  if (customBreakdown && Array.isArray(customBreakdown) && customBreakdown.length > 0) {
    return customBreakdown;
  }

  const amt = Math.max(Number(totalAmount) || 0, 0);
  const lower = title.toLowerCase();

  // If specific single item (e.g. "PTA Levy 2025/2026")
  if (lower.includes("pta")) {
    return [{ category: "pta", name: "PTA Levy", amount: amt, mandatory: true }];
  }
  if (lower.includes("uniform")) {
    return [{ category: "uniforms", name: "School Uniforms & Sportswear", amount: amt, mandatory: true }];
  }
  if (lower.includes("book")) {
    return [{ category: "books", name: "Textbooks & Stationery", amount: amt, mandatory: true }];
  }
  if (lower.includes("board") || lower.includes("hostel")) {
    return [{ category: "boarding", name: "Boarding & Feeding Levy", amount: amt, mandatory: true }];
  }

  // Comprehensive termly composite school fee bill:
  // Break down into Tuition, PTA, Uniforms, Books, and Boarding
  if (isBoardingStudent) {
    const boardingAmt = Math.round(amt * 0.35);
    const tuitionAmt = Math.round(amt * 0.35);
    const booksAmt = Math.round(amt * 0.12);
    const uniformsAmt = Math.round(amt * 0.10);
    const ptaAmt = Math.round(amt * 0.04);
    const devAmt = amt - (boardingAmt + tuitionAmt + booksAmt + uniformsAmt + ptaAmt);

    return [
      { category: "tuition", name: "Tuition & Academic Instruction", amount: tuitionAmt, mandatory: true },
      { category: "boarding", name: "Boarding House & Feeding", amount: boardingAmt, mandatory: true },
      { category: "books", name: "Textbooks, Workbooks & Materials", amount: booksAmt, mandatory: true },
      { category: "uniforms", name: "School Uniforms & Sportswear", amount: uniformsAmt, mandatory: true },
      { category: "pta", name: "PTA Levy", amount: ptaAmt, mandatory: true },
      { category: "development", name: "Development & Infrastructure", amount: Math.max(devAmt, 0), mandatory: false },
    ];
  }

  // Standard Day Student composite fee breakdown:
  // Tuition (60%), PTA (5%), Uniforms (15%), Books (15%), Development (5%)
  const tuitionAmt = Math.round(amt * 0.60);
  const booksAmt = Math.round(amt * 0.15);
  const uniformsAmt = Math.round(amt * 0.15);
  const ptaAmt = Math.round(amt * 0.05);
  const devAmt = amt - (tuitionAmt + booksAmt + uniformsAmt + ptaAmt);

  return [
    { category: "tuition", name: "Tuition & Academic Instruction", amount: tuitionAmt, mandatory: true },
    { category: "books", name: "Textbooks, Workbooks & Materials", amount: booksAmt, mandatory: true },
    { category: "uniforms", name: "School Uniforms & Sportswear", amount: uniformsAmt, mandatory: true },
    { category: "pta", name: "Parents-Teachers Association (PTA) Levy", amount: ptaAmt, mandatory: true },
    { category: "development", name: "Development & Maintenance", amount: Math.max(devAmt, 0), mandatory: false },
  ];
}

/**
 * Priority waterfall payment allocation across fee breakdown categories.
 * Standard Nigerian educational priority: Tuition -> PTA -> Books -> Uniforms -> Boarding -> Development.
 */
export function allocatePaymentToBreakdown(
  items: FeeBreakdownItem[],
  amountPaid: number
): Array<FeeBreakdownItem & { allocated: number; remaining: number }> {
  let funds = Math.max(Number(amountPaid) || 0, 0);

  return items.map((item) => {
    const itemAmt = Math.max(Number(item.amount) || 0, 0);
    const allocated = Math.min(funds, itemAmt);
    funds -= allocated;
    return {
      ...item,
      allocated,
      remaining: itemAmt - allocated,
    };
  });
}

/**
 * Computes aggregate collections, billed amounts, and balances grouped by Nigerian fee category.
 */
export function calculateCategoryTotals(
  invoices: Array<{
    title: string;
    amount_due: number | string;
    amount_paid: number | string;
    breakdown?: FeeBreakdownItem[] | null;
  }>
): Record<NigerianFeeCategoryId, { name: string; billed: number; collected: number; outstanding: number }> {
  const result: Record<NigerianFeeCategoryId, { name: string; billed: number; collected: number; outstanding: number }> = {
    tuition: { name: "Tuition & Instruction", billed: 0, collected: 0, outstanding: 0 },
    pta: { name: "PTA Levy", billed: 0, collected: 0, outstanding: 0 },
    uniforms: { name: "Uniforms & Sportswear", billed: 0, collected: 0, outstanding: 0 },
    books: { name: "Books & Materials", billed: 0, collected: 0, outstanding: 0 },
    boarding: { name: "Boarding & Hostel", billed: 0, collected: 0, outstanding: 0 },
    development: { name: "Development Levy", billed: 0, collected: 0, outstanding: 0 },
    ict: { name: "ICT & Computer Lab", billed: 0, collected: 0, outstanding: 0 },
    exam: { name: "Exam Fees", billed: 0, collected: 0, outstanding: 0 },
  };

  for (const inv of invoices) {
    const due = Number(inv.amount_due) || 0;
    const paid = Number(inv.amount_paid) || 0;
    const items = resolveFeeBreakdown(inv.title, due, inv.breakdown);
    const allocated = allocatePaymentToBreakdown(items, paid);

    for (const alloc of allocated) {
      if (result[alloc.category]) {
        result[alloc.category].billed += alloc.amount;
        result[alloc.category].collected += alloc.allocated;
        result[alloc.category].outstanding += alloc.remaining;
      }
    }
  }

  return result;
}

/** Standard Nigerian Naira currency string. */
export function formatNaira(amount: number | string): string {
  const val = Number(amount) || 0;
  return `₦${val.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

/** Compute overall financial totals across invoices in a unified way. */
export function calculateCollectionTotals(invoices: Array<{
  amount_due: number | string;
  discount_amount?: number | string | null;
  amount_paid: number | string;
}>): {
  billed: number;
  discounts: number;
  netPayable: number;
  collected: number;
  outstanding: number;
  collectionRate: number;
} {
  let billed = 0;
  let discounts = 0;
  let collected = 0;
  let outstanding = 0;

  for (const inv of invoices) {
    const due = Number(inv.amount_due) || 0;
    const disc = Number(inv.discount_amount) || 0;
    const paid = Number(inv.amount_paid) || 0;
    const bal = invoiceOutstanding(inv);

    billed += due;
    discounts += disc;
    collected += paid;
    if (bal > 0) outstanding += bal;
  }

  const netPayable = Math.max(billed - discounts, 0);
  const collectionRate = netPayable > 0 ? Math.min(100, Math.round((collected / netPayable) * 100)) : 100;

  return { billed, discounts, netPayable, collected, outstanding, collectionRate };
}
