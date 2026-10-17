import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateScore,
  resolveSchoolGradingConfig,
  evaluateCumulativePromotion,
  WAEC_9_POINT_SCALE,
  PRIMARY_5_POINT_SCALE,
  isEnglishSubject,
  isMathematicsSubject,
} from "./grading-engine";

describe("Nigerian WAEC/NECO/BECE 9-Point Grading Scale", () => {
  it("correctly grades A1 for scores 75 to 100", () => {
    assert.equal(evaluateScore(100, "secondary").grade, "A1");
    assert.equal(evaluateScore(75, "secondary").grade, "A1");
    assert.equal(evaluateScore(75, "secondary").remark, "Excellent");
    assert.equal(evaluateScore(75, "secondary").isCredit, true);
    assert.equal(evaluateScore(75, "secondary").points, 9);
  });

  it("correctly grades B2 for scores 70 to 74", () => {
    assert.equal(evaluateScore(74, "secondary").grade, "B2");
    assert.equal(evaluateScore(70, "secondary").grade, "B2");
    assert.equal(evaluateScore(70, "secondary").remark, "Very Good");
    assert.equal(evaluateScore(70, "secondary").isCredit, true);
  });

  it("correctly grades B3 for scores 65 to 69", () => {
    assert.equal(evaluateScore(69, "secondary").grade, "B3");
    assert.equal(evaluateScore(65, "secondary").grade, "B3");
    assert.equal(evaluateScore(65, "secondary").remark, "Good");
    assert.equal(evaluateScore(65, "secondary").isCredit, true);
  });

  it("correctly grades Credit grades C4, C5, C6", () => {
    assert.equal(evaluateScore(64, "secondary").grade, "C4");
    assert.equal(evaluateScore(60, "secondary").grade, "C4");
    assert.equal(evaluateScore(59, "secondary").grade, "C5");
    assert.equal(evaluateScore(55, "secondary").grade, "C5");
    assert.equal(evaluateScore(54, "secondary").grade, "C6");
    assert.equal(evaluateScore(50, "secondary").grade, "C6");
    assert.equal(evaluateScore(50, "secondary").isCredit, true);
  });

  it("correctly grades Pass grades D7, E8 (not credit)", () => {
    assert.equal(evaluateScore(49, "secondary").grade, "D7");
    assert.equal(evaluateScore(45, "secondary").grade, "D7");
    assert.equal(evaluateScore(45, "secondary").isCredit, false);
    assert.equal(evaluateScore(45, "secondary").isPass, true);

    assert.equal(evaluateScore(44, "secondary").grade, "E8");
    assert.equal(evaluateScore(40, "secondary").grade, "E8");
    assert.equal(evaluateScore(40, "secondary").isCredit, false);
    assert.equal(evaluateScore(40, "secondary").isPass, true);
  });

  it("correctly grades F9 for scores 0 to 39", () => {
    assert.equal(evaluateScore(39, "secondary").grade, "F9");
    assert.equal(evaluateScore(0, "secondary").grade, "F9");
    assert.equal(evaluateScore(39, "secondary").remark, "Fail");
    assert.equal(evaluateScore(39, "secondary").isPass, false);
    assert.equal(evaluateScore(39, "secondary").isCredit, false);
  });
});

describe("Nigerian Primary 5-Point Grading Scale", () => {
  it("grades A for distinction 70+", () => {
    assert.equal(evaluateScore(85, "primary").grade, "A");
    assert.equal(evaluateScore(70, "primary").grade, "A");
    assert.equal(evaluateScore(70, "primary").remark, "Distinction");
  });

  it("grades B for Very Good 60-69", () => {
    assert.equal(evaluateScore(68, "primary").grade, "B");
    assert.equal(evaluateScore(60, "primary").grade, "B");
  });

  it("grades C for Credit 50-59", () => {
    assert.equal(evaluateScore(55, "primary").grade, "C");
    assert.equal(evaluateScore(50, "primary").grade, "C");
    assert.equal(evaluateScore(50, "primary").isCredit, true);
  });

  it("grades D for Pass 40-49 and F for Fail 0-39", () => {
    assert.equal(evaluateScore(45, "primary").grade, "D");
    assert.equal(evaluateScore(45, "primary").isCredit, false);
    assert.equal(evaluateScore(35, "primary").grade, "F");
    assert.equal(evaluateScore(35, "primary").isPass, false);
  });
});

describe("Assessment Ratio Configuration", () => {
  it("defaults to 40% CA (20 + 20) and 60% Exam", () => {
    const cfg = resolveSchoolGradingConfig(null);
    assert.equal(cfg.ratio.preset, "40_60");
    assert.equal(cfg.ratio.ca1Max, 20);
    assert.equal(cfg.ratio.ca2Max, 20);
    assert.equal(cfg.ratio.examMax, 60);
  });

  it("supports 30% CA and 70% Exam preset", () => {
    const cfg = resolveSchoolGradingConfig({ grading: { ratio: { preset: "30_70" } } });
    assert.equal(cfg.ratio.preset, "30_70");
    assert.equal(cfg.ratio.ca1Max, 15);
    assert.equal(cfg.ratio.ca2Max, 15);
    assert.equal(cfg.ratio.examMax, 70);
  });

  it("supports custom ratio", () => {
    const cfg = resolveSchoolGradingConfig({
      grading: {
        ratio: {
          preset: "custom",
          ca1Max: 10,
          ca2Max: 30,
          examMax: 60,
          ca1Label: "Quiz",
          ca2Label: "Midterm",
        },
      },
    });
    assert.equal(cfg.ratio.preset, "custom");
    assert.equal(cfg.ratio.ca1Max, 10);
    assert.equal(cfg.ratio.ca2Max, 30);
    assert.equal(cfg.ratio.examMax, 60);
    assert.equal(cfg.ratio.ca1Label, "Quiz");
  });
});

