import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fillTemplate, isMuted } from "@/lib/message-template";

export const sendAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    school_id: z.string().uuid(),
    type: z.enum(["news", "message", "general"]),
    title: z.string().min(2).max(140),
    body: z.string().min(2).max(4000),
    class_id: z.string().uuid().optional(),
    publish_at: z.string().datetime({ offset: true }).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: allowed, error: accessError } = await supabase.rpc("school_permission", { _user_id: userId, _school_id: data.school_id, _permission: "communication.edit" });
    if (accessError || !allowed) throw new Error("Not authorized to send school announcements");

    let parentIds: string[] | null = null;
    if (data.class_id) {
      const { data: studs } = await supabase.from("students").select("id").eq("class_id", data.class_id).eq("school_id", data.school_id);
      const ids = (studs ?? []).map((s) => s.id);
      parentIds = [];
      if (ids.length) {
        const { data: links } = await supabase.from("student_parents").select("parent_id").in("student_id", ids);
        parentIds = Array.from(new Set((links ?? []).map((l) => l.parent_id)));
      }
      if (!parentIds.length) return { ok: true, sent: 0, skipped: 0 };
    }
    let q = supabase.from("parents").select("id, full_name").eq("school_id", data.school_id);
    if (parentIds) q = q.in("id", parentIds);
    const [{ data: parents }, { data: prefs }, { data: school }] = await Promise.all([
      q,
      supabase.from("parent_preferences").select("parent_id, muted_types").eq("school_id", data.school_id),
      supabase.from("schools").select("name").eq("id", data.school_id).maybeSingle(),
    ]);
    const muted = new Map((prefs ?? []).map((p) => [p.parent_id, p.muted_types]));
    const targets = (parents ?? []).filter((p) => !isMuted(data.type, muted.get(p.id)));
    const skipped = (parents ?? []).length - targets.length;
    if (!targets.length) return { ok: true, sent: 0, skipped };

    const visible_from = data.publish_at ? new Date(data.publish_at).toISOString() : new Date().toISOString();
    const rows = targets.map((p) => {
      const vars = { parent_name: p.full_name, school_name: school?.name ?? "" };
      return {
        school_id: data.school_id,
        parent_id: p.id,
        type: data.type,
        title: fillTemplate(data.title, vars),
        body: fillTemplate(data.body, vars),
        created_by: userId,
        visible_from,
        meta: { broadcast: true },
      };
    });
    const { error } = await supabase.from("parent_notifications").insert(rows as never);
    if (error) throw new Error(error.message);
    return { ok: true, sent: rows.length, skipped };
  });
