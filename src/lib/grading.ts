/**
 * Nigerian National Academic Evaluation & Grading Engine
 * Aligned with WAEC, NECO, BECE, and Federal/State Ministry of Education standards.
 */

export type GradingScaleType = "waec_9point" | "primary_5point" | "legacy_5point";

export interface GradeDefinition {
  grade: string;
  min: number;
  max: number;
  remark: string;
  gpa: number;
  isCredit: boolean;
  isPass: boolean;
}

export type CaRatioType = "20_20_60" | "30_70" | "40_60";

export interface CaRatioConfig {
  id: CaRatioType;
  label: string;
  description: string;
  ca1Label: string;
  ca1Max: number;
  ca2Label: string;
  ca2Max: number;
  examLabel: string;
  examMax: number;
  totalMax: number;
}

export const CA_RATIOS: Record<CaRatioType, CaRatioConfig> = {
  "20_20_60": {
    id: "20_20_60",
    label: "20% CA1 + 20% CA2 + 60% Exam",
    description: "Standard Nigerian Secondary, Federal Unity, and State Model College continuous assessment structure.",
    ca1Label: "CA 1",
    ca1Max: 20,
    ca2Label: "CA 2",
    ca2Max: 20,
    examLabel: "Exam",
    examMax: 60,
    totalMax: 100,
  },
  "30_70": {
    id: "30_70",
    label: "30% CA + 70% Exam",
    description: "WAEC & NECO Senior School Certificate (SSCE) continuous assessment model.",
    ca1Label: "CA Score",
    ca1Max: 30,
    ca2Label: "Project",
    ca2Max: 0,
    examLabel: "Exam",
    examMax: 70,
    totalMax: 100,
  },
  "40_60": {
    id: "40_60",
    label: "40% CA (20+20) + 60% Exam",
    description: "UBEC Universal Basic Education / Primary School assessment standard.",
    ca1Label: "CA 1 (Mid-term)",
    ca1Max: 20,
    ca2Label: "CA 2 (Assignment)",
    ca2Max: 20,
    examLabel: "Exam",
    examMax: 60,
    totalMax: 100,
  },
};

export interface SchoolAcademicConfig {
  caRatio: CaRatioType;
  secondaryScale: GradingScaleType;
  primaryScale: GradingScaleType;
  passMark: number;
  requireEnglishAndMaths: boolean;
  promotionWeighting: PromotionWeighting;
}

export const DEFAULT_ACADEMIC_CONFIG: SchoolAcademicConfig = {
  caRatio: "20_20_60",
  secondaryScale: "waec_9point",
  primaryScale: "primary_5point",
  passMark: 50,
  requireEnglishAndMaths: true,
  promotionWeighting: "20_20_60",
};

export function resolveSchoolAcademicConfig(reportTemplate: unknown): SchoolAcademicConfig {
  if (!reportTemplate || typeof reportTemplate !== "object") {
    return DEFAULT_ACADEMIC_CONFIG;
  }
  const obj = reportTemplate as Record<string, any>;
  const cfg = obj.academic_config || {};
  return {
    caRatio: cfg.caRatio in CA_RATIOS ? cfg.caRatio : DEFAULT_ACADEMIC_CONFIG.caRatio,
    secondaryScale: cfg.secondaryScale === "legacy_5point" ? "legacy_5point" : "waec_9point",
    primaryScale: cfg.primaryScale === "legacy_5point" ? "legacy_5point" : "primary_5point",
    passMark: typeof cfg.passMark === "number" && cfg.passMark >= 30 && cfg.passMark <= 70 ? cfg.passMark : 50,
    requireEnglishAndMaths: typeof cfg.requireEnglishAndMaths === "boolean" ? cfg.requireEnglishAndMaths : true,
    promotionWeighting: cfg.promotionWeighting === "equal" ? "equal" : "20_20_60",
  };
}

/**
 * Standard Nigerian WAEC/NECO 9-Point Secondary Grading Scale
 */
