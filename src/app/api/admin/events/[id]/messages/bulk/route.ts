import { NextRequest, NextResponse } from 'next/server';
import { AdminBulkMessageAction } from '@/lib/types';
import { requireAdminUser, isUuid, jsonError } from '@/lib/admin-auth';
import { createServiceRoleSupabaseClient } from '@/lib/supabase-server';

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
    }

    return NextResponse.json({
      success: true,
      message: `${ids.length} pesan berhasil diproses`,
    });
  } catch (error) {
    console.error('Admin bulk message error:', error);
    return jsonError('Internal server error', 500);
  }
}
