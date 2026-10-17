import { test, expect } from "./test-compat";
import {
  invoiceOutstanding,
  maxDiscount,
  paymentProgressPercentage,
  calculateCollectionTotals,
  formatNaira,
  resolveFeeBreakdown,
  sumBreakdown,
  allocatePaymentToBreakdown,
  calculateCategoryTotals,
} from "./finance-math";

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

test("paymentProgressPercentage calculates correct completion", () => {
  // 50,000 due, 10,000 discount -> 40,000 net. 20,000 paid -> 50%
  expect(paymentProgressPercentage({ amount_due: 50000, discount_amount: 10000, amount_paid: 20000 })).toBe(50);
  // Full payment
  expect(paymentProgressPercentage({ amount_due: 30000, amount_paid: 30000 })).toBe(100);
  // Zero paid
  expect(paymentProgressPercentage({ amount_due: 30000, amount_paid: 0 })).toBe(0);
});

test("calculateCollectionTotals computes consistent totals", () => {
  const invs = [
    { amount_due: 50000, discount_amount: 10000, amount_paid: 40000 }, // paid in full after discount
    { amount_due: 50000, discount_amount: 0, amount_paid: 20000 },     // 30,000 balance
  ];
  const totals = calculateCollectionTotals(invs);
  expect(totals.billed).toBe(100000);
  expect(totals.discounts).toBe(10000);
  expect(totals.netPayable).toBe(90000);
  expect(totals.collected).toBe(60000);
  expect(totals.outstanding).toBe(30000);
  expect(totals.collectionRate).toBe(67);
});

test("formatNaira formats currency with native symbol and Nigerian locale", () => {
  expect(formatNaira(150000)).toBe("₦150,000");
  expect(formatNaira(2500.5)).toBe("₦2,500.5");
  expect(formatNaira(0)).toBe("₦0");
});

test("resolveFeeBreakdown breaks down day student composite fee into standard categories", () => {
  const items = resolveFeeBreakdown("Term 1 Composite School Fees", 100000, null, false);
  const categories = items.map((i) => i.category);

  // Must include Tuition, Books, Uniforms, PTA
  expect(categories.includes("tuition")).toBe(true);
  expect(categories.includes("books")).toBe(true);
  expect(categories.includes("uniforms")).toBe(true);
  expect(categories.includes("pta")).toBe(true);

  // Sum of breakdown must match the total billed amount
  const total = sumBreakdown(items);
  expect(total).toBe(100000);
});

test("resolveFeeBreakdown includes Boarding for boarding students", () => {
  const items = resolveFeeBreakdown("Term 1 Composite School Fees", 200000, null, true);
  const categories = items.map((i) => i.category);

  expect(categories.includes("boarding")).toBe(true);
  expect(categories.includes("tuition")).toBe(true);
  const boardingItem = items.find((i) => i.category === "boarding");
  expect(boardingItem?.amount).toBeGreaterThan(0);
  expect(sumBreakdown(items)).toBe(200000);
});

test("allocatePaymentToBreakdown clears Tuition first before non-mandatory items", () => {
  const breakdown = [
    { category: "tuition" as const, name: "Tuition", amount: 60000 },
    { category: "pta" as const, name: "PTA Levy", amount: 5000 },
    { category: "uniforms" as const, name: "Uniforms", amount: 15000 },
    { category: "books" as const, name: "Books", amount: 15000 },
  ];

  // Pay 62,000 (covers 60,000 tuition and 2,000 of PTA)
  const alloc = allocatePaymentToBreakdown(breakdown, 62000);
  expect(alloc[0].allocated).toBe(60000);
  expect(alloc[0].remaining).toBe(0);
  expect(alloc[1].allocated).toBe(2000);
  expect(alloc[1].remaining).toBe(3000);
  expect(alloc[2].allocated).toBe(0);
  expect(alloc[3].allocated).toBe(0);
});

test("calculateCategoryTotals computes collections and balances across Nigerian categories", () => {
  const invoices = [
    { title: "Term 1 School Fees", amount_due: 100000, amount_paid: 60000 },
    { title: "PTA Special Project", amount_due: 10000, amount_paid: 10000 },
  ];

  const catTotals = calculateCategoryTotals(invoices);
  expect(catTotals.tuition.billed).toBe(60000);
  expect(catTotals.tuition.collected).toBe(60000);
  expect(catTotals.tuition.outstanding).toBe(0);
  expect(catTotals.pta.billed).toBeGreaterThan(0);
});

