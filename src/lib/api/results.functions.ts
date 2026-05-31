import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PublishInput = z.object({
  class_id: z.string().uuid(),
  session: z.string().min(4).max(20),
  term: z.enum(["first", "second", "third"]),
  next_resumption_date: z.string().optional().nullable(),
  teacher_remark_default: z.string().max(500).optional(),
  principal_remark_default: z.string().max(500).optional(),
});

/**
 * Publish report cards for a whole class: aggregates assessments,
 * computes total, average, GPA, position, and upserts report_cards rows.
 * Sets published=true so parents/students can view & verify.
 */
export const publishReportCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => PublishInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Verify the caller is staff on the class's school
    const { data: cls, error: clsErr } = await supabaseAdmin
      .from("classes")
      .select("id, school_id, name")
      .eq("id", data.class_id)
      .maybeSingle();
    if (clsErr || !cls) throw new Error("Class not found");

    const { data: staffOk } = await supabaseAdmin.rpc("is_school_staff", {
      _user_id: userId,
      _school_id: cls.school_id,
    });
    if (!staffOk) throw new Error("Not authorized for this school");

    // Fetch students in the class
    const { data: students } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("class_id", data.class_id);
    if (!students?.length) throw new Error("No students in this class");

    // Fetch all assessments for this class/session/term
    const { data: assess } = await supabaseAdmin
      .from("assessments")
      .select("student_id, total")
      .eq("class_id", data.class_id)
      .eq("session", data.session)
      .eq("term", data.term);

    // Aggregate per student
    type Agg = { total: number; count: number };
    const agg = new Map<string, Agg>();
    for (const s of students) agg.set(s.id, { total: 0, count: 0 });
    (assess ?? []).forEach((a: any) => {
      const cur = agg.get(a.student_id) ?? { total: 0, count: 0 };
      cur.total += Number(a.total ?? 0);
      cur.count += 1;
      agg.set(a.student_id, cur);
    });

    // Build ranked array
    const ranked = Array.from(agg.entries())
      .map(([student_id, v]) => ({
        student_id,
        total_score: v.total,
        subjects_count: v.count,
        average: v.count > 0 ? +(v.total / v.count).toFixed(2) : 0,
      }))
      .sort((a, b) => b.total_score - a.total_score);

    const gradeToGpa = (avg: number) =>
      avg >= 70 ? 4.0 : avg >= 60 ? 3.0 : avg >= 50 ? 2.0 : avg >= 45 ? 1.0 : 0.0;

    const classSize = ranked.length;
    let written = 0;

    for (let i = 0; i < ranked.length; i++) {
      const r = ranked[i];
      const position = i + 1;
      const payload = {
        school_id: cls.school_id,
        student_id: r.student_id,
        class_id: cls.id,
        session: data.session,
        term: data.term,
        total_score: r.total_score,
        average: r.average,
        gpa: gradeToGpa(r.average),
        subjects_count: r.subjects_count,
        position,
        class_size: classSize,
        next_resumption_date: data.next_resumption_date || null,
        teacher_remark: data.teacher_remark_default || null,
        principal_remark: data.principal_remark_default || null,
        published: true,
      };

      // Find existing
      const { data: existing } = await supabaseAdmin
        .from("report_cards")
        .select("id")
        .eq("student_id", r.student_id)
        .eq("session", data.session)
        .eq("term", data.term)
        .maybeSingle();

      if (existing) {
        await supabaseAdmin.from("report_cards").update(payload).eq("id", existing.id);
      } else {
        await supabaseAdmin.from("report_cards").insert(payload);
      }
      written++;
    }

    return { ok: true, published: written, class_name: cls.name };
  });

const UpdateRemarksInput = z.object({
  report_card_id: z.string().uuid(),
  teacher_remark: z.string().max(1000).optional(),
  principal_remark: z.string().max(1000).optional(),
  psychomotor: z.record(z.string(), z.number().min(1).max(5)).optional(),
  affective: z.record(z.string(), z.number().min(1).max(5)).optional(),
  days_present: z.number().int().min(0).optional(),
  days_absent: z.number().int().min(0).optional(),
  days_total: z.number().int().min(0).optional(),
});

export const updateReportCardRemarks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpdateRemarksInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: rc } = await supabaseAdmin
      .from("report_cards")
      .select("school_id")
      .eq("id", data.report_card_id)
      .maybeSingle();
    if (!rc) throw new Error("Report card not found");

    const { data: staffOk } = await supabaseAdmin.rpc("is_school_staff", {
      _user_id: userId,
      _school_id: rc.school_id,
    });
    if (!staffOk) throw new Error("Not authorized");

    const update: Record<string, unknown> = {};
    for (const k of [
      "teacher_remark",
      "principal_remark",
      "psychomotor",
      "affective",
      "days_present",
      "days_absent",
      "days_total",
    ] as const) {
      if (data[k] !== undefined) update[k] = data[k];
    }
    if (Object.keys(update).length === 0) return { ok: true };
    const { error } = await supabaseAdmin
      .from("report_cards")
      .update(update)
      .eq("id", data.report_card_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
