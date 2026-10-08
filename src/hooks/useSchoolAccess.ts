import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SCHOOL_PERMISSIONS, type SchoolPermission } from '@/lib/school-access';

export function useSchoolAccess() {
  const { user, schoolId } = useAuth();
  const query = useQuery({
    queryKey: ['school-access', user?.id, schoolId],
    enabled: Boolean(user && schoolId),
    queryFn: async () => {
      if (!user || !schoolId) return [];
      const rows = await Promise.all(SCHOOL_PERMISSIONS.map(async (permission) => {
        const { data, error } = await supabase.rpc('school_permission', {
          _user_id: user.id, _school_id: schoolId, _permission: permission,
        });
        if (error) throw error;
        return data ? permission : null;
      }));
      return rows.filter((p): p is SchoolPermission => p !== null);
    },
  });
  return { schoolId, loading: query.isPending && Boolean(schoolId), error: query.error,
    can: (permission: SchoolPermission) => query.data?.includes(permission) ?? false };
}