/**
 * Standard Nigerian WAEC/NECO/BECE 9-Point & Primary 5-Point Grading and Evaluation Engine
 * Complies with the Nigerian National Educational Research and Development Council (NERDC)
 * and WAEC/NECO examination grading standards.
 */

export type SectionType = "nursery" | "primary" | "secondary";

export type WaecGrade = "A1" | "B2" | "B3" | "C4" | "C5" | "C6" | "D7" | "E8" | "F9";
export type PrimaryGrade = "A" | "B" | "C" | "D" | "F";

export interface GradeDefinition {
  grade: string;
  min: number;
  max: number;
  remark: string;
  points: number; // 9-point or 5-point GPA scale points
  category: "Distinction" | "Credit" | "Pass" | "Fail";
  isCredit: boolean;
  isPass: boolean;
}

/** National Secondary School WAEC / NECO / BECE 9-Point Grading Scale */
export const WAEC_9_POINT_SCALE: GradeDefinition[] = [
  { grade: "A1", min: 75, max: 100, remark: "Excellent", points: 9, category: "Distinction", isCredit: true, isPass: true },
  { grade: "B2", min: 70, max: 74,  remark: "Very Good", points: 8, category: "Distinction", isCredit: true, isPass: true },
  { grade: "B3", min: 65, max: 69,  remark: "Good",      points: 7, category: "Distinction", isCredit: true, isPass: true },
  { grade: "C4", min: 60, max: 64,  remark: "Credit",    points: 6, category: "Credit",      isCredit: true, isPass: true },
  { grade: "C5", min: 55, max: 59,  remark: "Credit",    points: 5, category: "Credit",      isCredit: true, isPass: true },
  { grade: "C6", min: 50, max: 54,  remark: "Credit",    points: 4, category: "Credit",      isCredit: true, isPass: true },
  { grade: "D7", min: 45, max: 49,  remark: "Pass",      points: 3, category: "Pass",        isCredit: false, isPass: true },
  { grade: "E8", min: 40, max: 44,  remark: "Pass",      points: 2, category: "Pass",        isCredit: false, isPass: true },
  { grade: "F9", min: 0,  max: 39,  remark: "Fail",      points: 1, category: "Fail",        isCredit: false, isPass: false },
];

/** National Primary School 5-Point Grading Scale */
export const PRIMARY_5_POINT_SCALE: GradeDefinition[] = [
  { grade: "A", min: 70, max: 100, remark: "Distinction", points: 5, category: "Distinction", isCredit: true, isPass: true },
  { grade: "B", min: 60, max: 69,  remark: "Very Good",   points: 4, category: "Distinction", isCredit: true, isPass: true },
  { grade: "C", min: 50, max: 59,  remark: "Credit",      points: 3, category: "Credit",      isCredit: true, isPass: true },
  { grade: "D", min: 40, max: 49,  remark: "Pass",        points: 2, category: "Pass",        isCredit: false, isPass: true },
  { grade: "F", min: 0,  max: 39,  remark: "Fail",        points: 1, category: "Fail",        isCredit: false, isPass: false },
];

/** Nursery 4-Point Descriptive Scale */
export const NURSERY_SCALE: GradeDefinition[] = [
  { grade: "Ex", min: 75, max: 100, remark: "Exceeding Expectations", points: 4, category: "Distinction", isCredit: true, isPass: true },
  { grade: "Me", min: 60, max: 74,  remark: "Meeting Expectations",   points: 3, category: "Credit",      isCredit: true, isPass: true },
  { grade: "Em", min: 45, max: 59,  remark: "Emerging Development",  points: 2, category: "Pass",        isCredit: false, isPass: true },
  { grade: "Nd", min: 0,  max: 44,  remark: "Needs Support",          points: 1, category: "Fail",        isCredit: false, isPass: false },
];

export type AssessmentRatioPreset = "40_60" | "30_70" | "20_20_60" | "custom";
export type PromotionWeightingPreset = "official_20_20_60" | "equal_33";

