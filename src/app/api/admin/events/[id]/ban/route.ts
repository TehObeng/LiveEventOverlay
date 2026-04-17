import { NextRequest } from 'next/server';
import { requireAdminUser, isUuid, jsonError } from '@/lib/admin-auth';
import { noStoreJson } from '@/lib/response';
import { createServiceRoleSupabaseClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminUser();
  if ('response' in auth) {
    return auth.response;
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return jsonError('Event ID tidak valid');
  }

  try {
    const body = await request.json();
    const ipHash = typeof body.ipHash === 'string' ? body.ipHash.trim() : '';

    if (!ipHash) {
      return jsonError('ipHash wajib diisi');
    }

    const supabase = createServiceRoleSupabaseClient();
    const { error } = await supabase
      .from('messages')
      .update({
        is_banned: true,
        status: 'rejected',
        approved_at: null,
        approved_by: null,
      })
      .eq('event_id', id)
      .eq('ip_hash', ipHash);

    if (error) {
      return jsonError(error.message, 500);
    }

    return noStoreJson({
      success: true,
      message: 'Pengirim berhasil di-ban',
    });
  } catch (error) {
    console.error('Admin ban sender error:', error);
    return jsonError('Internal server error', 500);
  }
}
