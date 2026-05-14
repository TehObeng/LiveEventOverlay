import { NextRequest } from 'next/server';
import { requireAdminUser, isUuid, jsonError } from '@/lib/admin-auth';
import { rememberRejectedPhrase } from '@/lib/moderation-memory';
import { noStoreJson } from '@/lib/response';
import { createServiceRoleSupabaseClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(
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
    const { data: messageRow, error: messageError } = await supabase
      .from('messages')
      .select('text')
      .eq('id', id)
      .maybeSingle();

    if (messageError) {
      return jsonError(messageError.message, 500);
    }

    const message = messageRow as { text?: string } | null;
    const { error } = await supabase
      .from('messages')
      .update({
        status: 'rejected',
        approved_at: null,
        approved_by: null,
      })
      .eq('id', id);

    if (error) {
      return jsonError(error.message, 500);
    }

    if (typeof message?.text === 'string') {
      await rememberRejectedPhrase(supabase, message.text, auth.user.id);
    }

    return noStoreJson({
      success: true,
      message: 'Pesan ditolak',
    });
  } catch (error) {
    console.error('Admin reject message error:', error);
    return jsonError('Internal server error', 500);
  }
}
