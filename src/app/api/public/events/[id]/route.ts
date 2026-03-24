import { NextRequest, NextResponse } from 'next/server';
import { EventData } from '@/lib/types';
import { isUuid, jsonError } from '@/lib/admin-auth';
import { toPublicEvent } from '@/lib/public';
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
      .select('id, name, max_chars, cooldown_seconds, overlay_config, is_active, overlay_cleared_at')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return jsonError('Event tidak ditemukan atau sudah berakhir', 404);
    }

    return NextResponse.json({
      event: toPublicEvent(data as Pick<EventData, 'id' | 'name' | 'max_chars' | 'cooldown_seconds' | 'overlay_config' | 'is_active' | 'overlay_cleared_at'>),
    });
  } catch (error) {
    console.error('Public event GET error:', error);
    return jsonError('Internal server error', 500);
  }
}
