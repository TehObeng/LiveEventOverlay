import { NextRequest, NextResponse } from 'next/server';
import { EventData } from '@/lib/types';
import { requireAdminUser, isUuid, jsonError } from '@/lib/admin-auth';
import { normalizeOverlayConfig } from '@/lib/public';
import { createServiceRoleSupabaseClient } from '@/lib/supabase-server';

export async function GET(
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
    const { data, error } = await supabase.from('events').select('*').eq('id', id).single();

    if (error || !data) {
      return jsonError('Event tidak ditemukan', 404);
    }

    const event = data as EventData;
    return NextResponse.json({
      event: {
        ...event,
        overlay_config: normalizeOverlayConfig(event.overlay_config),
      },
    });
  } catch (error) {
    console.error('Admin event GET error:', error);
    return jsonError('Internal server error', 500);
  }
}

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
    return jsonError('Event ID tidak valid');
  }

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.name === 'string') {
      const trimmedName = body.name.trim();
      if (!trimmedName) {
        return jsonError('Nama event wajib diisi');
      }
      updates.name = trimmedName;
    }

    if ('date' in body) {
      updates.date = typeof body.date === 'string' && body.date ? body.date : null;
    }

    if ('overlay_config' in body) {
      updates.overlay_config = normalizeOverlayConfig(body.overlay_config);
    }

    if (typeof body.auto_approve === 'boolean') {
      updates.auto_approve = body.auto_approve;
    }

    if (Object.keys(updates).length === 0) {
      return jsonError('Tidak ada perubahan yang dikirim');
    }

    const supabase = createServiceRoleSupabaseClient();
    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      return jsonError(error?.message || 'Gagal memperbarui event', 500);
    }

    const event = data as EventData;
    return NextResponse.json({
      event: {
        ...event,
        overlay_config: normalizeOverlayConfig(event.overlay_config),
      },
    });
  } catch (error) {
    console.error('Admin event PATCH error:', error);
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
    return jsonError('Event ID tidak valid');
  }

  try {
    const supabase = createServiceRoleSupabaseClient();
    const { error } = await supabase.from('events').delete().eq('id', id);

    if (error) {
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ success: true, message: 'Event dihapus' });
  } catch (error) {
    console.error('Admin event DELETE error:', error);
    return jsonError('Internal server error', 500);
  }
}
