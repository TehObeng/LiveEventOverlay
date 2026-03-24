// ============================================
// Supabase Client Configuration
// ============================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDatabase = any;

// Check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  return (
    supabaseUrl.startsWith('http') &&
    supabaseAnonKey.length > 20
  );
}

// Browser client (singleton for client components)
let browserClient: ReturnType<typeof createClient<AnyDatabase>> | null = null;

export function createBrowserClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }
  if (browserClient) return browserClient;
  browserClient = createClient<AnyDatabase>(supabaseUrl, supabaseAnonKey);
  return browserClient;
}

// Server client (for API routes — creates fresh instance each time)
export function createServerSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }
  return createClient<AnyDatabase>(supabaseUrl, supabaseAnonKey);
}
