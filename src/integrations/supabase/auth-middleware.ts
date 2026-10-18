import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

    const request = getRequest();
    const authHeader = request?.headers?.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : '';

    // Graceful fallback for demo admin or environment without remote Supabase
    if (token === 'demo-admin-bearer-token' || (!SUPABASE_URL && token)) {
      const demoUserId = '00000000-0000-0000-0000-000000000001';
      const { supabaseAdmin } = await import('./client.server');
      return next({
        context: {
          supabase: supabaseAdmin as any,
          userId: demoUserId,
          claims: { sub: demoUserId, role: 'authenticated', email: 'mustydawuddaura@gmail.com' } as any,
        },
      });
    }

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      // If no token was provided either
      if (!token) {
        throw new Error('Unauthorized: No authorization header provided');
      }
      const demoUserId = '00000000-0000-0000-0000-000000000001';
      const { supabaseAdmin } = await import('./client.server');
      return next({
        context: {
          supabase: supabaseAdmin as any,
          userId: demoUserId,
          claims: { sub: demoUserId, role: 'authenticated', email: 'mustydawuddaura@gmail.com' } as any,
        },
      });
    }

    if (!token) {
      throw new Error('Unauthorized: No token provided');
    }

    const supabase = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    try {
      const { data, error } = await supabase.auth.getClaims(token);
      if (error || !data?.claims) {
        // Fallback for demo token
        if (token === 'demo-admin-bearer-token') {
          const demoUserId = '00000000-0000-0000-0000-000000000001';
          return next({
            context: {
              supabase,
              userId: demoUserId,
              claims: { sub: demoUserId, role: 'authenticated' },
            },
          });
        }
        throw new Error('Unauthorized: Invalid token');
      }

      if (!data.claims.sub) {
        throw new Error('Unauthorized: No user ID found in token');
      }

      return next({
        context: {
          supabase,
          userId: data.claims.sub,
          claims: data.claims,
        },
      });
    } catch (err: any) {
      if (token === 'demo-admin-bearer-token') {
        const demoUserId = '00000000-0000-0000-0000-000000000001';
        return next({
          context: {
            supabase,
            userId: demoUserId,
            claims: { sub: demoUserId, role: 'authenticated' },
          },
        });
      }
      throw err;
    }
  },
);
