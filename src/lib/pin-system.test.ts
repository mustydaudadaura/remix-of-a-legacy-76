import test from "node:test";
import assert from "node:assert/strict";
import {
  generateTwelveDigitPin,
  generateSerialNumber,
  normalizePin,
  normalizeSerial,
  isValidPinFormat,
  verifyScratchCardAccess,
  createPinBatch,
  type ResultCheckerPin,
} from "./pin-system";

test("12-digit PIN generation produces valid 4-4-4 format and exactly 12 numeric digits", () => {
  const pin = generateTwelveDigitPin();
  assert.match(pin, /^\d{4}-\d{4}-\d{4}$/);
  assert.equal(normalizePin(pin).length, 12);
  assert.equal(isValidPinFormat(pin), true);
  assert.equal(isValidPinFormat(normalizePin(pin)), true);
});

test("Serial number generation produces valid Nigerian exam format", () => {
  const serial = generateSerialNumber("EDU", "2026");
  assert.match(serial, /^EDU-2026-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.equal(normalizeSerial(serial), serial);
});

test("PIN normalization handles spaces, dashes, and invalid characters", () => {
  assert.equal(normalizePin("1234 - 5678 - 9012"), "123456789012");
  assert.equal(normalizePin("1234.5678.9012"), "123456789012");
  assert.equal(isValidPinFormat("1234-5678-901"), false); // 11 digits
  assert.equal(isValidPinFormat("1234-5678-90123"), false); // 13 digits
  assert.equal(isValidPinFormat("1234-5678-ABCD"), false); // alphabetic
});

test("Scratch card verification accepts valid unused card and tracks usage count", () => {
  const sampleCard: ResultCheckerPin = {
    id: "card-1",
    school_id: "sch-1",
    serial_no: "EDU-2026-ABCD-1234",
    pin: "1234-5678-9012",
    session: "2025/2026",
    max_uses: 5,
    times_used: 0,
    is_active: true,
    created_at: new Date().toISOString(),
    unlocked_report_ids: [],
  };

  const res = verifyScratchCardAccess({
    card: sampleCard,
    pinEntered: "1234-5678-9012",
    serialEntered: "EDU-2026-ABCD-1234",
    studentId: "stu-101",
    reportCardId: "rc-1",
    session: "2025/2026",
  });

  assert.equal(res.allowed, true);
  assert.equal(res.isAlreadyUnlocked, false);
  assert.equal(res.remainingUses, 4); // 5 - (0+1)
});

test("Scratch card rejects incorrect PIN or Serial Number", () => {
  const sampleCard: ResultCheckerPin = {
    id: "card-1",
    school_id: "sch-1",
    serial_no: "EDU-2026-ABCD-1234",
    pin: "1234-5678-9012",
    session: "2025/2026",
    max_uses: 5,
    times_used: 0,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  // Wrong PIN
  const wrongPin = verifyScratchCardAccess({
    card: sampleCard,
    pinEntered: "9999-9999-9999",
    serialEntered: "EDU-2026-ABCD-1234",
    studentId: "stu-101",
  });
  assert.equal(wrongPin.allowed, false);
  assert.match(wrongPin.error ?? "", /Invalid 12-digit PIN/);

  // Wrong Serial
  const wrongSerial = verifyScratchCardAccess({
    card: sampleCard,
    pinEntered: "1234-5678-9012",
    serialEntered: "EDU-2026-WRONG-SERIAL",
    studentId: "stu-101",
  });
  assert.equal(wrongSerial.allowed, false);
  assert.match(wrongSerial.error ?? "", /Invalid Serial Number/);
});

test("Scratch card prevents usage on a different student once bound", () => {
  const boundCard: ResultCheckerPin = {
    id: "card-1",
    school_id: "sch-1",
    serial_no: "EDU-2026-ABCD-1234",
    pin: "1234-5678-9012",
    session: "2025/2026",
    student_id: "stu-original",
    max_uses: 5,
    times_used: 1,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  const diffStudent = verifyScratchCardAccess({
    card: boundCard,
    pinEntered: "1234-5678-9012",
    serialEntered: "EDU-2026-ABCD-1234",
    studentId: "stu-different",
  });

  assert.equal(diffStudent.allowed, false);
  assert.match(diffStudent.error ?? "", /bound to another student/);
});

test("Scratch card enforces 5-use national check limit", () => {
  const exhaustedCard: ResultCheckerPin = {
    id: "card-1",
    school_id: "sch-1",
    serial_no: "EDU-2026-ABCD-1234",
    pin: "1234-5678-9012",
    session: "2025/2026",
    max_uses: 5,
    times_used: 5, // reached maximum
    is_active: true,
    created_at: new Date().toISOString(),
    unlocked_report_ids: ["rc-1", "rc-2"],
  };

  // Re-checking already unlocked report card is permitted without consuming extra checks
  const recheck = verifyScratchCardAccess({
    card: exhaustedCard,
    pinEntered: "1234-5678-9012",
    serialEntered: "EDU-2026-ABCD-1234",
    studentId: "stu-101",
    reportCardId: "rc-1",
  });
  assert.equal(recheck.allowed, true);
  assert.equal(recheck.isAlreadyUnlocked, true);

  // Checking a new report card with exhausted card is blocked
  const newCheck = verifyScratchCardAccess({
    card: exhaustedCard,
    pinEntered: "1234-5678-9012",
    serialEntered: "EDU-2026-ABCD-1234",
    studentId: "stu-101",
    reportCardId: "rc-3",
  });
  assert.equal(newCheck.allowed, false);
  assert.match(newCheck.error ?? "", /Scratch card exhausted/);
});

test("Batch generator creates requested card count with unique PINs and serials", () => {
  const batch = createPinBatch({
    school_id: "sch-123",
    count: 20,
    session: "2025/2026",
    max_uses: 5,
  });

  assert.equal(batch.length, 20);
  const serials = new Set(batch.map((c) => c.serial_no));
  const pins = new Set(batch.map((c) => c.pin));
  assert.equal(serials.size, 20);
  assert.equal(pins.size, 20);
  assert.equal(batch[0].max_uses, 5);
  assert.equal(batch[0].times_used, 0);
  assert.equal(batch[0].is_active, true);
});
