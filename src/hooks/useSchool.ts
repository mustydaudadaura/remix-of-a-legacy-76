import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { applyAppTheme } from "@/lib/theme";

/** The active school row (name, code, current session and term) for the signed-in account. */
export function useSchool() {
  const { schoolId } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["school-profile", schoolId],
    queryFn: async () => (await supabase.from("schools")
      .select("id, name, code, address, current_session, current_term, logo_url, theme_color")
      .eq("id", schoolId!).maybeSingle()).data,
    enabled: !!schoolId,
  });

  useEffect(() => {
    if (data?.theme_color) {
      applyAppTheme(data.theme_color);
    }
  }, [data?.theme_color]);

  return { school: data ?? null, loading: isLoading && !!schoolId };
}
