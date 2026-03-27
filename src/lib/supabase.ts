// ============================================
// Browser Supabase Client Configuration
// Auth/session only. Data access should use server routes.
// ============================================

import { createBrowserClient } from '@supabase/ssr';
import { isE2EMockModeEnabled } from '@/lib/e2e-config';
import { createMockBrowserSupabaseClient } from '@/lib/mock-browser-auth';
import { BrowserSupabaseClientLike } from '@/lib/supabase-like';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDatabase = any;

export function isSupabaseConfigured(): boolean {
  return isE2EMockModeEnabled() || (supabaseUrl.startsWith('http') && supabaseAnonKey.length > 20);
}

export function getSupabaseConfigError() {
  return 'Supabase belum dikonfigurasi. Tambahkan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, dan SUPABASE_SERVICE_ROLE_KEY.';
}

export function isSupabaseSessionMissingError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { name?: string; message?: string };
  return (
    candidate.name === 'AuthSessionMissingError' ||
    candidate.message === 'Auth session missing!'
  );
}

let browserClient: ReturnType<typeof createBrowserClient<AnyDatabase>> | null = null;

export function getBrowserSupabaseClient(): BrowserSupabaseClientLike {
  if (isE2EMockModeEnabled()) {
    return createMockBrowserSupabaseClient();
  }

  if (!isSupabaseConfigured()) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  if (typeof window === 'undefined') {
    throw new Error('SUPABASE_BROWSER_ONLY');
  }

  if (browserClient) {
    return browserClient;
  }

  browserClient = createBrowserClient<AnyDatabase>(supabaseUrl, supabaseAnonKey, {
    isSingleton: true,
  });

  return browserClient as unknown as BrowserSupabaseClientLike;
}
