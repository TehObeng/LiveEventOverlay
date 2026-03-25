import { NextRequest, NextResponse } from 'next/server';
import { EventData } from '@/lib/types';
import { isUuid, jsonError } from '@/lib/admin-auth';
import { toPublicEvent } from '@/lib/public';
import { getSchemaSyncMessage, isMissingColumnError } from '@/lib/supabase-errors';
import { createServiceRoleSupabaseClient } from '@/lib/supabase-server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!isUuid(id)) {
    return jsonError('Event ID tidak valid');
  }

  try {
    const supabase = createServiceRoleSupabaseClient();
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error) {
      if (isMissingColumnError(error, 'events.overlay_cleared_at')) {
        return jsonError(getSchemaSyncMessage('events.overlay_cleared_at'), 500);
      }

      return jsonError(error.message, 500);
    }

    if (!data) {
      return jsonError('Event tidak ditemukan atau sudah berakhir', 404);
    }

    return NextResponse.json({
      event: toPublicEvent(data as EventData),
    });
  } catch (error) {
    console.error('Public event GET error:', error);
    return jsonError('Internal server error', 500);
  }
}
