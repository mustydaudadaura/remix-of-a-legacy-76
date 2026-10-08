import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    const { data: canManage } = await userClient.rpc("can_manage_school", { _user_id: userId, _school_id: data.school_id });
    if (!canManage) throw new Error("Staff management is not available for this school");
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

    // Role boundary:
    //  - super_admin can assign any non-super role (school_admin, teacher, accountant)
    //  - school_admin can assign teacher or accountant only (never school_admin)
    if (!isSuper && isSchoolAdminHere && data.role === "school_admin") {
      throw new Error("Only a super admin can assign the School Admin role");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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

    const { data: existingProfile, error: profileReadError } = await supabaseAdmin.from("profiles").select("school_id").eq("user_id", invitedUserId).maybeSingle();
    if (profileReadError) throw new Error(profileReadError.message);
    if (!isSuper && existingProfile?.school_id && existingProfile.school_id !== data.school_id) throw new Error("This account belongs to another school");

    // Ensure profile exists and attach to school
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        { user_id: invitedUserId, full_name: data.full_name, school_id: data.school_id },
        { onConflict: "user_id" },
      );

    if (profileError) throw new Error(profileError.message);
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

    const { data: canManage } = await userClient.rpc("can_manage_school", { _user_id: userId, _school_id: data.school_id });
    if (!canManage) throw new Error("Staff management is not available for this school");
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

    if (!isSuper && data.role === "school_admin") throw new Error("Only a super admin can remove a School Admin role");
    const { error } = await userClient
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", data.role)
      .eq("school_id", data.school_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