export interface AssessmentRatioConfig {
  preset: AssessmentRatioPreset;
  ca1Max: number;
  ca2Max: number;
  examMax: number;
  ca1Label: string;
  ca2Label: string;
  examLabel: string;
}

export interface PromotionPolicyConfig {
  weighting: PromotionWeightingPreset;
  term1Weight: number; // e.g. 0.20
  term2Weight: number; // e.g. 0.20
  term3Weight: number; // e.g. 0.60
  minCumulativeAverage: number; // default 50%
  requireEnglishCredit: boolean; // default true
  requireMathCredit: boolean; // default true
  minCreditPasses: number; // default 5
}

export interface SchoolGradingConfig {
  ratio: AssessmentRatioConfig;
  promotion: PromotionPolicyConfig;
  secondaryScale: "waec_9_point";
  primaryScale: "primary_5_point";
}

export const DEFAULT_RATIO_CONFIG: AssessmentRatioConfig = {
  preset: "40_60",
  ca1Max: 20,
  ca2Max: 20,
  examMax: 60,
  ca1Label: "CA1",
  ca2Label: "CA2",
  examLabel: "Exam",
};

export const DEFAULT_PROMOTION_CONFIG: PromotionPolicyConfig = {
  weighting: "official_20_20_60",
  term1Weight: 0.20,
  term2Weight: 0.20,
  term3Weight: 0.60,
  minCumulativeAverage: 50,
  requireEnglishCredit: true,
  requireMathCredit: true,
  minCreditPasses: 5,
};

export const DEFAULT_SCHOOL_GRADING_CONFIG: SchoolGradingConfig = {
  ratio: DEFAULT_RATIO_CONFIG,
  promotion: DEFAULT_PROMOTION_CONFIG,
  secondaryScale: "waec_9_point",
  primaryScale: "primary_5_point",
};

/**
 * Resolves school grading configuration from school.report_template or stored config.
 */
export function resolveSchoolGradingConfig(raw: unknown): SchoolGradingConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_SCHOOL_GRADING_CONFIG;
  const obj = raw as Record<string, any>;
  const grading = obj.grading ?? obj;

  const ratioPreset = grading.ratio?.preset as AssessmentRatioPreset;
  let ratio: AssessmentRatioConfig = { ...DEFAULT_RATIO_CONFIG };

  if (ratioPreset === "30_70") {
    ratio = { preset: "30_70", ca1Max: 15, ca2Max: 15, examMax: 70, ca1Label: "Test 1 (15)", ca2Label: "Test 2 (15)", examLabel: "Exam (70)" };
  } else if (ratioPreset === "20_20_60") {
    ratio = { preset: "20_20_60", ca1Max: 20, ca2Max: 20, examMax: 60, ca1Label: "1st Test (20)", ca2Label: "2nd Test (20)", examLabel: "Exam (60)" };
  } else if (ratioPreset === "custom" && typeof grading.ratio?.examMax === "number") {
    const c1 = Number(grading.ratio.ca1Max) || 20;
    const c2 = Number(grading.ratio.ca2Max) || 20;
    const ex = Number(grading.ratio.examMax) || (100 - c1 - c2);
    ratio = {
      preset: "custom",
      ca1Max: c1,
      ca2Max: c2,
      examMax: ex,
      ca1Label: grading.ratio.ca1Label || `CA1 (${c1})`,
      ca2Label: grading.ratio.ca2Label || `CA2 (${c2})`,
      examLabel: grading.ratio.examLabel || `Exam (${ex})`,
    };
  }

  const promoWeighting = grading.promotion?.weighting as PromotionWeightingPreset;
  let promotion: PromotionPolicyConfig = { ...DEFAULT_PROMOTION_CONFIG };
  if (promoWeighting === "equal_33") {
    promotion = {
      ...promotion,
      weighting: "equal_33",
      term1Weight: 1 / 3,
      term2Weight: 1 / 3,
      term3Weight: 1 / 3,
    };
  }

  if (typeof grading.promotion?.minCumulativeAverage === "number") {
    promotion.minCumulativeAverage = grading.promotion.minCumulativeAverage;
  }
  if (typeof grading.promotion?.requireEnglishCredit === "boolean") {
    promotion.requireEnglishCredit = grading.promotion.requireEnglishCredit;
  }
  if (typeof grading.promotion?.requireMathCredit === "boolean") {
    promotion.requireMathCredit = grading.promotion.requireMathCredit;
  }
  if (typeof grading.promotion?.minCreditPasses === "number") {
    promotion.minCreditPasses = grading.promotion.minCreditPasses;
  }

  return {
    ratio,
    promotion,
    secondaryScale: "waec_9_point",
    primaryScale: "primary_5_point",
  };
}

