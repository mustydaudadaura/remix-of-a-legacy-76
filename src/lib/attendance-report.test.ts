import { expect, test } from "bun:test";
import {
  SMS_LIMIT,
  buildAttendanceMessage,
  groupByParent,
  summariseAttendance,
  weekRange,
} from "./attendance-report";

const students = [
  { id: "s1", first_name: "Aisha", last_name: "Bello" },
  { id: "s2", first_name: "Musa", last_name: "Ibrahim" },
];

test("weekRange returns the Monday–Sunday containing the day", () => {
  // Thursday 8 Oct 2026
  expect(weekRange("2026-10-08")).toEqual({ start: "2026-10-05", end: "2026-10-11" });
  // already a Monday
  expect(weekRange("2026-10-05")).toEqual({ start: "2026-10-05", end: "2026-10-11" });
  // Sunday belongs to the week that started six days earlier
  expect(weekRange("2026-10-11")).toEqual({ start: "2026-10-05", end: "2026-10-11" });
});

test("weekRange rejects a missing or malformed day", () => {
  expect(() => weekRange("")).toThrow("Pick a valid date");
  expect(() => weekRange("08-10-2026")).toThrow("Pick a valid date");
});

test("summariseAttendance counts each status and flags faults", () => {
  const rows = [
    { student_id: "s1", status: "present" as const, date: "2026-10-05" },
    { student_id: "s1", status: "present" as const, date: "2026-10-06" },
    { student_id: "s1", status: "absent" as const, date: "2026-10-07" },
    { student_id: "s1", status: "late" as const, date: "2026-10-08" },
    { student_id: "s2", status: "excused" as const, date: "2026-10-05" },
  ];
  const [aisha, musa] = summariseAttendance(students, rows);
  expect(aisha).toEqual({
    student_id: "s1", name: "Aisha Bello",
    present: 2, absent: 1, late: 1, excused: 0, marked: 4, faults: 2,
  });
  expect(musa.faults).toBe(0); // excused is not a fault
  expect(musa.marked).toBe(1);
});

test("groupByParent merges siblings and reports adults with no usable number", () => {
  const summaries = summariseAttendance(students, []);
  const links = [
    { student_id: "s1", parent_id: "p1" },
    { student_id: "s2", parent_id: "p1" },
    { student_id: "s1", parent_id: "p2" },
    { student_id: "s2", parent_id: "p3" },
  ];
  const parents = [
    { id: "p1", full_name: "Hauwa Bello", phone: "08031234567" },
    { id: "p2", full_name: "Bello Ama", phone: null },
    { id: "p3", full_name: "Ibrahim Kola", phone: "080" },
  ];
  const { targets, missing_phone } = groupByParent(summaries, links, parents);
  expect(targets).toHaveLength(1);
  expect(targets[0].parent_id).toBe("p1");
  expect(targets[0].children.map((c) => c.name)).toEqual(["Aisha Bello", "Musa Ibrahim"]);
  expect(missing_phone).toBe(2);
});

test("message greets the adult by first name and lists each child's week", () => {
  const rows = [
    { student_id: "s1", status: "present" as const, date: "2026-10-05" },
    { student_id: "s1", status: "absent" as const, date: "2026-10-06" },
    { student_id: "s2", status: "present" as const, date: "2026-10-05" },
  ];
  const msg = buildAttendanceMessage({
    parentName: "Hauwa Bello",
    schoolName: "Markazul Huda",
    start: "2026-10-05",
    end: "2026-10-11",
    children: summariseAttendance(students, rows),
  });
  expect(msg).toContain("Dear Hauwa.");
  expect(msg).toContain("Markazul Huda attendance 2026-10-05 to 2026-10-11.");
  expect(msg).toContain("Aisha Bello: 1 present, 1 absent, 0 late, 0 excused");
  expect(msg).toContain("Musa Ibrahim: 1 present, 0 absent, 0 late, 0 excused");
  expect(msg).toContain("Please contact the school office about 1 day missed.");
  expect(msg).not.toContain("Perfect attendance");
});

test("a faultless week is reported as perfect attendance", () => {
  const msg = buildAttendanceMessage({
    parentName: "Hauwa Bello",
    schoolName: "Markazul Huda",
    start: "2026-10-05",
    end: "2026-10-11",
    children: summariseAttendance(students, [
      { student_id: "s1", status: "present" as const, date: "2026-10-05" },
      { student_id: "s2", status: "present" as const, date: "2026-10-05" },
    ]),
  });
  expect(msg).toContain("Perfect attendance this week — well done!");
  expect(msg).not.toContain("contact the school office");
});

test("messages stay inside the SMS cap", () => {
  const many = Array.from({ length: 40 }, (_, i) => ({
    id: `s${i}`, first_name: `Child${i}`, last_name: "With A Very Long Family Name",
  }));
  const msg = buildAttendanceMessage({
    parentName: "Hauwa Bello",
    schoolName: "Markazul Huda Initiative Comprehensive School",
    start: "2026-10-05",
    end: "2026-10-11",
    children: summariseAttendance(many, []),
  });
  expect(msg.length).toBeLessThanOrEqual(SMS_LIMIT);
});
