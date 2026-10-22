import { createMiddleware } from '@tanstack/react-start';
import { supabase } from './client';

// Must be registered as a global `functionMiddleware` in `src/start.ts`; otherwise
// the browser never attaches the bearer token to serverFn RPCs.
export const attachSupabaseAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    let token: string | undefined;
    try {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token;
    } catch {
      void 0;
    }

    if (!token && typeof window !== 'undefined') {
      try {
        const stored =
          localStorage.getItem('sb-placeholder-auth-token') ||
          localStorage.getItem('sb-placeholder-key-auth-token');
        if (stored) {
          const parsed = JSON.parse(stored);
          token = parsed?.access_token;
        }
      } catch {
        void 0;
      }
    }

    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