describe("Subject Name Identification", () => {
  it("detects variations of English Language", () => {
    assert.equal(isEnglishSubject("English"), true);
    assert.equal(isEnglishSubject("English Language"), true);
    assert.equal(isEnglishSubject("ENG"), true);
    assert.equal(isEnglishSubject("Physics"), false);
  });

  it("detects variations of Mathematics", () => {
    assert.equal(isMathematicsSubject("Mathematics"), true);
    assert.equal(isMathematicsSubject("General Mathematics"), true);
    assert.equal(isMathematicsSubject("Maths"), true);
    assert.equal(isMathematicsSubject("Chemistry"), false);
  });
});

describe("3-Term Cumulative Promotion Calculation", () => {
  const policy = {
    weighting: "official_20_20_60" as const,
    term1Weight: 0.20,
    term2Weight: 0.20,
    term3Weight: 0.60,
    minCumulativeAverage: 50,
    requireEnglishCredit: true,
    requireMathCredit: true,
    minCreditPasses: 5,
  };

  it("computes official weighted average 20% T1 + 20% T2 + 60% T3 and promotes student", () => {
    const reports = [
      {
        session: "2025/2026",
        term: "first" as const,
        average: 60,
        totalScore: 480,
        subjectsCount: 8,
        assessments: [],
      },
      {
        session: "2025/2026",
        term: "second" as const,
        average: 70,
        totalScore: 560,
        subjectsCount: 8,
        assessments: [],
      },
      {
        session: "2025/2026",
        term: "third" as const,
        average: 80,
        totalScore: 640,
        subjectsCount: 8,
        assessments: [
          { subjectName: "English Language", total: 72 }, // B2 Credit
          { subjectName: "Mathematics", total: 68 }, // B3 Credit
          { subjectName: "Biology", total: 75 }, // A1
          { subjectName: "Chemistry", total: 64 }, // C4
          { subjectName: "Physics", total: 61 }, // C4
        ],
      },
    ];

    const result = evaluateCumulativePromotion(reports, "secondary", policy);
    // (60*0.2 + 70*0.2 + 80*0.6) = 12 + 14 + 48 = 74
    assert.equal(result.cumulativeAverage, 74);
    assert.equal(result.englishCreditPassed, true);
    assert.equal(result.mathCreditPassed, true);
    assert.equal(result.totalCreditsCount, 5);
    assert.equal(result.decision, "Promoted");
  });

  it("recommends repeating if cumulative average is below 50%", () => {
    const reports = [
      {
        session: "2025/2026",
        term: "first" as const,
        average: 40,
        totalScore: 200,
        subjectsCount: 5,
        assessments: [],
      },
      {
        session: "2025/2026",
        term: "second" as const,
        average: 42,
        totalScore: 210,
        subjectsCount: 5,
        assessments: [],
      },
      {
        session: "2025/2026",
        term: "third" as const,
        average: 45,
        totalScore: 225,
        subjectsCount: 5,
        assessments: [
          { subjectName: "English Language", total: 42 },
          { subjectName: "Mathematics", total: 40 },
        ],
      },
    ];

    const result = evaluateCumulativePromotion(reports, "secondary", policy);
    assert.equal(result.decision, "Repeat");
    assert.equal(result.cumulativeAverage < 50, true);
  });

  it("recommends repeating if both English and Math credit requirements fail", () => {
    const reports = [
      {
        session: "2025/2026",
        term: "third" as const,
        average: 55, // average is > 50%
        totalScore: 440,
        subjectsCount: 8,
        assessments: [
          { subjectName: "English Language", total: 42 }, // E8 (not credit)
          { subjectName: "Mathematics", total: 38 }, // F9 (fail)
          { subjectName: "Economics", total: 70 },
          { subjectName: "Government", total: 72 },
          { subjectName: "Literature", total: 68 },
        ],
      },
    ];

    const result = evaluateCumulativePromotion(reports, "secondary", policy);
    assert.equal(result.englishCreditPassed, false);
    assert.equal(result.mathCreditPassed, false);
    assert.equal(result.decision, "Repeat");
  });

  it("recommends Promoted on Trial if average is good but failed 1 core subject", () => {
    const reports = [
      {
        session: "2025/2026",
        term: "third" as const,
        average: 65,
        totalScore: 520,
        subjectsCount: 8,
        assessments: [
          { subjectName: "English Language", total: 68 }, // B3 Credit
          { subjectName: "Mathematics", total: 45 }, // D7 (Pass, but not Credit)
          { subjectName: "Biology", total: 75 },
          { subjectName: "Chemistry", total: 70 },
          { subjectName: "Physics", total: 65 },
          { subjectName: "Civic Education", total: 70 },
        ],
      },
    ];

    const result = evaluateCumulativePromotion(reports, "secondary", policy);
    assert.equal(result.englishCreditPassed, true);
    assert.equal(result.mathCreditPassed, false);
    assert.equal(result.decision, "Promoted on Trial");
  });
});
