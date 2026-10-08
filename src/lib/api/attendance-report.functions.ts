import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendTermiiMessage, type TermiiChannel } from "@/lib/termii.server";
import {
  buildAttendanceMessage,
  groupByParent,
  summariseAttendance,
  weekRange,
  type AttRow,
} from "@/lib/attendance-report";
import type { Database } from "@/integrations/supabase/types";

const Scope = z.object({
  school_id: z.string().uuid(),
  class_id: z.string().uuid().optional(),
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date"),
  channel: z.enum(["generic", "dnd", "whatsapp"]).default("generic"),
});

type Scope = z.infer<typeof Scope>;

/** Gather the week's attendance, attach it to the adults linked to each child, and write one message per adult. */
async function buildReport(
  context: { supabase: SupabaseClient<Database>; userId: string },
  data: Scope,
) {
  const { data: allowed } = await context.supabase.rpc("school_permission", {
    _user_id: context.userId,
    _school_id: data.school_id,
    _permission: "communication.edit",
  });
  if (!allowed) throw new Error("Not authorized to send attendance reports");

  const { start, end } = weekRange(data.week_start);

  let sq = context.supabase
    .from("students")
    .select("id, first_name, last_name, class_id")
    .eq("school_id", data.school_id)
    .order("first_name");
  if (data.class_id) sq = sq.eq("class_id", data.class_id);
  const { data: students, error: sErr } = await sq;
  if (sErr) throw new Error(sErr.message);
  const ids = (students ?? []).map((s) => s.id);
  if (!ids.length) return { start, end, summaries: [], messages: [], missing_phone: 0, school_name: "" };

  const [{ data: rows, error: aErr }, { data: links }, { data: parents }, { data: school }] =
    await Promise.all([
      context.supabase
        .from("attendance")
        .select("student_id, status, date")
        .eq("school_id", data.school_id)
        .in("student_id", ids)
        .gte("date", start)
        .lte("date", end),
      context.supabase.from("student_parents").select("student_id, parent_id").in("student_id", ids),
      context.supabase.from("parents").select("id, full_name, phone").eq("school_id", data.school_id),
      context.supabase.from("schools").select("name").eq("id", data.school_id).maybeSingle(),
    ]);
  if (aErr) throw new Error(aErr.message);

  const summaries = summariseAttendance(students ?? [], (rows ?? []) as AttRow[]);
  const { targets, missing_phone } = groupByParent(
    summaries,
    links ?? [],
    (parents ?? []).map((p) => ({ id: p.id, full_name: p.full_name, phone: p.phone })),
  );
  const schoolName = school?.name ?? "your school";
  const messages = targets.map((t) => ({
    target: t,
    body: buildAttendanceMessage({
      parentName: t.full_name,
      schoolName,
      start,
      end,
      children: t.children,
    }),
  }));

  return { start, end, summaries, messages, missing_phone, school_name: schoolName };
}

/** Show the admin exactly what went down and what each family would receive — sends nothing. */
export const getWeeklyAttendanceReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Scope.parse(d))
  .handler(async ({ data, context }) => {
    const r = await buildReport(context, data);
    return {
      week_start: r.start,
      week_end: r.end,
      students: r.summaries,
      parents_reachable: r.messages.length,
      parents_missing_phone: r.missing_phone,
      marked: r.summaries.some((s) => s.marked > 0),
      sample: r.messages[0]?.body ?? null,
    };
  });

/** Send the week's report to every linked adult with a usable number, and file a copy in the family portal. */
export const sendWeeklyAttendanceReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Scope.parse(d))
  .handler(async ({ data, context }) => {
    const r = await buildReport(context, data);
    if (!r.messages.length) throw new Error("No parent with a usable phone number to send to");

    let sent = 0;
    let failed = 0;
    let firstError: string | null = null;
    for (let i = 0; i < r.messages.length; i += 10) {
      const batch = r.messages.slice(i, i + 10);
      const results = await Promise.all(
        batch.map((m) =>
          sendTermiiMessage({
            supabase: context.supabase,
            school_id: data.school_id,
            to: [m.target.phone],
            message: m.body,
            channel: data.channel as TermiiChannel,
            title: "Weekly attendance report",
          }),
        ),
      );
      for (const res of results) {
        if (res.ok) sent++;
        else {
          failed++;
          firstError ??= res.error;
        }
      }
    }

    const visible_from = new Date().toISOString();
    const { error: nErr } = await context.supabase.from("parent_notifications").insert(
      r.messages.map((m) => ({
        school_id: data.school_id,
        parent_id: m.target.parent_id,
        student_id: m.target.children.length === 1 ? m.target.children[0].student_id : null,
        type: "message",
        title: `Weekly attendance report (${r.start} to ${r.end})`,
        body: m.body,
        meta: { week_start: r.start, week_end: r.end, attendance: true },
        created_by: context.userId,
        visible_from,
      })),
    );
    if (nErr) throw new Error(nErr.message);

    return { ok: failed === 0, sent, failed, missing_phone: r.missing_phone, error: firstError };
  });
