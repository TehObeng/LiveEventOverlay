'use client';

import { withBasePath } from '@/lib/url';
import { BrowserSupabaseClientLike, BrowserUserLike, BrowserSessionLike } from '@/lib/supabase-like';

type AuthChangeEvent = 'SIGNED_IN' | 'SIGNED_OUT';

type AuthListener = (event: AuthChangeEvent, session: BrowserSessionLike | null) => void;

const listeners = new Set<AuthListener>();
const MOCK_BROWSER_SESSION_KEY = 'live-chat-mock-admin-user';

async function readJson(path: string, init?: RequestInit) {
  const response = await fetch(withBasePath(path), {
    ...init,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; user?: { userId: string; email: string | null } }
    | null;

  return {
    ok: response.ok,
    payload,
  };
}

function notify(event: AuthChangeEvent, user: BrowserUserLike | null) {
  const session = user ? { user } : null;
  listeners.forEach((listener) => listener(event, session));
}

function readStoredUser(): BrowserUserLike | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(MOCK_BROWSER_SESSION_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { id?: string; email?: string | null } | null;
    if (!parsed?.id) {
      return null;
    }

    return {
      id: parsed.id,
      email: parsed.email ?? null,
    };
  } catch {
    return null;
  }
}

function writeStoredUser(user: BrowserUserLike | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!user) {
    window.localStorage.removeItem(MOCK_BROWSER_SESSION_KEY);
    return;
  }

  window.localStorage.setItem(MOCK_BROWSER_SESSION_KEY, JSON.stringify(user));
}

export function createMockBrowserSupabaseClient(): BrowserSupabaseClientLike {
  return {
    auth: {
      async getUser() {
        const storedUser = readStoredUser();
        if (!storedUser) {
          return {
            data: { user: null },
            error: null,
          };
        }

        return {
          data: {
            user: storedUser,
          },
          error: null,
        };
      },
      async signInWithPassword(credentials: { email: string; password: string }) {
        const response = await readJson('/api/admin/session', {
          method: 'POST',
          body: JSON.stringify(credentials),
        });

        if (!response.ok || !response.payload?.user) {
          return {
            data: { user: null, session: null },
            error: { message: response.payload?.error || 'Unauthorized' },
          };
        }

        const user = {
          id: response.payload.user.userId,
          email: response.payload.user.email,
        };
        writeStoredUser(user);
        notify('SIGNED_IN', user);
        return {
          data: { user, session: { user } },
          error: null,
        };
      },
      async signOut() {
        await readJson('/api/admin/session', {
          method: 'DELETE',
        });
        writeStoredUser(null);
        notify('SIGNED_OUT', null);
        return { error: null };
      },
      onAuthStateChange(listener: AuthListener) {
        listeners.add(listener);
        return {
          data: {
            subscription: {
              unsubscribe() {
                listeners.delete(listener);
              },
            },
          },
        };
      },
    },
  };
}
