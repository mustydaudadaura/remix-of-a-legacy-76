import { test, expect } from "./test-compat";
import {
  generateStudentVirtualAccount,
  isValidNubanAccountNumber,
  formatNubanDisplay,
  generateTransactionReference,
  SUPPORTED_VIRTUAL_BANKS,
} from "./virtual-accounts";

test("generateStudentVirtualAccount produces a 10-digit NUBAN account number", () => {
  const va = generateStudentVirtualAccount({
    schoolCode: "BSS",
    schoolName: "Bayajidda Secondary School",
    studentId: "student-uuid-001",
    admissionNo: "BSS/2026/042",
    firstName: "Aisha",
    lastName: "Dauda",
  });

  expect(va.accountNumber.length).toBe(10);
  expect(/^\d{10}$/.test(va.accountNumber)).toBe(true);
  expect(va.bankName).toBe("Wema Bank / ALAT");
  expect(va.accountName.includes("AISHA DAUDA")).toBe(true);
  expect(va.status).toBe("active");
  expect(va.paymentReference.startsWith("VA-BSS-")).toBe(true);
});

test("generateStudentVirtualAccount is deterministic and stable across calls", () => {
  const va1 = generateStudentVirtualAccount({
    schoolCode: "BSS",
    studentId: "student-uuid-001",
    admissionNo: "BSS/2026/042",
    firstName: "Aisha",
    lastName: "Dauda",
  });

  const va2 = generateStudentVirtualAccount({
    schoolCode: "BSS",
    studentId: "student-uuid-001",
    admissionNo: "BSS/2026/042",
    firstName: "Aisha",
    lastName: "Dauda",
  });

  expect(va1.accountNumber).toBe(va2.accountNumber);
  expect(va1.accountName).toBe(va2.accountName);
  expect(va1.paymentReference).toBe(va2.paymentReference);
});

test("different students receive distinct virtual account numbers", () => {
  const va1 = generateStudentVirtualAccount({
    schoolCode: "BSS",
    studentId: "student-uuid-001",
    admissionNo: "BSS/2026/001",
    firstName: "Aisha",
    lastName: "Dauda",
  });

  const va2 = generateStudentVirtualAccount({
    schoolCode: "BSS",
    studentId: "student-uuid-002",
    admissionNo: "BSS/2026/002",
    firstName: "Ibrahim",
    lastName: "Garba",
  });

  expect(va1.accountNumber).not.toBe(va2.accountNumber);
});

test("isValidNubanAccountNumber validates 10-digit Nigerian bank accounts", () => {
  expect(isValidNubanAccountNumber("9923847102")).toBe(true);
  expect(isValidNubanAccountNumber("992-384-7102")).toBe(true);
  expect(isValidNubanAccountNumber("12345")).toBe(false);
  expect(isValidNubanAccountNumber("1234567890123")).toBe(false);
});

test("formatNubanDisplay formats 10 digits into 4-3-3 readability chunks", () => {
  expect(formatNubanDisplay("9923847102")).toBe("9923 847 102");
});

test("generateTransactionReference outputs valid Nigerian payment reference format", () => {
  const ref = generateTransactionReference("TX-NUBAN");
  expect(ref.startsWith("TX-NUBAN-")).toBe(true);
  expect(ref.length).toBeGreaterThan(15);
});
