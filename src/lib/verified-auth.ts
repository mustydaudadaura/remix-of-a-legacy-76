import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Fail closed: unavailable configuration or failed verification never grants access.
export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error('Sign-in service is not configured.');
    const header = getRequest().headers.get('authorization') ?? '';
    if (!header.startsWith('Bearer ')) throw new Error('Unauthorized');
    const token = header.slice(7);
    const supabase = createClient<Database>(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) throw new Error('Unauthorized: Invalid session');
    return next({ context: { supabase, userId: data.claims.sub, claims: data.claims } });
  },
);