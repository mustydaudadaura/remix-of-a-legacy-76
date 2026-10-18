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

export const DEMO_ADMIN_KEY = "eduerp_demo_admin";

export const DEMO_ADMIN_USER: User = {
  id: "00000000-0000-0000-0000-000000000001",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Mallam Mustapha Dauda", role: "school_admin" },
  aud: "authenticated",
  created_at: "2026-01-01T00:00:00.000Z",
  email: "demo.admin@eduerp-demo.ng",
  phone: "",
  role: "authenticated",
  updated_at: "2026-01-01T00:00:00.000Z",
};

export const DEMO_ADMIN_SESSION: Session = {
  access_token: "demo-admin-bearer-token",
  refresh_token: "demo-admin-refresh-token",
  expires_in: 360000,
  token_type: "bearer",
  user: DEMO_ADMIN_USER,
};

export function setDemoAdminSession() {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_ADMIN_KEY, "true");
  window.dispatchEvent(new Event("eduerp-auth-change"));
}

export function clearDemoAdminSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DEMO_ADMIN_KEY);
  window.dispatchEvent(new Event("eduerp-auth-change"));
}

// The offline "fake admin" session had no real sign-in token, so the database
// silently hid every record. Always use a real sign-in instead.
export function isDemoAdminActive(): boolean {
  if (typeof window === "undefined") return false;
  localStorage.removeItem(DEMO_ADMIN_KEY);
  return false;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    // Check if demo admin session is active
    if (isDemoAdminActive()) {
      setSession(DEMO_ADMIN_SESSION);
      setFullName("Mallam Mustapha Dauda (Admin)");
      setRoles(["super_admin", "school_admin"]);
      const selected = localStorage.getItem(ACTIVE_SCHOOL_KEY);
      setSchoolId(selected || "22222222-2222-2222-2222-222222222222");
      setLoading(false);
    }

    const onAuthChange = () => {
      if (isDemoAdminActive()) {
        setSession(DEMO_ADMIN_SESSION);
        setFullName("Mallam Mustapha Dauda (Admin)");
        setRoles(["super_admin", "school_admin"]);
        const selected = localStorage.getItem(ACTIVE_SCHOOL_KEY);
        setSchoolId(selected || "22222222-2222-2222-2222-222222222222");
        setLoading(false);
      } else {
        checkRemoteSession();
      }
    };

    const checkRemoteSession = () => {
      if (isDemoAdminActive()) return;
      supabase.auth.getSession().then(async ({ data }) => {
        setSession(data.session);
        if (data.session?.user) {
          await loadProfile(data.session.user.id);
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
        if (isDemoAdminActive()) return;
        setSession(s);
        if (s?.user) {
          setTimeout(() => loadProfile(s.user.id), 0);
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
      if (isDemoAdminActive()) {
        const selected = localStorage.getItem(ACTIVE_SCHOOL_KEY);
        setSchoolId(selected || "22222222-2222-2222-2222-222222222222");
        return;
      }
      supabase.auth.getUser().then(({ data }) => { if (data.user) loadProfile(data.user.id); }).catch(() => {});
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

  const loadProfile = async (userId: string) => {
    try {
      const [{ data: prof }, { data: rolesData }] = await Promise.all([
        supabase.from("profiles").select("full_name, school_id").eq("user_id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      setFullName(prof?.full_name ?? null);
      const isSuper = rolesData?.some((r) => r.role === "super_admin");
      const selected = localStorage.getItem(ACTIVE_SCHOOL_KEY);
      setSchoolId(isSuper && selected ? selected : prof?.school_id ?? null);
      setRoles((rolesData?.map((r) => r.role as AppRole)) ?? []);
    } catch (err) {
      console.warn("Could not fetch remote profile:", err);
      setRoles([]);
      setSchoolId(null);
    }
  };

  return { user: session?.user ?? null, session, loading, roles, schoolId, fullName };
}

export const hasRole = (roles: AppRole[], ...check: AppRole[]) =>
  roles.some((r) => check.includes(r));
