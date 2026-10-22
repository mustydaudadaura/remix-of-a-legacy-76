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
        let sess = data.session;
        if (!sess && typeof window !== "undefined") {
          try {
            const stored =
              localStorage.getItem("sb-placeholder-auth-token") ||
              localStorage.getItem("sb-placeholder-key-auth-token");
            if (stored) {
              const parsed = JSON.parse(stored);
              if (parsed?.access_token && parsed?.user) {
                sess = parsed;
              }
            }
          } catch {
            void 0;
          }
        }
        setSession(sess);
        if (sess?.user) {
          await loadProfile(sess.user.id, sess.user);
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
    const userEmail = (userObj?.email || session?.user?.email || "").toLowerCase();
    const isPlatformOwner = userEmail === "mustydawuddaura@gmail.com";

    try {
      const [profileResult, roleResult] = await Promise.all([
        supabase.from("profiles").select("full_name, school_id").eq("user_id", userId).maybeSingle(),
        supabase.from("user_roles").select("role, school_id").eq("user_id", userId),
      ]);

      let fetchedRoles = roleResult.data?.map((r) => r.role) ?? [];

      if (isPlatformOwner) {
        if (!fetchedRoles.includes("super_admin")) {
          fetchedRoles = ["super_admin", ...fetchedRoles];
        }
      }

      // School isolation: Only Super Admin can switch schools via selected school key
      const selected = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_SCHOOL_KEY) : null;
      const isSuper = fetchedRoles.includes("super_admin");
      let targetSchoolId =
        profileResult.data?.school_id ||
        roleResult.data?.find((r) => r.school_id)?.school_id ||
        null;

      // If school administrator or super admin has no school assigned yet, fallback to default school
      if (!targetSchoolId && (fetchedRoles.includes("school_admin") || isSuper)) {
        const { data: firstSchool } = await supabase.from("schools").select("id").limit(1).maybeSingle();
        if (firstSchool?.id) {
          targetSchoolId = firstSchool.id;
        } else {
          targetSchoolId = "af91ff67-95eb-4b62-93a0-5617d23a2f1d";
        }
      }

      setFullName(profileResult.data?.full_name ?? (isPlatformOwner ? "Musty Dawud Daura" : null));
      setSchoolId(
        isSuper && selected
          ? selected
          : targetSchoolId || "af91ff67-95eb-4b62-93a0-5617d23a2f1d"
      );
      setRoles(fetchedRoles.length ? fetchedRoles : (isPlatformOwner ? ["super_admin"] : []));
    } catch (err) {
      console.warn("Could not fetch remote profile:", err);
      if (isPlatformOwner) {
        setRoles(["super_admin"]);
        setFullName("Musty Dawud Daura");
        const selected = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_SCHOOL_KEY) : null;
        setSchoolId(selected || "af91ff67-95eb-4b62-93a0-5617d23a2f1d");
      } else {
        setRoles([]);
        setFullName(null);
        setSchoolId(null);
      }
    }
  };

  return { user: session?.user ?? null, session, loading, roles, schoolId, fullName };
}

export const hasRole = (roles: AppRole[], ...check: AppRole[]) =>
  roles.some((r) => check.includes(r));
