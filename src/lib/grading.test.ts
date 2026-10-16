import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateGrade,
  WAEC_9POINT_SCALE,
  PRIMARY_5POINT_SCALE,
  validateScores,
  computeCumulativeAverage,
  evaluatePromotion,
  getScaleForSection,
} from "./grading";

test("WAEC 9-point grading scale assigns correct national grades and remarks", () => {
  // A1: 75-100
  assert.equal(calculateGrade(100, "waec_9point").grade, "A1");
  assert.equal(calculateGrade(75, "waec_9point").grade, "A1");
  assert.equal(calculateGrade(75, "waec_9point").remark, "Excellent");
  assert.equal(calculateGrade(75, "waec_9point").isCredit, true);

  // B2: 70-74
  assert.equal(calculateGrade(74, "waec_9point").grade, "B2");
  assert.equal(calculateGrade(70, "waec_9point").grade, "B2");
  assert.equal(calculateGrade(70, "waec_9point").remark, "Very Good");

  // B3: 65-69
  assert.equal(calculateGrade(69, "waec_9point").grade, "B3");
  assert.equal(calculateGrade(65, "waec_9point").grade, "B3");

  // C4: 60-64
  assert.equal(calculateGrade(64, "waec_9point").grade, "C4");
  assert.equal(calculateGrade(60, "waec_9point").grade, "C4");

  // C5: 55-59
  assert.equal(calculateGrade(59, "waec_9point").grade, "C5");
  assert.equal(calculateGrade(55, "waec_9point").grade, "C5");

  // C6: 50-54 (Lowest credit pass in WAEC)
  assert.equal(calculateGrade(54, "waec_9point").grade, "C6");
  assert.equal(calculateGrade(50, "waec_9point").grade, "C6");
  assert.equal(calculateGrade(50, "waec_9point").isCredit, true);

  // D7: 45-49 (Pass, not credit)
  assert.equal(calculateGrade(49, "waec_9point").grade, "D7");
  assert.equal(calculateGrade(45, "waec_9point").grade, "D7");
  assert.equal(calculateGrade(45, "waec_9point").isCredit, false);
  assert.equal(calculateGrade(45, "waec_9point").isPass, true);

  // E8: 40-44 (Pass, not credit)
  assert.equal(calculateGrade(44, "waec_9point").grade, "E8");
  assert.equal(calculateGrade(40, "waec_9point").grade, "E8");
  assert.equal(calculateGrade(40, "waec_9point").isCredit, false);
  assert.equal(calculateGrade(40, "waec_9point").isPass, true);

  // F9: 0-39 (Fail)
  assert.equal(calculateGrade(39, "waec_9point").grade, "F9");
  assert.equal(calculateGrade(0, "waec_9point").grade, "F9");
  assert.equal(calculateGrade(0, "waec_9point").isPass, false);
});

test("Primary 5-point grading scale assigns correct grades", () => {
  assert.equal(calculateGrade(85, "primary_5point").grade, "A");
  assert.equal(calculateGrade(75, "primary_5point").grade, "A");
  assert.equal(calculateGrade(70, "primary_5point").grade, "B");
  assert.equal(calculateGrade(58, "primary_5point").grade, "C");
  assert.equal(calculateGrade(42, "primary_5point").grade, "D");
  assert.equal(calculateGrade(30, "primary_5point").grade, "F");
});

test("Section scale detection resolves correctly", () => {
  assert.equal(getScaleForSection("secondary"), "waec_9point");
  assert.equal(getScaleForSection("JSS 1"), "waec_9point");
  assert.equal(getScaleForSection("SS 2"), "waec_9point");
  assert.equal(getScaleForSection("primary"), "primary_5point");
  assert.equal(getScaleForSection("nursery"), "primary_5point");
});

test("Continuous Assessment score validation enforces ratio bounds", () => {
  // 20/20/60
  const valid202060 = validateScores(18, 19, 55, "20_20_60");
  assert.equal(valid202060.isValid, true);
  assert.equal(valid202060.total, 92);

  const invalidCa1 = validateScores(25, 10, 50, "20_20_60");
  assert.equal(invalidCa1.isValid, false);
  assert.match(invalidCa1.error ?? "", /between 0 and 20/);

  // 30/70
  const valid3070 = validateScores(28, 0, 62, "30_70");
  assert.equal(valid3070.isValid, true);
  assert.equal(valid3070.total, 90);

  const invalidExam70 = validateScores(20, 0, 75, "30_70");
  assert.equal(invalidExam70.isValid, false);
});

test("Cumulative 3-term average uses Nigerian weighting 20% + 20% + 60%", () => {
  // Term 1: 70, Term 2: 80, Term 3: 90
  // (70 * 0.2) + (80 * 0.2) + (90 * 0.6) = 14 + 16 + 54 = 84%
  const res = computeCumulativeAverage(70, 80, 90, "20_20_60");
  assert.equal(res.cumulativeAverage, 84);
  assert.equal(res.termsAvailable, 3);
  assert.match(res.formula, /20%/);

  // Equal weighting: (70 + 80 + 90) / 3 = 80
  const equalRes = computeCumulativeAverage(70, 80, 90, "equal");
  assert.equal(equalRes.cumulativeAverage, 80);
});

test("Promotion evaluation checks pass mark and mandatory English & Maths credits", () => {
  // Student with high average AND credits in English & Maths
  const passedStudent = evaluatePromotion({
    cumulativeAverage: 72,
    subjects: [
      { name: "English Language", score: 68, grade: "B3", isCredit: true },
      { name: "General Mathematics", score: 62, grade: "C4", isCredit: true },
      { name: "Biology", score: 75, grade: "A1", isCredit: true },
      { name: "Economics", score: 70, grade: "B2", isCredit: true },
    ],
  });
  assert.equal(passedStudent.decision, "promoted");
  assert.equal(passedStudent.passedEnglish, true);
  assert.equal(passedStudent.passedMaths, true);

  // Student with high average but failed Mathematics credit (< 50 in WAEC)
  const failedMathsStudent = evaluatePromotion({
    cumulativeAverage: 58,
    subjects: [
      { name: "English Language", score: 65, grade: "B3", isCredit: true },
      { name: "General Mathematics", score: 44, grade: "E8", isCredit: false },
      { name: "Civic Education", score: 60, grade: "C4", isCredit: true },
    ],
  });
  assert.equal(failedMathsStudent.decision, "trial");
  assert.equal(failedMathsStudent.passedMaths, false);
  assert.match(failedMathsStudent.reason, /Mathematics/);

  // Student with poor average below 45%
  const repeatStudent = evaluatePromotion({
    cumulativeAverage: 38,
    subjects: [
      { name: "English Language", score: 35, grade: "F9", isCredit: false },
      { name: "General Mathematics", score: 32, grade: "F9", isCredit: false },
    ],
  });
  assert.equal(repeatStudent.decision, "repeat");

  // Terminal class graduation
  const graduatingStudent = evaluatePromotion({
    cumulativeAverage: 78,
    isFinalClass: true,
    subjects: [
      { name: "English Language", score: 75, grade: "A1", isCredit: true },
      { name: "General Mathematics", score: 70, grade: "B2", isCredit: true },
    ],
  });
  assert.equal(graduatingStudent.decision, "graduated");
});
