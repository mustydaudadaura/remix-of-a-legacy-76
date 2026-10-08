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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setRoles([]); setSchoolId(null); setFullName(null);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    });
    const refresh = () => { supabase.auth.getUser().then(({ data }) => { if (data.user) loadProfile(data.user.id); }); };
    window.addEventListener("school-selection", refresh);
    return () => { subscription.unsubscribe(); window.removeEventListener("school-selection", refresh); };
  }, []);

  const loadProfile = async (userId: string) => {
    const [{ data: prof }, { data: rolesData }] = await Promise.all([
      supabase.from("profiles").select("full_name, school_id").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setFullName(prof?.full_name ?? null);
    const isSuper = rolesData?.some((r) => r.role === "super_admin");
    const selected = localStorage.getItem(ACTIVE_SCHOOL_KEY);
    setSchoolId(isSuper && selected ? selected : prof?.school_id ?? null);
    setRoles((rolesData?.map((r) => r.role as AppRole)) ?? []);
  };

  return { user: session?.user ?? null, session, loading, roles, schoolId, fullName };
}

export const hasRole = (roles: AppRole[], ...check: AppRole[]) =>
  roles.some((r) => check.includes(r));
