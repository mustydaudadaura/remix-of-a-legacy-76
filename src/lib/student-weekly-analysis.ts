import { greetingName } from "./attendance-report";

export type PunctualityFlag = "perfect" | "good" | "lateness_warning" | "absence_alert" | "critical_absence";
export type AcademicFlag = "excelling" | "steady" | "needs_support" | "no_assessments";
export type OverallFlag = "praise" | "watchlist" | "action_required";

export interface StudentWeeklyData {
  id: string;
  name: string;
  admission_no: string;
  class_name?: string | null;
  // Punctuality & attendance
  present: number;
  late: number;
  absent: number;
  excused: number;
  total_days: number;
  // Academic performance
  recent_assessments?: Array<{
    subject_name: string;
    score: number;
    max_score?: number;
  }>;
  average_score?: number | null;
  // Outstanding fee balance (optional context)
  pending_balance?: number;
  // Teacher/Form master remarks
  teacher_note?: string | null;
}

export interface StudentAnalysisResult {
  student: StudentWeeklyData;
  punctuality_flag: PunctualityFlag;
  punctuality_summary: string;
  academic_flag: AcademicFlag;
  academic_summary: string;
  overall_flag: OverallFlag;
  flags_list: string[];
  recommended_action: string;
  digest_snippet: string;
}

export interface ParentWeeklyDigest {
  parent_id: string;
  parent_name: string;
  phone: string;
  children: StudentAnalysisResult[];
  overall_flag: OverallFlag;
  message_body: string;
}

/** Analyze an individual student's week using deterministic, high-accuracy educational rules. */
export function analyzeStudentWeek(s: StudentWeeklyData): StudentAnalysisResult {
  const faults = s.absent + s.late;
  const flagsList: string[] = [];

  // 1. Punctuality Analysis
  let punctuality_flag: PunctualityFlag = "perfect";
  let punctuality_summary = "100% attendance & prompt arrival all week.";

  if (s.absent >= 3) {
    punctuality_flag = "critical_absence";
    punctuality_summary = `Critical absence: missed ${s.absent} school days.`;
    flagsList.push(`${s.absent} days absent`);
  } else if (s.absent >= 1) {
    punctuality_flag = "absence_alert";
    punctuality_summary = `Missed ${s.absent} school day${s.absent > 1 ? "s" : ""}.`;
    flagsList.push(`${s.absent} day(s) absent`);
  } else if (s.late >= 2) {
    punctuality_flag = "lateness_warning";
    punctuality_summary = `Repeated morning lateness (${s.late} times this week).`;
    flagsList.push(`${s.late} days late`);
  } else if (s.late === 1) {
    punctuality_flag = "good";
    punctuality_summary = `Good attendance (arrived late on 1 day).`;
  }

  // 2. Academic Performance Analysis
  let academic_flag: AcademicFlag = "no_assessments";
  let academic_summary = "Normal classroom work; no formal test entered this week.";

  if (s.average_score != null) {
    if (s.average_score >= 75) {
      academic_flag = "excelling";
      academic_summary = `Outstanding academic results (${Math.round(s.average_score)}% average).`;
    } else if (s.average_score >= 50) {
      academic_flag = "steady";
      academic_summary = `Steady performance (${Math.round(s.average_score)}% average).`;
    } else {
      academic_flag = "needs_support";
      academic_summary = `Academic support needed (${Math.round(s.average_score)}% average).`;
      flagsList.push(`Academic dip in tests (${Math.round(s.average_score)}%)`);
    }
  }

  // Check specific subjects needing support
  const lowSubjects = (s.recent_assessments ?? [])
    .filter((a) => (a.score / (a.max_score || 20)) < 0.5)
    .map((a) => a.subject_name);

  if (lowSubjects.length > 0) {
    flagsList.push(`Review needed: ${lowSubjects.slice(0, 2).join(", ")}`);
  }

  // Fee flag
  if ((s.pending_balance ?? 0) > 0) {
    flagsList.push("Pending fee balance");
  }

  // 3. Overall Triage
  let overall_flag: OverallFlag = "praise";
  let recommended_action = "Praise your child for maintaining strong attendance and focus!";

  if (s.absent >= 1 || s.late >= 2 || academic_flag === "needs_support") {
    overall_flag = "action_required";
    recommended_action = s.absent >= 1
      ? "Please liaise with the school office regarding missed class days."
      : "Please review homework routines and morning departure times with your child.";
  } else if (s.late === 1 || lowSubjects.length > 0) {
    overall_flag = "watchlist";
    recommended_action = "Encourage consistent morning punctuality and review subject notes.";
  }

  // 4. Construct child snippet
  let snippet = `${s.name}: ${s.present}/${Math.max(s.total_days, 5)} days present`;
  if (s.absent > 0) snippet += `, ${s.absent} absent`;
  if (s.late > 0) snippet += `, ${s.late} late`;
  if (s.average_score != null) snippet += `, ${Math.round(s.average_score)}% test avg`;
  if (s.teacher_note) snippet += ` (${s.teacher_note})`;

  return {
    student: s,
    punctuality_flag,
    punctuality_summary,
    academic_flag,
    academic_summary,
    overall_flag,
    flags_list: flagsList,
    recommended_action,
    digest_snippet: snippet,
  };
}

/** Consolidates multiple students into one unified Friday digest per parent. */
export function buildFridayParentDigest(
  parent: { id: string; full_name: string | null; phone: string | null },
  schoolName: string,
  weekEnd: string,
  childrenAnalyses: StudentAnalysisResult[],
): ParentWeeklyDigest | null {
  const phone = (parent.phone ?? "").trim().replace(/\s+/g, "");
  if (phone.replace(/\D/g, "").length < 7) {
    return null; // Skip invalid or missing phone numbers
  }

  const pName = greetingName(parent.full_name || "") || "Parent";
  const hasActionRequired = childrenAnalyses.some((c) => c.overall_flag === "action_required");
  const hasWatchlist = childrenAnalyses.some((c) => c.overall_flag === "watchlist");
  const overall_flag: OverallFlag = hasActionRequired ? "action_required" : hasWatchlist ? "watchlist" : "praise";

  // Build message body
  const childrenLines = childrenAnalyses.map((c) => c.digest_snippet).join("; ");
  let closingNote = "Keep encouraging their learning. Have a restful weekend!";
  if (hasActionRequired) {
    closingNote = "Please review your child's weekly notes and contact the school if needed.";
  } else if (childrenAnalyses.every((c) => c.punctuality_flag === "perfect")) {
    closingNote = "Commendable punctuality and conduct this week. Well done!";
  }

  const body = `Dear ${pName}. ${schoolName} Friday Update (${weekEnd}): ${childrenLines}. ${closingNote}`;

  return {
    parent_id: parent.id,
    parent_name: parent.full_name || "Parent",
    phone,
    children: childrenAnalyses,
    overall_flag,
    message_body: body,
  };
}