export const WAEC_9POINT_SCALE: GradeDefinition[] = [
  { grade: "A1", min: 75, max: 100, remark: "Excellent", gpa: 4.0, isCredit: true, isPass: true },
  { grade: "B2", min: 70, max: 74.99, remark: "Very Good", gpa: 3.5, isCredit: true, isPass: true },
  { grade: "B3", min: 65, max: 69.99, remark: "Good", gpa: 3.0, isCredit: true, isPass: true },
  { grade: "C4", min: 60, max: 64.99, remark: "Credit", gpa: 2.5, isCredit: true, isPass: true },
  { grade: "C5", min: 55, max: 59.99, remark: "Credit", gpa: 2.0, isCredit: true, isPass: true },
  { grade: "C6", min: 50, max: 54.99, remark: "Credit", gpa: 1.5, isCredit: true, isPass: true },
  { grade: "D7", min: 45, max: 49.99, remark: "Pass", gpa: 1.0, isCredit: false, isPass: true },
  { grade: "E8", min: 40, max: 44.99, remark: "Pass", gpa: 0.5, isCredit: false, isPass: true },
  { grade: "F9", min: 0, max: 39.99, remark: "Fail", gpa: 0.0, isCredit: false, isPass: false },
];

/**
 * Standard Nigerian Primary & Basic Education 5-Point Scale
 */
export const PRIMARY_5POINT_SCALE: GradeDefinition[] = [
  { grade: "A", min: 75, max: 100, remark: "Distinction", gpa: 4.0, isCredit: true, isPass: true },
  { grade: "B", min: 65, max: 74.99, remark: "Very Good", gpa: 3.0, isCredit: true, isPass: true },
  { grade: "C", min: 50, max: 64.99, remark: "Credit", gpa: 2.0, isCredit: true, isPass: true },
  { grade: "D", min: 40, max: 49.99, remark: "Pass", gpa: 1.0, isCredit: false, isPass: true },
  { grade: "F", min: 0, max: 39.99, remark: "Fail", gpa: 0.0, isCredit: false, isPass: false },
];

/**
 * Legacy 5-point scale for backwards compatibility
 */
export const LEGACY_5POINT_SCALE: GradeDefinition[] = [
  { grade: "A", min: 70, max: 100, remark: "Excellent", gpa: 4.0, isCredit: true, isPass: true },
  { grade: "B", min: 60, max: 69.99, remark: "Very Good", gpa: 3.0, isCredit: true, isPass: true },
  { grade: "C", min: 50, max: 59.99, remark: "Good", gpa: 2.0, isCredit: true, isPass: true },
  { grade: "D", min: 45, max: 49.99, remark: "Fair", gpa: 1.0, isCredit: false, isPass: true },
  { grade: "F", min: 0, max: 44.99, remark: "Fail", gpa: 0.0, isCredit: false, isPass: false },
];

/**
 * Resolve the recommended scale for a school section
 */
export function getScaleForSection(section?: string | null): GradingScaleType {
  const norm = String(section || "").toLowerCase().trim();
  if (
    norm === "secondary" ||
    norm.includes("sec") ||
    norm.includes("jss") ||
    norm.includes("sss") ||
    /\b(ss\s*\d|jss\s*\d|sss\s*\d|college|senior|junior)\b/i.test(norm) ||
    norm.startsWith("ss") ||
    norm.startsWith("jss")
  ) {
    return "waec_9point";
  }
  return "primary_5point";
}

/**
 * Retrieve the active scale definitions
 */
export function getGradingScale(scaleType: GradingScaleType = "waec_9point"): GradeDefinition[] {
  if (scaleType === "primary_5point") return PRIMARY_5POINT_SCALE;
  if (scaleType === "legacy_5point") return LEGACY_5POINT_SCALE;
  return WAEC_9POINT_SCALE;
}

/**
 * Calculate grade, remark, GPA, and credit status for a numerical total score
 */
export function calculateGrade(
  score: number,
  scaleType: GradingScaleType = "waec_9point"
): GradeDefinition {
  const scale = getGradingScale(scaleType);
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));

  for (const item of scale) {
    if (clamped >= item.min) {
      return item;
    }
  }
  return scale[scale.length - 1];
}

/**
 * Validate Continuous Assessment and Examination inputs against the configured ratio
 */
