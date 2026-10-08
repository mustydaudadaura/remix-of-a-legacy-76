import { test, expect } from "bun:test";
import { invoiceOutstanding, maxDiscount } from "./finance-math";

test("a discount is removed before the balance is worked out", () => {
  // ₦15,000 billed, ₦3,000 sibling discount approved, ₦2,000 paid → ₦10,000 still owing
  expect(invoiceOutstanding({ amount_due: 15000, discount_amount: 3000, amount_paid: 2000 })).toBe(10000);
});

test("an invoice with no discount owes the full amount less payments", () => {
  expect(invoiceOutstanding({ amount_due: 15000, amount_paid: 2000 })).toBe(13000);
  expect(invoiceOutstanding({ amount_due: 15000, discount_amount: null, amount_paid: 0 })).toBe(15000);
});

test("a full waiver leaves nothing to collect", () => {
  expect(invoiceOutstanding({ amount_due: 8000, discount_amount: 8000, amount_paid: 0 })).toBe(0);
});

test("a discount can never cover money already paid", () => {
  // only the unpaid part of the invoice is available to waive
  expect(maxDiscount({ amount_due: 20000, amount_paid: 5000 })).toBe(15000);
  expect(maxDiscount({ amount_due: 20000, amount_paid: 20000 })).toBe(0);
});
