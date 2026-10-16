import { test, expect } from "./test-compat";
import {
  analyzeStudentWeek,
  buildFridayParentDigest,
  type StudentWeeklyData,
} from "./student-weekly-analysis";

test("analyzeStudentWeek flags perfect attendance with praise", () => {
  const student: StudentWeeklyData = {
    id: "s1",
    name: "Zainab Bello",
    admission_no: "ADM/2026/001",
    present: 5,
    late: 0,
    absent: 0,
    excused: 0,
    total_days: 5,
    average_score: 88,
  };

  const res = analyzeStudentWeek(student);
  expect(res.punctuality_flag).toBe("perfect");
  expect(res.academic_flag).toBe("excelling");
  expect(res.overall_flag).toBe("praise");
  expect(res.flags_list.length).toBe(0);
});

test("analyzeStudentWeek flags repeated lateness on watchlist/action", () => {
  const student: StudentWeeklyData = {
    id: "s2",
    name: "Emeka Okafor",
    admission_no: "ADM/2026/042",
    present: 3,
    late: 2,
    absent: 0,
    excused: 0,
    total_days: 5,
    average_score: 65,
  };

  const res = analyzeStudentWeek(student);
  expect(res.punctuality_flag).toBe("lateness_warning");
  expect(res.overall_flag).toBe("action_required");
  expect(res.flags_list).toContain("2 days late");
});

test("analyzeStudentWeek flags absences and academic dip", () => {
  const student: StudentWeeklyData = {
    id: "s3",
    name: "Fatima Aliyu",
    admission_no: "ADM/2026/108",
    present: 3,
    late: 0,
    absent: 2,
    excused: 0,
    total_days: 5,
    average_score: 42,
  };

  const res = analyzeStudentWeek(student);
  expect(res.punctuality_flag).toBe("absence_alert");
  expect(res.academic_flag).toBe("needs_support");
  expect(res.overall_flag).toBe("action_required");
  expect(res.flags_list.some((f) => f.includes("absent"))).toBe(true);
});

test("buildFridayParentDigest merges siblings into one message", () => {
  const parent = {
    id: "p1",
    full_name: "Alhaji Musa Danladi",
    phone: "08031234567",
  };

  const child1 = analyzeStudentWeek({
    id: "c1",
    name: "Ibrahim Musa",
    admission_no: "ADM/01",
    present: 5,
    late: 0,
    absent: 0,
    excused: 0,
    total_days: 5,
    average_score: 80,
  });

  const child2 = analyzeStudentWeek({
    id: "c2",
    name: "Amina Musa",
    admission_no: "ADM/02",
    present: 4,
    late: 1,
    absent: 0,
    excused: 0,
    total_days: 5,
    average_score: 72,
  });

  const digest = buildFridayParentDigest(parent, "Apex Academy", "2026-10-16", [child1, child2]);
  expect(digest !== null).toBe(true);
  expect(digest!.parent_name).toBe("Alhaji Musa Danladi");
  expect(digest!.children.length).toBe(2);
  expect(digest!.message_body).toContain("Ibrahim Musa");
  expect(digest!.message_body).toContain("Amina Musa");
  expect(digest!.message_body).toContain("Apex Academy Friday Update");
});