/**
 * Returns the relevant scale for a class section.
 */
export function getScaleForSection(section?: string | null): GradeDefinition[] {
  const s = (section || "").toLowerCase();
  if (s === "primary") return PRIMARY_5_POINT_SCALE;
  if (s === "nursery") return NURSERY_SCALE;
  return WAEC_9_POINT_SCALE; // Default secondary
}

/**
 * Evaluates score to determine grade, remark, points, and credit pass status.
 */
export function evaluateScore(score: number, section?: string | null): GradeDefinition {
  const rounded = Math.round(Math.max(0, Math.min(100, score)));
  const scale = getScaleForSection(section);
  for (const def of scale) {
    if (rounded >= def.min && rounded <= def.max) {
      return def;
    }
  }
  return scale[scale.length - 1];
}

/**
 * Checks whether a subject name corresponds to English Language.
 */
export function isEnglishSubject(name: string): boolean {
  const n = name.trim().toLowerCase();
  return (
    n === "english" ||
    n === "english language" ||
    n.startsWith("english") ||
    n === "eng" ||
    n.includes("english lang")
  );
}

/**
 * Checks whether a subject name corresponds to Mathematics.
 */
export function isMathematicsSubject(name: string): boolean {
  const n = name.trim().toLowerCase();
  return (
    n === "mathematics" ||
    n === "maths" ||
    n === "math" ||
    n.startsWith("general mathematics") ||
    n.includes("maths")
  );
}

export interface StudentTermReportInput {
  session: string;
  term: "first" | "second" | "third";
  average: number;
  totalScore: number;
  subjectsCount: number;
  assessments: Array<{
    subjectName: string;
    total: number;
    grade?: string | null;
  }>;
}

export interface PromotionEvaluationResult {
  decision: "Promoted" | "Promoted on Trial" | "Repeat" | "Graduated";
  cumulativeAverage: number;
  termsCount: number;
  termBreakdown: {
    first?: number;
    second?: number;
    third?: number;
  };
  englishCreditPassed: boolean;
  mathCreditPassed: boolean;
  englishScore: number | null;
  mathScore: number | null;
  totalCreditsCount: number;
  totalSubjectsTaken: number;
  reasons: string[];
  recommendationNote: string;
}

/**
 * Calculates 3-Term Cumulative Promotion evaluation.
 * Weights: Official NERDC/WAEC Standard: Term 1: 20%, Term 2: 20%, Term 3: 60%.
 * Or Equal 33.3% weighting if configured.
 * Requires Credit passes (A1-C6 or A-C) in English Language & Mathematics.
 */
