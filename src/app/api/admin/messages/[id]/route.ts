import { NextRequest } from 'next/server';
import { requireAdminUser, isUuid, jsonError } from '@/lib/admin-auth';
import { noStoreJson } from '@/lib/response';
import { createServiceRoleSupabaseClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminUser();
  if ('response' in auth) {
    return auth.response;
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return jsonError('Message ID tidak valid');
  }

  try {
    const body = await request.json();
    const text = typeof body.text === 'string' ? body.text.trim() : '';

    if (!text || text.length > 500) {
      return jsonError('Pesan harus diisi dan maksimal 500 karakter');
    }

    const supabase = createServiceRoleSupabaseClient();
    const { error } = await supabase
      .from('messages')
      .update({ text })
      .eq('id', id);

    if (error) {
      return jsonError(error.message, 500);
    }

    return noStoreJson({
      success: true,
      message: 'Pesan diperbarui',
    });
  } catch (error) {
    console.error('Admin message PATCH error:', error);
    return jsonError('Internal server error', 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminUser();
  if ('response' in auth) {
    return auth.response;
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return jsonError('Message ID tidak valid');
  }

  try {
    const supabase = createServiceRoleSupabaseClient();
    const { error } = await supabase.from('messages').delete().eq('id', id);

    if (error) {
      return jsonError(error.message, 500);
    }

    return noStoreJson({
      success: true,
      message: 'Pesan dihapus',
    });
  } catch (error) {
    console.error('Admin message DELETE error:', error);
    return jsonError('Internal server error', 500);
  }
}
