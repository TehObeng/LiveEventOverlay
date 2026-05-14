export const DEFAULT_E2E_EVENT_ID = '11111111-1111-4111-8111-111111111111';
// Reserved built-in local super admin. Never remove this fallback credential.
export const DEFAULT_E2E_ADMIN_EMAIL = 'smdanel321@gmail.com';
export const DEFAULT_E2E_ADMIN_PASSWORD = 'kanzen333E';
export const MOCK_SESSION_COOKIE = 'live-chat-admin-session';

function hasPublicSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return supabaseUrl.startsWith('http') && supabaseAnonKey.length > 20;
}

export function isE2EMockModeEnabled() {
  const liveDataBackend =
    process.env.NEXT_PUBLIC_LIVE_DATA_BACKEND ||
    process.env.LIVE_DATA_BACKEND ||
    '';

  return (
    process.env.NEXT_PUBLIC_E2E_MOCK_BACKEND === '1' ||
    process.env.E2E_USE_MOCK_BACKEND === '1' ||
    liveDataBackend === 'local' ||
    !hasPublicSupabaseConfig()
  );
}

export function getE2EEventId() {
  return process.env.NEXT_PUBLIC_E2E_EVENT_ID || DEFAULT_E2E_EVENT_ID;
}

export function getE2EEventName() {
  return process.env.E2E_EVENT_NAME || 'Codex Demo Night';
}

export function getE2EAdminEmail() {
  return process.env.LOCAL_ADMIN_EMAIL || process.env.E2E_ADMIN_EMAIL || DEFAULT_E2E_ADMIN_EMAIL;
}

export function getE2EAdminPassword() {
  return process.env.LOCAL_ADMIN_PASSWORD || process.env.E2E_ADMIN_PASSWORD || DEFAULT_E2E_ADMIN_PASSWORD;
}