export function evaluateCumulativePromotion(
  reports: StudentTermReportInput[],
  section: string = "secondary",
  policy: PromotionPolicyConfig = DEFAULT_PROMOTION_CONFIG
): PromotionEvaluationResult {
  const termsMap = new Map<string, StudentTermReportInput>();
  for (const r of reports) {
    termsMap.set(r.term, r);
  }

  const t1 = termsMap.get("first");
  const t2 = termsMap.get("second");
  const t3 = termsMap.get("third");

  const breakdown: { first?: number; second?: number; third?: number } = {};
  if (t1) breakdown.first = t1.average;
  if (t2) breakdown.second = t2.average;
  if (t3) breakdown.third = t3.average;

  // Calculate weighted cumulative average
  let totalWeight = 0;
  let weightedSum = 0;

  if (t1 && typeof t1.average === "number") {
    totalWeight += policy.term1Weight;
    weightedSum += t1.average * policy.term1Weight;
  }
  if (t2 && typeof t2.average === "number") {
    totalWeight += policy.term2Weight;
    weightedSum += t2.average * policy.term2Weight;
  }
  if (t3 && typeof t3.average === "number") {
    totalWeight += policy.term3Weight;
    weightedSum += t3.average * policy.term3Weight;
  }

  const cumulativeAverage = totalWeight > 0 ? +(weightedSum / totalWeight).toFixed(2) : 0;

  // Find subjects across third term (or most recent term)
  const focalReport = t3 || t2 || t1;
  const focalAssessments = focalReport?.assessments ?? [];

  let engScore: number | null = null;
  let mathScore: number | null = null;
  let creditsCount = 0;

  for (const a of focalAssessments) {
    const isCredit = evaluateScore(a.total, section).isCredit;
    if (isCredit) creditsCount++;

    if (isEnglishSubject(a.subjectName)) {
      engScore = a.total;
    } else if (isMathematicsSubject(a.subjectName)) {
      mathScore = a.total;
    }
  }

  const englishCreditPassed = engScore != null ? evaluateScore(engScore, section).isCredit : true;
  const mathCreditPassed = mathScore != null ? evaluateScore(mathScore, section).isCredit : true;

  const reasons: string[] = [];

  const metAverage = cumulativeAverage >= policy.minCumulativeAverage;
  if (!metAverage) {
    reasons.push(
      `Cumulative average of ${cumulativeAverage}% is below minimum required benchmark (${policy.minCumulativeAverage}%).`
    );
  }

  if (policy.requireEnglishCredit && engScore != null && !englishCreditPassed) {
    const engGrade = evaluateScore(engScore, section).grade;
    reasons.push(`Did not obtain a credit pass in English Language (Score: ${engScore}%, Grade: ${engGrade}).`);
  }

  if (policy.requireMathCredit && mathScore != null && !mathCreditPassed) {
    const mathGrade = evaluateScore(mathScore, section).grade;
    reasons.push(`Did not obtain a credit pass in Mathematics (Score: ${mathScore}%, Grade: ${mathGrade}).`);
  }

  if (creditsCount < policy.minCreditPasses && focalAssessments.length >= policy.minCreditPasses) {
    reasons.push(`Obtained ${creditsCount} credit passes (minimum required: ${policy.minCreditPasses}).`);
  }

  let decision: PromotionEvaluationResult["decision"] = "Promoted";
  let recommendationNote = "Student has satisfied all academic standards and is approved for promotion to next class.";

  if (!metAverage || (!englishCreditPassed && !mathCreditPassed)) {
    decision = "Repeat";
    recommendationNote = `Repeat current class: ${reasons.join(" ")}`;
  } else if (!englishCreditPassed || !mathCreditPassed || creditsCount < policy.minCreditPasses) {
    // Only 1 core failed but average met -> Promoted on Trial
    decision = "Promoted on Trial";
    recommendationNote = `Promoted on Trial subject to academic probation: ${reasons.join(" ")}`;
  }

  return {
    decision,
    cumulativeAverage,
    termsCount: [t1, t2, t3].filter(Boolean).length,
    termBreakdown: breakdown,
    englishCreditPassed,
    mathCreditPassed,
    englishScore: engScore,
    mathScore: mathScore,
    totalCreditsCount: creditsCount,
    totalSubjectsTaken: focalAssessments.length,
    reasons,
    recommendationNote,
  };
}
