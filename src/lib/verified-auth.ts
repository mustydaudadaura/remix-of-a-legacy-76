import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { supabase as clientSupabase } from '@/integrations/supabase/client';

export const requireSupabaseAuth = createMiddleware({ type: 'function' })
  .client(async ({ next }) => {
    // When invoked from the browser, fetch the active session access token
    const { data } = await clientSupabase.auth.getSession();
    const token = data.session?.access_token;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  })
  .server(async ({ next }) => {
    const url =
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL);
    const key =
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY);

    if (!url || !key) {
      throw new Error('Sign-in service is not configured. Please check environment variables.');
    }

    const header = getRequest().headers.get('authorization') ?? '';
    if (!header.startsWith('Bearer ')) {
      throw new Error('Unauthorized: Please sign in to continue.');
    }

    const token = header.slice(7).trim();
    if (!token) {
      throw new Error('Unauthorized: Session token is missing.');
    }

    const supabase = createClient<Database>(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) {
      // Fallback: try getUser with the token
      const userRes = await supabase.auth.getUser(token);
      if (userRes.error || !userRes.data?.user?.id) {
        throw new Error('Unauthorized: Session has expired. Please sign in again.');
      }
      const user = userRes.data.user;
      return next({
        context: {
          supabase,
          userId: user.id,
          claims: { sub: user.id, email: user.email, role: 'authenticated' } as any,
        },
      });
    }

    return next({ context: { supabase, userId: data.claims.sub, claims: data.claims } });
  });