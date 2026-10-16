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
