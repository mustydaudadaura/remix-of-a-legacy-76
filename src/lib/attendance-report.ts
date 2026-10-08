/** Pure, browser-safe helpers for the weekly attendance report sent to families. */

/** Titles families are often registered under ("Mr/Mrs Hauwa Bello") — never used on their own as the greeting. */
const HONORIFICS = new Set([
  "mr", "mrs", "ms", "miss", "dr", "prof", "engr", "rev", "hon", "chief",
  "barr", "sol", "alhaji", "hajia", "haji", "sir", "madam", "dame", "lord",
]);

const isTitle = (token: string) =>
  token.split("/").every((p) => HONORIFICS.has(p.replace(/\.$/, "").toLowerCase()));

/**
 * The name to greet an adult by. With a full name it is their own first name
 * ("Mr/Mrs Hauwa Bello" → "Hauwa"); with only a surname saved it keeps the title
 * so the message still reads politely ("Mr/Mrs Bello" → "Mr/Mrs Bello").
 */
export function greetingName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < parts.length && isTitle(parts[i])) i++;
  const names = parts.slice(i);
  if (!names.length) return "Parent";
  const title = parts.slice(0, i).join(" ");
  return names.length === 1 && title ? `${title} ${names[0]}` : names[0];
}

export const ATT_STATUSES = ["present", "absent", "late", "excused"] as const;
export type AttStatus = (typeof ATT_STATUSES)[number];

export type AttRow = { student_id: string; status: AttStatus; date: string };
export type StudentLite = { id: string; first_name: string; last_name: string; class_id?: string | null };

export type Summary = {
  student_id: string;
  name: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  marked: number;
  faults: number;
};

export type ParentTarget = {
  parent_id: string;
  full_name: string;
  phone: string;
  children: Summary[];
};

/** Termii's plain-SMS body cap. */
export const SMS_LIMIT = 459;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Monday–Sunday range (ISO dates) that contains the given day. */
export function weekRange(ref: string): { start: string; end: string } {
  if (!DATE_RE.test(ref)) throw new Error("Pick a valid date");
  const [y, m, d] = ref.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(dt.getTime())) throw new Error("Pick a valid date");
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7)); // back to Monday
  const start = dt.toISOString().slice(0, 10);
  dt.setUTCDate(dt.getUTCDate() + 6);
  return { start, end: dt.toISOString().slice(0, 10) };
}

export function summariseAttendance(students: StudentLite[], rows: AttRow[]): Summary[] {
  return students.map((s) => {
    const mine = rows.filter((r) => r.student_id === s.id);
    const count = (st: AttStatus) => mine.filter((r) => r.status === st).length;
    const absent = count("absent");
    const late = count("late");
    return {
      student_id: s.id,
      name: `${s.first_name} ${s.last_name}`.trim(),
      present: count("present"),
      absent,
      late,
      excused: count("excused"),
      marked: mine.length,
      faults: absent + late,
    };
  });
}

/** Attach each child's summary to the adults linked to them. Adults with no usable number are counted, not sent to. */
export function groupByParent(
  summaries: Summary[],
  links: { student_id: string; parent_id: string }[],
  parents: { id: string; full_name: string | null; phone: string | null }[],
): { targets: ParentTarget[]; missing_phone: number } {
  const byStudent = new Map(summaries.map((s) => [s.student_id, s]));
  const perParent = new Map<string, Summary[]>();
  for (const l of links) {
    const s = byStudent.get(l.student_id);
    if (!s) continue;
    const list = perParent.get(l.parent_id) ?? [];
    if (!list.some((c) => c.student_id === s.student_id)) list.push(s);
    perParent.set(l.parent_id, list);
  }
  const targets: ParentTarget[] = [];
  let missing_phone = 0;
  for (const p of parents) {
    const children = perParent.get(p.id);
    if (!children?.length) continue;
    const phone = (p.phone ?? "").trim();
    if (phone.replace(/\D/g, "").length < 7) { missing_phone++; continue; }
    targets.push({
      parent_id: p.id,
      full_name: p.full_name ?? "Parent",
      phone,
      children: [...children].sort((a, b) => a.name.localeCompare(b.name)),
    });
  }
  return { targets, missing_phone };
}

/** One SMS/WhatsApp body per adult: their own greeting, each child's week, and a line only when a day was missed. */
export function buildAttendanceMessage(input: {
  parentName: string;
  schoolName: string;
  start: string;
  end: string;
  children: Summary[];
}): string {
  const parent = greetingName(input.parentName) || "Parent";
  const lines = input.children.map(
    (c) => `${c.name}: ${c.present} present, ${c.absent} absent, ${c.late} late, ${c.excused} excused`,
  );
  const faults = input.children.reduce((n, c) => n + c.faults, 0);
  const tail = faults === 0
    ? "Perfect attendance this week — well done!"
    : `Please contact the school office about ${faults} day${faults === 1 ? "" : "s"} missed.`;
  const body = `Dear ${parent}. ${input.schoolName} attendance ${input.start} to ${input.end}. ${lines.join("; ")}. ${tail}`;
  return body.length <= SMS_LIMIT ? body : body.slice(0, SMS_LIMIT);
}
