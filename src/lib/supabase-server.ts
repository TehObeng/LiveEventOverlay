import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { isE2EMockModeEnabled } from './e2e-config';
import { createMockServiceRoleClient } from './mock-backend';
import { ServiceRoleSupabaseClientLike } from './supabase-like';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDatabase = any;

function hasBaseSupabaseConfig() {
  return supabaseUrl.startsWith('http') && supabaseAnonKey.length > 20;
}

export function hasServiceRoleConfig() {
  return hasBaseSupabaseConfig() && supabaseServiceRoleKey.length > 20;
}

export async function createRouteHandlerSupabaseClient() {
  if (!hasBaseSupabaseConfig()) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const cookieStore = await cookies();

  return createServerClient<AnyDatabase>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          try {
            cookieStore.set({
              name: cookie.name,
              value: cookie.value,
              ...cookie.options,
            });
          } catch {
            // Ignore cookie write failures in contexts where the response is immutable.
          }
        }
      },
    },
  });
}

export function createServiceRoleSupabaseClient(): ServiceRoleSupabaseClientLike {
  if (isE2EMockModeEnabled()) {
    return createMockServiceRoleClient();
  }

  if (!hasServiceRoleConfig()) {
    throw new Error('SUPABASE_SERVICE_ROLE_NOT_CONFIGURED');
  }

  return createClient<AnyDatabase>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as unknown as ServiceRoleSupabaseClientLike;
}
