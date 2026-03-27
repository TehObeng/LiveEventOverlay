import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_OVERLAY_CONFIG, EventData } from '@/lib/types';
import { normalizeOverlayConfig } from '@/lib/public';
import { requireAdminUser, jsonError } from '@/lib/admin-auth';
import { createServiceRoleSupabaseClient } from '@/lib/supabase-server';

export async function GET() {
  const auth = await requireAdminUser();
  if ('response' in auth) {
    return auth.response;
  }

  try {
    const supabase = createServiceRoleSupabaseClient();
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return jsonError(error.message, 500);
    }

    const events = ((data || []) as EventData[]).map((event) => ({
      ...event,
      overlay_config: normalizeOverlayConfig(event.overlay_config),
    }));

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Admin events GET error:', error);
    return jsonError('Internal server error', 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser();
  if ('response' in auth) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const date = typeof body.date === 'string' && body.date ? body.date : new Date().toISOString();

    if (!name) {
      return jsonError('Nama event wajib diisi');
    }

    const supabase = createServiceRoleSupabaseClient();
    const { data, error } = await supabase
      .from('events')
      .insert({
        name,
        date,
        overlay_config: DEFAULT_OVERLAY_CONFIG,
        auto_approve: true,
      })
      .select('*')
      .single();

    if (error || !data) {
      return jsonError(error?.message || 'Gagal membuat event', 500);
    }

    const event = data as EventData;
    return NextResponse.json({
      event: {
        ...event,
        overlay_config: normalizeOverlayConfig(event.overlay_config),
      },
    });
  } catch (error) {
    console.error('Admin events POST error:', error);
    return jsonError('Internal server error', 500);
  }
}
