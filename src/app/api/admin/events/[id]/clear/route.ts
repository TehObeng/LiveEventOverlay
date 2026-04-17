import { NextRequest } from 'next/server';
import { requireAdminUser, isUuid, jsonError } from '@/lib/admin-auth';
import { getSchemaSyncMessage, isMissingColumnError } from '@/lib/supabase-errors';
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
    return jsonError('Event ID tidak valid');
  }

  try {
    const supabase = createServiceRoleSupabaseClient();
    const { error } = await supabase
      .from('events')
      .update({ overlay_cleared_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      if (isMissingColumnError(error, 'events.overlay_cleared_at')) {
        return jsonError(getSchemaSyncMessage('events.overlay_cleared_at'), 500);
      }

      return jsonError(error.message, 500);
    }

    return noStoreJson({
      success: true,
      message: 'Layar overlay dibersihkan',
    });
  } catch (error) {
    console.error('Admin clear overlay error:', error);
    return jsonError('Internal server error', 500);
  }
}
