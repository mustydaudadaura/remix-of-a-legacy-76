// Shared payroll maths: Gross (basic + allowances) − penalties − other deductions = Net.

export type PayInput = {
  basic: number; allowances: number; other_deductions: number;
  salary_type: "monthly" | "weekly";
  period_kind: "monthly" | "weekly" | "custom";
  period_working_days: number;
  penalties: { kind: string; amount: number; status: string }[];
  apply_penalties: boolean;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Monthly salary is paid in full for a monthly period, otherwise per working day (22/month).
 *  Weekly salary is paid in full for a weekly period, otherwise per working day (5/week). */
export function salaryFactor(salary_type: PayInput["salary_type"], kind: PayInput["period_kind"], days: number) {
  if (salary_type === "monthly") return kind === "monthly" ? 1 : days / 22;
  return kind === "weekly" ? 1 : days / 5;
}

export function computePay(i: PayInput) {
  const f = salaryFactor(i.salary_type, i.period_kind, i.period_working_days);
  const basic = round2(i.basic * f);
  const allowances = round2(i.allowances * f);
  const gross = round2(basic + allowances);
  const active = i.apply_penalties ? i.penalties.filter((p) => p.status !== "waived") : [];
  const sum = (k: (p: { kind: string }) => boolean) => round2(active.filter(k).reduce((a, p) => a + Number(p.amount), 0));
  const late_penalty = sum((p) => p.kind === "late" || p.kind === "late_extra");
  const absence_penalty = sum((p) => p.kind === "absence");
  const other_penalty = sum((p) => p.kind === "early" || p.kind === "missing_checkout");
  const other_deductions = round2(i.other_deductions * (i.period_kind === "monthly" ? 1 : f));
  const total_deductions = round2(late_penalty + absence_penalty + other_penalty + other_deductions);
  const net = Math.max(0, round2(gross - total_deductions));
  return { basic, allowances, gross, late_penalty, absence_penalty, other_penalty, other_deductions, total_deductions, net };
}

export const PAYROLL_FLOW = ["draft", "reviewed", "approved", "paid"] as const;
export type PayrollStatus = typeof PAYROLL_FLOW[number];
export function canMoveTo(from: PayrollStatus, to: PayrollStatus) {
  if (to === "draft") return from === "reviewed" || from === "approved";
  return PAYROLL_FLOW.indexOf(to) === PAYROLL_FLOW.indexOf(from) + 1;
}
