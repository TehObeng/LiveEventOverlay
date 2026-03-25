export const DEFAULT_E2E_EVENT_ID = '11111111-1111-4111-8111-111111111111';
export const DEFAULT_E2E_ADMIN_EMAIL = 'admin@example.com';
export const DEFAULT_E2E_ADMIN_PASSWORD = 'codex-password-123';
export const MOCK_SESSION_COOKIE = 'live-chat-admin-session';

export function isE2EMockModeEnabled() {
  return (
    process.env.NEXT_PUBLIC_E2E_MOCK_BACKEND === '1' ||
    process.env.E2E_USE_MOCK_BACKEND === '1'
  );
}

export function getE2EEventId() {
  return process.env.NEXT_PUBLIC_E2E_EVENT_ID || DEFAULT_E2E_EVENT_ID;
}

export function getE2EEventName() {
  return process.env.E2E_EVENT_NAME || 'Codex Demo Night';
}

export function getE2EAdminEmail() {
  return process.env.E2E_ADMIN_EMAIL || DEFAULT_E2E_ADMIN_EMAIL;
}

export function getE2EAdminPassword() {
  return process.env.E2E_ADMIN_PASSWORD || DEFAULT_E2E_ADMIN_PASSWORD;
}
