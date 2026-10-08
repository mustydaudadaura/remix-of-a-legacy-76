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
