import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, hasRole, isDemoAdminActive } from '@/hooks/useAuth';
import { SCHOOL_PERMISSIONS, type SchoolPermission } from '@/lib/school-access';

export function useSchoolAccess() {
  const { user, schoolId, roles } = useAuth();
  const isAdmin = isDemoAdminActive() || hasRole(roles, 'super_admin', 'school_admin');

  const query = useQuery({
    queryKey: ['school-access', user?.id, schoolId, isAdmin],
    enabled: Boolean(user && schoolId),
    queryFn: async () => {
      if (!user || !schoolId) return [];
      if (isAdmin) return [...SCHOOL_PERMISSIONS];

      try {
        const rows = await Promise.all(
          SCHOOL_PERMISSIONS.map(async (permission) => {
            try {
              const { data, error } = await supabase.rpc('school_permission', {
                _user_id: user.id,
                _school_id: schoolId,
                _permission: permission,
              });
              if (error) return isAdmin ? permission : null;
              return data ? permission : null;
            } catch {
              return isAdmin ? permission : null;
            }
          })
        );
        return rows.filter((p): p is SchoolPermission => p !== null);
      } catch {
        return isAdmin ? [...SCHOOL_PERMISSIONS] : [];
      }
    },
  });

  return {
    schoolId,
    loading: query.isPending && Boolean(schoolId) && !isAdmin,
    error: query.error,
    can: (permission: SchoolPermission) =>
      isAdmin || (query.data?.includes(permission) ?? false),
  };
}