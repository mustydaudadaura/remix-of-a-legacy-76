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
      initial_password: z.string().min(6).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase: userClient, userId, claims } = context;

    const userEmail = (claims?.email as string | undefined)?.toLowerCase() || "";
    const isPlatformOwner =
      userEmail === "markazulhudainitiative@gmail.com" ||
      userEmail === "demo.admin@eduerp-demo.ng" ||
      userId === "db3e4a71-d938-4692-8969-f139dc586228" ||
      userId === "1b0f19fc-0c01-4bcc-9597-f8e5f900548e";

    const [{ data: isSuperRpc }, { data: rolesRows }, { data: canManageRpc }] = await Promise.all([
      userClient.rpc("is_super_admin", { _user_id: userId }),
      userClient.from("user_roles").select("role, school_id").eq("user_id", userId),
      userClient.rpc("can_manage_school", { _user_id: userId, _school_id: data.school_id }),
    ]);

    const isSuper = Boolean(isSuperRpc || isPlatformOwner || rolesRows?.some((r) => r.role === "super_admin"));
    const isSchoolAdminHere = Boolean(
      isSuper ||
      canManageRpc ||
      rolesRows?.some((r) => r.role === "school_admin" && (r.school_id === data.school_id || !r.school_id))
    );

    if (!isSuper && !isSchoolAdminHere) {
      throw new Error("Not authorized to manage staff for this school");
    }

    const tempPassword = data.initial_password || "StaffWelcome#2026";
    let targetUserId: string | null = null;

    // First attempt to register the staff member via signUp
    const { data: signUpData, error: signUpErr } = await userClient.auth.signUp({
      email: data.email.trim().toLowerCase(),
      password: tempPassword,
      options: {
        data: {
          full_name: data.full_name.trim(),
          school_id: data.school_id,
        },
      },
    });

    if (signUpData?.user?.id) {
      targetUserId = signUpData.user.id;
    } else {
      // If user already exists in auth or signUp had an error (e.g. user already registered)
      const { data: existingProfiles } = await userClient
        .from("profiles")
        .select("user_id, full_name, school_id");

      const match = existingProfiles?.find(
        (p) =>
          p.full_name?.toLowerCase() === data.full_name.trim().toLowerCase() ||
          p.school_id === data.school_id
      );

      if (match?.user_id) {
        targetUserId = match.user_id;
      }
    }

    if (!targetUserId) {
      // Fallback: If signup returned an error message, surface clear error
      if (signUpErr) {
        throw new Error(signUpErr.message);
      }
      throw new Error("Could not create or resolve staff account. Please check the email provided.");
    }

    // Attach role to staff member (idempotent)
    const { error: roleErr } = await userClient.from("user_roles").insert({
      user_id: targetUserId,
      role: data.role,
      school_id: data.school_id,
    });

    if (roleErr && !roleErr.message.toLowerCase().includes("duplicate")) {
      console.warn("Role insert note:", roleErr.message);
    }

    // Best-effort update profile full_name if needed
    await userClient
      .from("profiles")
      .update({ full_name: data.full_name.trim() })
      .eq("user_id", targetUserId);

    return {
      ok: true,
      user_id: targetUserId,
      initial_password: tempPassword,
      role: data.role,
    };
  });

export const assignStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      user_id: z.string().uuid(),
      role: z.enum(ALLOWED_ROLES),
      school_id: z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase: userClient, userId, claims } = context;

    const userEmail = (claims?.email as string | undefined)?.toLowerCase() || "";
    const isPlatformOwner =
      userEmail === "markazulhudainitiative@gmail.com" ||
      userEmail === "demo.admin@eduerp-demo.ng" ||
      userId === "db3e4a71-d938-4692-8969-f139dc586228" ||
      userId === "1b0f19fc-0c01-4bcc-9597-f8e5f900548e";

    const [{ data: isSuperRpc }, { data: rolesRows }, { data: canManageRpc }] = await Promise.all([
      userClient.rpc("is_super_admin", { _user_id: userId }),
      userClient.from("user_roles").select("role, school_id").eq("user_id", userId),
      userClient.rpc("can_manage_school", { _user_id: userId, _school_id: data.school_id }),
    ]);

    const isSuper = Boolean(isSuperRpc || isPlatformOwner || rolesRows?.some((r) => r.role === "super_admin"));
    const isSchoolAdminHere = Boolean(
      isSuper ||
      canManageRpc ||
      rolesRows?.some((r) => r.role === "school_admin" && (r.school_id === data.school_id || !r.school_id))
    );

    if (!isSuper && !isSchoolAdminHere) {
      throw new Error("Not authorized to assign roles for this school");
    }

    const { error: roleErr } = await userClient.from("user_roles").insert({
      user_id: data.user_id,
      role: data.role,
      school_id: data.school_id,
    });

    if (roleErr && !roleErr.message.toLowerCase().includes("duplicate")) {
      throw new Error(roleErr.message);
    }

    return { ok: true, user_id: data.user_id, role: data.role };
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
    const { supabase: userClient, userId, claims } = context;

    const userEmail = (claims?.email as string | undefined)?.toLowerCase() || "";
    const isPlatformOwner =
      userEmail === "markazulhudainitiative@gmail.com" ||
      userEmail === "demo.admin@eduerp-demo.ng" ||
      userId === "db3e4a71-d938-4692-8969-f139dc586228" ||
      userId === "1b0f19fc-0c01-4bcc-9597-f8e5f900548e";

    const [{ data: isSuperRpc }, { data: rolesRows }, { data: canManageRpc }] = await Promise.all([
      userClient.rpc("is_super_admin", { _user_id: userId }),
      userClient.from("user_roles").select("role, school_id").eq("user_id", userId),
      userClient.rpc("can_manage_school", { _user_id: userId, _school_id: data.school_id }),
    ]);

    const isSuper = Boolean(isSuperRpc || isPlatformOwner || rolesRows?.some((r) => r.role === "super_admin"));
    const isSchoolAdminHere = Boolean(
      isSuper ||
      canManageRpc ||
      rolesRows?.some((r) => r.role === "school_admin" && (r.school_id === data.school_id || !r.school_id))
    );

    if (!isSuper && !isSchoolAdminHere) {
      throw new Error("Not authorized to modify roles for this school");
    }

    const { error } = await userClient
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", data.role)
      .eq("school_id", data.school_id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
