import { isE2EMockModeEnabled } from './e2e-config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export type LiveDataBackend = 'local' | 'supabase';

function hasPublicSupabaseConfig() {
  return supabaseUrl.startsWith('http') && supabaseAnonKey.length > 20;
}

export function getLiveDataBackend(): LiveDataBackend {
  const configured = process.env.LIVE_DATA_BACKEND?.trim().toLowerCase();

  if (configured === 'local' || configured === 'supabase') {
    return configured;
  }

  return 'local';
}

export function isLocalDataBackend() {
  return getLiveDataBackend() === 'local';
}

export function canUseSupabaseAuth() {
  return hasPublicSupabaseConfig() && !isE2EMockModeEnabled();
}
