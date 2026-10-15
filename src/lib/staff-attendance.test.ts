import { describe, expect, test } from "./test-compat";
import { DEFAULT_SETTINGS, arrival, evaluateDay, penaltiesForDay, haversineMeters } from "./staff-attendance";
import { computePay, canMoveTo } from "./payroll-calc";

const s = { ...DEFAULT_SETTINGS, penalties: { late: 500, late_extra: 0, absence: 2000, early: 0, missing_checkout: 0 } };

describe("staff attendance rules", () => {
  test("7:45 is on time with 7:30 + 15 min grace", () => {
    expect(arrival(7 * 60 + 45, s).late).toBe(false);
  });
  test("7:46 is late, counted 16 minutes from official time", () => {
    expect(arrival(7 * 60 + 46, s)).toEqual({ late: true, lateMinutes: 16 });
  });
  test("exemption overrides absence and carries no penalty", () => {
    const r = evaluateDay({ date: "2026-10-05", today: "2026-10-08", nowMinutes: 900, exemption: "Official assignment" }, s);
    expect(r.status).toBe("exempt");
    expect(r.counts).toBe(false);
    expect(penaltiesForDay(r, s)).toEqual([]);
  });
  test("past working day with no record is absent with absence penalty", () => {
    const r = evaluateDay({ date: "2026-10-05", today: "2026-10-08", nowMinutes: 900 }, s);
    expect(r.status).toBe("absent");
    expect(penaltiesForDay(r, s)).toEqual([{ kind: "absence", amount: 2000 }]);
  });
  test("weekend is an off day, not absent", () => {
    expect(evaluateDay({ date: "2026-10-04", today: "2026-10-08", nowMinutes: 900 }, s).status).toBe("off_day");
  });
  test("distance of ~111 m per 0.001 degree latitude", () => {
    expect(Math.round(haversineMeters({ lat: 9, lng: 7 }, { lat: 9.001, lng: 7 }))).toBe(111);
  });
});

describe("payroll", () => {
  const base = { basic: 100000, allowances: 20000, other_deductions: 5000, salary_type: "monthly" as const, period_kind: "monthly" as const, period_working_days: 22 };
  const pens = [{ kind: "late", amount: 500, status: "pending" }, { kind: "absence", amount: 2000, status: "pending" }, { kind: "late", amount: 500, status: "waived" }];
  test("net = basic + allowances − penalties − deductions when penalties apply", () => {
    expect(computePay({ ...base, penalties: pens, apply_penalties: true }).net).toBe(112500);
  });
  test("penalties are not deducted unless the payroll rule says so", () => {
    expect(computePay({ ...base, penalties: pens, apply_penalties: false }).net).toBe(115000);
  });
  test("approval must follow review", () => {
    expect(canMoveTo("draft", "approved")).toBe(false);
    expect(canMoveTo("reviewed", "approved")).toBe(true);
  });
});
