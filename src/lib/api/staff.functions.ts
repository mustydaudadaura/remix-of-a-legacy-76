import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const ALLOWED_ROLES = ["school_admin", "teacher", "accountant"] as const;

async function assertCanManage(client: SupabaseClient<Database>, userId: string, schoolId: string) {
  const [{ data: isSuper }, { data: canManage }] = await Promise.all([
    client.rpc("is_super_admin", { _user_id: userId }),
    client.rpc("can_manage_school", { _user_id: userId, _school_id: schoolId }),
  ]);
  if (!isSuper && !canManage) throw new Error("Not authorized to manage staff for this school");
  return Boolean(isSuper);
}

export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      email: z.string().trim().email().max(255),
      full_name: z.string().trim().min(1).max(120),
      role: z.enum(ALLOWED_ROLES),
      school_id: z.string().uuid(),
      initial_password: z.string().min(8, "Password must be at least 8 characters").max(72).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const isSuper = await assertCanManage(context.supabase, context.userId, data.school_id);
    if (data.role === "school_admin" && !isSuper) {
      const { data: ok } = await context.supabase.rpc("can_manage_school", { _user_id: context.userId, _school_id: data.school_id });
      if (!ok) throw new Error("Only administrators can add school administrators");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();

    // Find an existing account with this email
    let targetUserId: string | null = null;
    for (let page = 1; page <= 50 && !targetUserId; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(`Could not look up accounts: ${error.message}`);
      const found = list.users.find((u) => u.email?.toLowerCase() === email);
      if (found) targetUserId = found.id;
      if (list.users.length < 1000) break;
    }

    let created = false;
    if (!targetUserId) {
      if (!data.initial_password) throw new Error("Enter an initial password for the new staff account");
      const { data: made, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.initial_password,
        email_confirm: true,
        user_metadata: { full_name: data.full_name, school_id: data.school_id },
      });
      if (error || !made.user) throw new Error(error?.message ?? "Could not create the staff account");
      targetUserId = made.user.id;
      created = true;
    }

    // Make sure the profile exists and is linked to the school
    const { data: profile } = await supabaseAdmin.from("profiles").select("id, school_id").eq("user_id", targetUserId).maybeSingle();
    if (!profile) {
      const { error } = await supabaseAdmin.from("profiles").insert({ user_id: targetUserId, full_name: data.full_name, school_id: data.school_id });
      if (error) throw new Error(`Could not save staff profile: ${error.message}`);
    } else {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ full_name: data.full_name, school_id: profile.school_id ?? data.school_id })
        .eq("user_id", targetUserId);
      if (error) throw new Error(`Could not update staff profile: ${error.message}`);
    }

    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({ user_id: targetUserId, role: data.role, school_id: data.school_id });
    if (roleErr && roleErr.code !== "23505") throw new Error(`Could not assign role: ${roleErr.message}`);

    return { ok: true, user_id: targetUserId, created, role: data.role };
  });

export const assignStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ user_id: z.string().uuid(), role: z.enum(ALLOWED_ROLES), school_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertCanManage(context.supabase, context.userId, data.school_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: data.role, school_id: data.school_id });
    if (error && error.code !== "23505") throw new Error(error.message);
    return { ok: true, user_id: data.user_id, role: data.role };
  });

export const removeStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ user_id: z.string().uuid(), role: z.enum(ALLOWED_ROLES), school_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertCanManage(context.supabase, context.userId, data.school_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", data.role)
      .eq("school_id", data.school_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
