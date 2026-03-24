import 'server-only';

import { NextResponse } from 'next/server';
import { createRouteHandlerSupabaseClient } from './supabase-server';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireAdminUser() {
  try {
    const supabase = await createRouteHandlerSupabaseClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return { response: jsonError('Unauthorized', 401) };
    }

    return {
      user: data.user,
    };
  } catch (error) {
    console.error('Admin auth error:', error);
    return { response: jsonError('Konfigurasi autentikasi belum lengkap', 500) };
  }
}
