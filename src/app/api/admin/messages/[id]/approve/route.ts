import { NextRequest } from 'next/server';
import { requireAdminUser, isUuid, jsonError } from '@/lib/admin-auth';
import { rememberApprovedSafePhrase } from '@/lib/moderation-memory';
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
      .select('text, risk_level')
      .eq('id', id)
      .maybeSingle();

    if (messageError) {
      return jsonError(messageError.message, 500);
    }

    const message = messageRow as { text?: string; risk_level?: string | null } | null;
    const { error } = await supabase
      .from('messages')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: auth.user.email || 'admin',
      })
      .eq('id', id);

    if (error) {
      return jsonError(error.message, 500);
    }

    if (message?.risk_level === 'risky' && typeof message.text === 'string') {
      await rememberApprovedSafePhrase(supabase, message.text, auth.user.id);
    }

    return noStoreJson({
      success: true,
      message: 'Pesan disetujui',
    });
  } catch (error) {
    console.error('Admin approve message error:', error);
    return jsonError('Internal server error', 500);
  }
}
