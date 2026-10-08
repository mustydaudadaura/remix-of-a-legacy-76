import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** The active school row (name, code, current session and term) for the signed-in account. */
export function useSchool() {
  const { schoolId } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["school-profile", schoolId],
    queryFn: async () => (await supabase.from("schools")
      .select("id, name, code, address, current_session, current_term, logo_url")
      .eq("id", schoolId!).maybeSingle()).data,
    enabled: !!schoolId,
  });
  return { school: data ?? null, loading: isLoading && !!schoolId };
}
