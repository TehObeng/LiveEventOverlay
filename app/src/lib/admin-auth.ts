import 'server-only';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isE2EMockModeEnabled, MOCK_SESSION_COOKIE } from './e2e-config';
import { getMockAdminUserFromCookie } from './mock-backend';
import { createRouteHandlerSupabaseClient, createServiceRoleSupabaseClient } from './supabase-server';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireAdminUser() {
  if (isE2EMockModeEnabled()) {
    const cookieStore = await cookies();
    const user = getMockAdminUserFromCookie(cookieStore.get(MOCK_SESSION_COOKIE)?.value);

    if (!user) {
      return { response: jsonError('Unauthorized', 401) };
    }

    return {
      user,
    };
  }

  try {
    const supabase = await createRouteHandlerSupabaseClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return { response: jsonError('Unauthorized', 401) };
    }

    const serviceClient = createServiceRoleSupabaseClient();
    const { data: adminUser, error: adminError } = await serviceClient
      .from('admin_users')
      .select('user_id')
      .eq('user_id', data.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (adminError) {
      if (adminError.code === '42P01') {
        return { response: jsonError('Admin table belum tersedia. Jalankan migrasi schema terbaru.', 500) };
      }

      return { response: jsonError('Gagal memverifikasi akses admin', 500) };
    }

    if (!adminUser) {
      return { response: jsonError('Forbidden', 403) };
    }

    return {
      user: data.user,
    };
  } catch (error) {
    console.error('Admin auth error:', error);
    return { response: jsonError('Konfigurasi autentikasi belum lengkap', 500) };
  }
}
