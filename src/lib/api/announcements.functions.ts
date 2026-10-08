import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    school_id: z.string().uuid(),
    type: z.enum(["news", "message", "general"]),
    title: z.string().min(2).max(140),
    body: z.string().min(2).max(4000),
    class_id: z.string().uuid().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: allowed, error: accessError } = await supabase.rpc("school_permission", { _user_id: userId, _school_id: data.school_id, _permission: "communication.edit" });
    if (accessError || !allowed) throw new Error("Not authorized to send school announcements");
    // resolve target parents
    let parentIds: string[] = [];
    if (data.class_id) {
      const { data: studs } = await supabase.from("students").select("id").eq("class_id", data.class_id).eq("school_id", data.school_id);
      const ids = (studs ?? []).map((s: any) => s.id);
      if (ids.length) {
        const { data: links } = await supabase.from("student_parents").select("parent_id").in("student_id", ids);
        parentIds = Array.from(new Set((links ?? []).map((l: any) => l.parent_id)));
      }
    } else {
      const { data: ps } = await supabase.from("parents").select("id").eq("school_id", data.school_id);
      parentIds = (ps ?? []).map((p: any) => p.id);
    }
    if (!parentIds.length) return { ok: true, sent: 0 };

    const rows = parentIds.map((pid) => ({
      school_id: data.school_id,
      parent_id: pid,
      type: data.type,
      title: data.title,
      body: data.body,
      created_by: userId,
    }));
    const { error } = await supabase.from("parent_notifications").insert(rows as never);
    if (error) throw new Error(error.message);
    return { ok: true, sent: rows.length };
  });