export function validateScores(
  ca1: number,
  ca2: number,
  exam: number,
  ratioType: CaRatioType = "20_20_60"
): { isValid: boolean; error?: string; total: number } {
  const config = CA_RATIOS[ratioType] || CA_RATIOS["20_20_60"];

  if (ca1 < 0 || ca1 > config.ca1Max) {
    return {
      isValid: false,
      error: `${config.ca1Label} must be between 0 and ${config.ca1Max}`,
      total: 0,
    };
  }

  if (config.ca2Max > 0 && (ca2 < 0 || ca2 > config.ca2Max)) {
    return {
      isValid: false,
      error: `${config.ca2Label} must be between 0 and ${config.ca2Max}`,
      total: 0,
    };
  }

  if (exam < 0 || exam > config.examMax) {
    return {
      isValid: false,
      error: `${config.examLabel} must be between 0 and ${config.examMax}`,
      total: 0,
    };
  }

  const total = Math.min(100, Math.max(0, ca1 + (config.ca2Max > 0 ? ca2 : 0) + exam));
  return { isValid: true, total };
}

/* -------------------------------------------------------------------------- */
/* Official 3-Term Cumulative Promotion Evaluation Engine                      */
/* -------------------------------------------------------------------------- */

export type PromotionWeighting = "20_20_60" | "equal";
export type PromotionDecision = "promoted" | "trial" | "repeat" | "graduated";

export interface PromotionCriteria {
  passMark: number; // default 50%
  requireEnglish: boolean; // default true
  requireMaths: boolean; // default true
  weighting: PromotionWeighting; // default 20_20_60 (Term 1: 20%, Term 2: 20%, Term 3: 60%)
  maxFailedSubjects: number; // default 3
}

export const DEFAULT_PROMOTION_CRITERIA: PromotionCriteria = {
  passMark: 50,
  requireEnglish: true,
  requireMaths: true,
  weighting: "20_20_60",
  maxFailedSubjects: 3,
};

export interface SubjectScore {
  name: string;
  score: number;
  grade: string;
  isCredit?: boolean;
}

export interface PromotionEvaluation {
  decision: PromotionDecision;
  decisionLabel: string;
  cumulativeAverage: number;
  reason: string;
  passedEnglish: boolean;
  passedMaths: boolean;
  passedSubjectsCount: number;
  failedSubjectsCount: number;
  totalSubjectsCount: number;
  formula: string;
}

/**
 * Compute cumulative average across 3 terms using Nigerian weighted formula
 * Default weighting: Term 1 (20%) + Term 2 (20%) + Term 3 (60%)
 */
export function computeCumulativeAverage(
  term1Avg?: number | null,
  term2Avg?: number | null,
  term3Avg?: number | null,
  weighting: PromotionWeighting = "20_20_60"
): { cumulativeAverage: number; termsAvailable: number; formula: string } {
  const t1 = typeof term1Avg === "number" && !isNaN(term1Avg) ? term1Avg : null;
  const t2 = typeof term2Avg === "number" && !isNaN(term2Avg) ? term2Avg : null;
  const t3 = typeof term3Avg === "number" && !isNaN(term3Avg) ? term3Avg : null;

  // If all 3 terms are present
  if (t1 !== null && t2 !== null && t3 !== null) {
    if (weighting === "20_20_60") {
      const cum = +(t1 * 0.2 + t2 * 0.2 + t3 * 0.6).toFixed(2);
      return {
        cumulativeAverage: cum,
        termsAvailable: 3,
        formula: `(20% × ${t1}) + (20% × ${t2}) + (60% × ${t3}) = ${cum}%`,
      };
    }
    const cum = +((t1 + t2 + t3) / 3).toFixed(2);
    return {
      cumulativeAverage: cum,
      termsAvailable: 3,
      formula: `(${t1} + ${t2} + ${t3}) / 3 = ${cum}%`,
    };
  }

  // If only Term 3 is available or partial terms
  const presentTerms = [t1, t2, t3].filter((t): t is number => t !== null);
  if (presentTerms.length === 0) {
    return { cumulativeAverage: 0, termsAvailable: 0, formula: "No terms recorded" };
  }

  const sum = presentTerms.reduce((acc, v) => acc + v, 0);
  const avg = +(sum / presentTerms.length).toFixed(2);
  return {
    cumulativeAverage: avg,
    termsAvailable: presentTerms.length,
    formula: `Average of ${presentTerms.length} available term(s) = ${avg}%`,
  };
}

/**
 * Check if a subject name corresponds to English Language or Mathematics
 */
export function isEnglishSubject(subjectName: string): boolean {
  const norm = subjectName.toLowerCase();
  return norm.includes("english") || norm.includes("eng lang");
}

export function isMathsSubject(subjectName: string): boolean {
  const norm = subjectName.toLowerCase();
  return norm.includes("math") || norm.includes("general math");
}

/**
 * Evaluate a student's eligibility for promotion at the end of the academic session
 */
export function evaluatePromotion(
  params: {
    cumulativeAverage: number;
    subjects: SubjectScore[];
    isFinalClass?: boolean; // e.g. SS3 or Primary 6
    scaleType?: GradingScaleType;
  },
  customCriteria?: Partial<PromotionCriteria>
): PromotionEvaluation {
  const criteria: PromotionCriteria = { ...DEFAULT_PROMOTION_CRITERIA, ...customCriteria };
  const { cumulativeAverage, subjects, isFinalClass = false, scaleType = "waec_9point" } = params;

  let passedEnglish = !criteria.requireEnglish;
  let passedMaths = !criteria.requireMaths;
  let englishFound = false;
  let mathsFound = false;
  let passedSubjectsCount = 0;
  let failedSubjectsCount = 0;

  for (const s of subjects) {
    const isEng = isEnglishSubject(s.name);
    const isMath = isMathsSubject(s.name);
    const gradeDef = calculateGrade(s.score, scaleType);
    const credit = s.isCredit ?? gradeDef.isCredit;
    const pass = gradeDef.isPass;

    if (isEng) {
      englishFound = true;
      if (credit) passedEnglish = true;
    }
    if (isMath) {
      mathsFound = true;
      if (credit) passedMaths = true;
    }

    if (pass) {
      passedSubjectsCount++;
    } else {
      failedSubjectsCount++;
    }
  }

  // If student didn't take English or Maths in the class, don't penalize unfairly
  if (!englishFound) passedEnglish = true;
  if (!mathsFound) passedMaths = true;

  // Decision logic
  if (isFinalClass && cumulativeAverage >= criteria.passMark && passedEnglish && passedMaths) {
    return {
      decision: "graduated",
      decisionLabel: "Graduated",
      cumulativeAverage,
      reason: "Completed terminal class with required credits in English & Mathematics.",
      passedEnglish,
      passedMaths,
      passedSubjectsCount,
      failedSubjectsCount,
      totalSubjectsCount: subjects.length,
      formula: `Cumulative: ${cumulativeAverage}% ≥ Pass Mark ${criteria.passMark}%`,
    };
  }

  const metAverage = cumulativeAverage >= criteria.passMark;
  const metCoreCredits = passedEnglish && passedMaths;
  const excessFails = failedSubjectsCount > criteria.maxFailedSubjects;

  if (metAverage && metCoreCredits && !excessFails) {
    return {
      decision: "promoted",
      decisionLabel: "Promoted",
      cumulativeAverage,
      reason: `Met pass benchmark of ${criteria.passMark}% with credits in core English & Mathematics.`,
      passedEnglish,
      passedMaths,
      passedSubjectsCount,
      failedSubjectsCount,
      totalSubjectsCount: subjects.length,
      formula: `Cumulative: ${cumulativeAverage}% ≥ ${criteria.passMark}%`,
    };
  }

  // Check trial promotion criteria (e.g. average between 45% and passMark or missing only 1 core credit)
  if (cumulativeAverage >= 45 && failedSubjectsCount <= criteria.maxFailedSubjects + 1) {
    const missingCore = !passedEnglish && !passedMaths
      ? "English Language & Mathematics"
      : !passedEnglish
      ? "English Language"
      : !passedMaths
      ? "Mathematics"
      : "marginal average";

    return {
      decision: "trial",
      decisionLabel: "Promoted on Trial",
      cumulativeAverage,
      reason: `Promoted on probation/trial. Deficient in ${missingCore}.`,
      passedEnglish,
      passedMaths,
      passedSubjectsCount,
      failedSubjectsCount,
      totalSubjectsCount: subjects.length,
      formula: `Cumulative: ${cumulativeAverage}% (Trial threshold: 45%)`,
    };
  }

  // Must repeat class
  return {
    decision: "repeat",
    decisionLabel: "Repeat Class",
    cumulativeAverage,
    reason: `Cumulative average (${cumulativeAverage}%) below promotion threshold (${criteria.passMark}%) or failed ${failedSubjectsCount} subjects.`,
    passedEnglish,
    passedMaths,
    passedSubjectsCount,
    failedSubjectsCount,
    totalSubjectsCount: subjects.length,
    formula: `Cumulative: ${cumulativeAverage}% < ${criteria.passMark}%`,
  };
}
