import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ALLOWED_ROLES = ["school_admin", "teacher", "accountant"] as const;

export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      email: z.string().email().max(255),
      full_name: z.string().min(1).max(120),
      role: z.enum(ALLOWED_ROLES),
      school_id: z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase: userClient, userId } = context;

    // Authorize: must be super_admin OR school_admin of the target school
    const [{ data: isSuper }, { data: rolesRows }] = await Promise.all([
      userClient.rpc("is_super_admin", { _user_id: userId }),
      userClient
        .from("user_roles")
        .select("role, school_id")
        .eq("user_id", userId),
    ]);

    const isSchoolAdminHere =
      rolesRows?.some(
        (r) => r.role === "school_admin" && r.school_id === data.school_id,
      ) ?? false;

    if (!isSuper && !isSchoolAdminHere) {
      throw new Error("Not authorized to invite staff for this school");
    }

    // Role boundary: super_admin assigns school_admin only;
    // school_admin assigns teacher or accountant only.
    if (isSuper && data.role !== "school_admin") {
      throw new Error("Super admins can only assign the School Admin role");
    }
    if (!isSuper && isSchoolAdminHere && data.role === "school_admin") {
      throw new Error("Only a super admin can assign the School Admin role");
    }

    // Invite (or fetch existing) user
    let invitedUserId: string | null = null;
    const inviteRes = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      { data: { full_name: data.full_name } },
    );

    if (inviteRes.error) {
      // If user already exists, look them up
      const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = list.data?.users?.find(
        (u) => u.email?.toLowerCase() === data.email.toLowerCase(),
      );
      if (!existing) {
        throw new Error(inviteRes.error.message);
      }
      invitedUserId = existing.id;
    } else {
      invitedUserId = inviteRes.data.user?.id ?? null;
    }

    if (!invitedUserId) throw new Error("Could not resolve invited user");

    // Ensure profile exists and attach to school
    await supabaseAdmin
      .from("profiles")
      .upsert(
        { user_id: invitedUserId, full_name: data.full_name, school_id: data.school_id },
        { onConflict: "user_id" },
      );

    // Assign role (idempotent on (user_id, role, school_id))
    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: invitedUserId,
      role: data.role,
      school_id: data.school_id,
    });
    if (roleErr && !roleErr.message.toLowerCase().includes("duplicate")) {
      throw new Error(roleErr.message);
    }

    return { ok: true, user_id: invitedUserId };
  });

export const removeStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      user_id: z.string().uuid(),
      role: z.enum(ALLOWED_ROLES),
      school_id: z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase: userClient, userId } = context;

    const [{ data: isSuper }, { data: rolesRows }] = await Promise.all([
      userClient.rpc("is_super_admin", { _user_id: userId }),
      userClient
        .from("user_roles")
        .select("role, school_id")
        .eq("user_id", userId),
    ]);
    const isSchoolAdminHere =
      rolesRows?.some(
        (r) => r.role === "school_admin" && r.school_id === data.school_id,
      ) ?? false;
    if (!isSuper && !isSchoolAdminHere) {
      throw new Error("Not authorized");
    }

    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", data.role)
      .eq("school_id", data.school_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
