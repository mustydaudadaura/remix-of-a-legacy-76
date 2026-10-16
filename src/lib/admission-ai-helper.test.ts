import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeNigerianPhone,
  isValidNigerianPhone,
  normalizeName,
  computeNameSimilarity,
  validateAdmissionStudent,
  findDuplicateRecord,
  type ExtractedAdmissionStudent,
  type DuplicateRecordCandidate,
} from "./admission-ai-helper";

test("normalizeNigerianPhone strictly preserves leading zeros", () => {
  assert.equal(normalizeNigerianPhone("08031234567"), "08031234567");
  assert.equal(normalizeNigerianPhone("0803 123 4567"), "08031234567");
  assert.equal(normalizeNigerianPhone("+234 803 123 4567"), "08031234567");
  assert.equal(normalizeNigerianPhone("2348031234567"), "08031234567");
  assert.equal(normalizeNigerianPhone("(0803) 123-4567"), "08031234567");
  assert.equal(normalizeNigerianPhone(""), "");
  assert.equal(normalizeNigerianPhone(null), "");
});

test("isValidNigerianPhone validates standard Nigerian prefixes", () => {
  assert.equal(isValidNigerianPhone("08031234567"), true);
  assert.equal(isValidNigerianPhone("07011223344"), true);
  assert.equal(isValidNigerianPhone("09099887766"), true);
  assert.equal(isValidNigerianPhone("+2348123456789"), true);
  assert.equal(isValidNigerianPhone("12345"), false);
  assert.equal(isValidNigerianPhone("abcd"), false);
});

test("computeNameSimilarity matches identical and partial names", () => {
  assert.equal(computeNameSimilarity("Musa Ibrahim", "MUSA IBRAHIM"), 1.0);
  assert.equal(computeNameSimilarity("Fatima Bello", "Fatima Aliyu Bello") > 0.6, true);
  assert.equal(computeNameSimilarity("John Doe", "Amina Garba"), 0.0);
});

test("validateAdmissionStudent identifies missing required fields and format issues", () => {
  const invalidStudent: Partial<ExtractedAdmissionStudent> = {
    first_name: "A", // too short
    last_name: "", // missing
    gender: "male",
    dob: "2099-01-01", // future date
    parent_phone: "123", // invalid phone
  };

  const result = validateAdmissionStudent(invalidStudent);
  assert.equal(result.valid, false);
  assert.equal(result.errors.length >= 3, true);

  const validStudent: Partial<ExtractedAdmissionStudent> = {
    first_name: "Chukwudi",
    last_name: "Okonkwo",
    gender: "male",
    dob: "2015-05-12",
    parent_phone: "08023456789",
    relationship: "father",
  };

  const validResult = validateAdmissionStudent(validStudent);
  assert.equal(validResult.valid, true);
  assert.equal(validResult.errors.length, 0);
});

test("findDuplicateRecord flags duplicate admission number and exact names", () => {
  const existing: DuplicateRecordCandidate[] = [
    {
      id: "std-1",
      type: "student",
      identifier: "ADM/2026/001",
      first_name: "Zainab",
      last_name: "Daudu",
      parent_phone: "08033333333",
    },
    {
      id: "adm-2",
      type: "admission",
      identifier: "APP-2026-9999",
      first_name: "Emeka",
      last_name: "Nnamdi",
      parent_phone: "08055555555",
    },
  ];

  // Exact admission number match
  const extractedWithAdmNo: ExtractedAdmissionStudent = {
    id: "temp-1",
    first_name: "Zainab",
    last_name: "Daudu",
    admission_no: "ADM/2026/001",
    relationship: "mother",
    confidence: 0.95,
    review_flags: [],
    status: "ready",
  };

  const match1 = findDuplicateRecord(extractedWithAdmNo, existing);
  assert.ok(match1);
  assert.equal(match1.match_type, "admission_no");
  assert.equal(match1.existing_id, "std-1");

  // Exact name match
  const extractedWithName: ExtractedAdmissionStudent = {
    id: "temp-2",
    first_name: "Emeka",
    last_name: "Nnamdi",
    relationship: "father",
    confidence: 0.9,
    review_flags: [],
    status: "ready",
  };

  const match2 = findDuplicateRecord(extractedWithName, existing);
  assert.ok(match2);
  assert.equal(match2.match_type, "exact_name");
  assert.equal(match2.existing_id, "adm-2");
});
