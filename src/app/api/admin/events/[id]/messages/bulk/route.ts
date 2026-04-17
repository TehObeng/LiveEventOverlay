import { NextRequest } from 'next/server';
import { AdminBulkMessageAction } from '@/lib/types';
import { requireAdminUser, isUuid, jsonError } from '@/lib/admin-auth';
import { rememberApprovedSafePhrase } from '@/lib/moderation-memory';
import { noStoreJson } from '@/lib/response';
import { createServiceRoleSupabaseClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function isBulkAction(value: unknown): value is AdminBulkMessageAction {
  return value === 'approve' || value === 'reject' || value === 'delete';
}

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
    const action = body.action;
    const ids = Array.isArray(body.ids) ? body.ids.filter(isUuid) : [];

    if (!isBulkAction(action) || ids.length === 0) {
      return jsonError('Aksi bulk tidak valid');
    }

    const supabase = createServiceRoleSupabaseClient();
    const { data: rowsToApprove, error: readError } =
      action === 'approve'
        ? await supabase
            .from('messages')
            .select('id, text, risk_level')
            .in('id', ids)
            .eq('event_id', id)
        : { data: null, error: null };

    if (readError) {
      return jsonError(readError.message, 500);
    }

    if (action === 'delete') {
      const { error } = await supabase.from('messages').delete().in('id', ids).eq('event_id', id);
      if (error) {
        return jsonError(error.message, 500);
      }
    } else {
      const updates =
        action === 'approve'
          ? {
              status: 'approved',
              approved_at: new Date().toISOString(),
              approved_by: auth.user.email || 'admin',
            }
          : {
              status: 'rejected',
              approved_at: null,
              approved_by: null,
            };

      const { error } = await supabase
        .from('messages')
        .update(updates)
        .in('id', ids)
        .eq('event_id', id);

      if (error) {
        return jsonError(error.message, 500);
      }

      if (action === 'approve' && Array.isArray(rowsToApprove)) {
        for (const row of rowsToApprove as Array<{ text?: string; risk_level?: string | null }>) {
          if (row?.risk_level === 'risky' && typeof row.text === 'string') {
            await rememberApprovedSafePhrase(supabase, row.text, auth.user.id);
          }
        }
      }
    }

    return noStoreJson({
      success: true,
      message: `${ids.length} pesan berhasil diproses`,
    });
  } catch (error) {
    console.error('Admin bulk message error:', error);
    return jsonError('Internal server error', 500);
  }
}
