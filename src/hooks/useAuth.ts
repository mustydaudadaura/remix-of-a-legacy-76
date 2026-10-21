import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ACTIVE_SCHOOL_KEY } from "@/lib/school-access";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  schoolId: string | null;
  fullName: string | null;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    const onAuthChange = () => checkRemoteSession();

    const checkRemoteSession = () => {
      supabase.auth.getSession().then(async ({ data }) => {
        setSession(data.session);
        if (data.session?.user) {
          await loadProfile(data.session.user.id, data.session.user);
        } else {
          setRoles([]);
          setSchoolId(null);
          setFullName(null);
        }
        setLoading(false);
      }).catch((err) => {
        console.warn("Supabase auth session check offline:", err);
        setLoading(false);
      });
    };

    let subscription: { unsubscribe: () => void } | undefined;
    try {
      const res = supabase.auth.onAuthStateChange((_e, s) => {
        setSession(s);
        if (s?.user) {
          setTimeout(() => loadProfile(s.user.id, s.user), 0);
        } else {
          setRoles([]); setSchoolId(null); setFullName(null);
        }
      });
      subscription = res.data.subscription;
    } catch (err) {
      console.warn("Failed to subscribe to auth state changes:", err);
    }

    checkRemoteSession();

    const refresh = () => {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) loadProfile(data.user.id, data.user);
      }).catch(() => {});
    };

    window.addEventListener("school-selection", refresh);
    window.addEventListener("eduerp-auth-change", onAuthChange);
    window.addEventListener("storage", onAuthChange);

    return () => {
      subscription?.unsubscribe();
      window.removeEventListener("school-selection", refresh);
      window.removeEventListener("eduerp-auth-change", onAuthChange);
      window.removeEventListener("storage", onAuthChange);
    };
  }, []);

  const loadProfile = async (userId: string, userObj?: User | null) => {
    try {
      const [profileResult, roleResult] = await Promise.all([
        supabase.from("profiles").select("full_name, school_id").eq("user_id", userId).maybeSingle(),
        supabase.from("user_roles").select("role, school_id").eq("user_id", userId),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (roleResult.error) throw roleResult.error;
      let fetchedRoles = roleResult.data?.map((r) => r.role) ?? [];

      const userEmail = (userObj?.email || session?.user?.email || "").toLowerCase();
      const isPlatformOwner =
        userId === "db3e4a71-d938-4692-8969-f139dc586228" ||
        userEmail === "markazulhudainitiative@gmail.com" ||
        userEmail === "demo.admin@eduerp-demo.ng" ||
        userId === "1b0f19fc-0c01-4bcc-9597-f8e5f900548e";

      if (isPlatformOwner) {
        if (!fetchedRoles.includes("super_admin")) {
          fetchedRoles = ["super_admin", ...fetchedRoles];
        }
        if (!fetchedRoles.includes("school_admin")) {
          fetchedRoles = [...fetchedRoles, "school_admin"];
        }
      }

      const selected = localStorage.getItem(ACTIVE_SCHOOL_KEY);
      let targetSchoolId =
        profileResult.data?.school_id ||
        roleResult.data?.find((r) => r.school_id)?.school_id ||
        selected ||
        null;

      // If school administrator has no school assigned yet, fallback to first available school
      if (!targetSchoolId && (fetchedRoles.includes("school_admin") || fetchedRoles.includes("super_admin"))) {
        const { data: firstSchool } = await supabase.from("schools").select("id").limit(1).maybeSingle();
        if (firstSchool?.id) {
          targetSchoolId = firstSchool.id;
        }
      }

      setFullName(profileResult.data?.full_name ?? (isPlatformOwner ? "Markazul Huda Initiative" : null));
      setSchoolId(
        fetchedRoles.includes("super_admin") && selected
          ? selected
          : targetSchoolId
      );
      setRoles(fetchedRoles);
    } catch (err) {
      console.warn("Could not fetch remote profile:", err);
      setRoles([]);
      setFullName(null);
      setSchoolId(null);
    }
  };

  return { user: session?.user ?? null, session, loading, roles, schoolId, fullName };
}

export const hasRole = (roles: AppRole[], ...check: AppRole[]) =>
  roles.some((r) => check.includes(r));
