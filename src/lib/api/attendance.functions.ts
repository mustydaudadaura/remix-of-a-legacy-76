import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MarkInput = z.object({
  class_id: z.string().uuid(),
  date: z.string(),
  entries: z.array(z.object({
    student_id: z.string().uuid(),
    status: z.enum(["present", "absent", "late", "excused"]),
    note: z.string().max(200).optional(),
  })).min(1).max(500),
});

export const markAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => MarkInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cls, error: cErr } = await supabase.from("classes").select("id, school_id").eq("id", data.class_id).maybeSingle();
    if (cErr || !cls) throw new Error("Class not found");
    const rows = data.entries.map((e) => ({
      school_id: cls.school_id,
      class_id: cls.id,
      student_id: e.student_id,
      date: data.date,
      status: e.status,
      note: e.note || null,
      marked_by: userId,
    }));
    const { error } = await supabase.from("attendance").upsert(rows as never, { onConflict: "student_id,date" });
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });
