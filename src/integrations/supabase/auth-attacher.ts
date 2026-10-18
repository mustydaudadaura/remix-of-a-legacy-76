import { createMiddleware } from '@tanstack/react-start';
import { supabase } from './client';
import { isDemoAdminActive } from '@/hooks/useAuth';

// Must be registered as a global `functionMiddleware` in `src/start.ts`; otherwise
// the browser never attaches the bearer token to serverFn RPCs.
export const attachSupabaseAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    let token: string | undefined;
    try {
      const { data } = await supabase.auth.getSession();
      token = data?.session?.access_token;
    } catch {
      // offline session check
    }

    if (!token && typeof window !== "undefined" && isDemoAdminActive()) {
      token = "demo-admin-bearer-token";
    }

    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
