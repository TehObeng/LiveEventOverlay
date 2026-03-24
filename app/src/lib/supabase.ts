// ============================================
// Browser Supabase Client Configuration
// Auth/session only. Data access should use server routes.
// ============================================

import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDatabase = any;

export function isSupabaseConfigured(): boolean {
  return supabaseUrl.startsWith('http') && supabaseAnonKey.length > 20;
}

export function getSupabaseConfigError() {
  return 'Supabase belum dikonfigurasi. Tambahkan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, dan SUPABASE_SERVICE_ROLE_KEY.';
}

let browserClient: ReturnType<typeof createBrowserClient<AnyDatabase>> | null = null;

export function getBrowserSupabaseClient() {
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

  return browserClient;
}
