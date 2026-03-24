import { NextRequest, NextResponse } from 'next/server';
import { Message } from '@/lib/types';
import { isUuid, jsonError } from '@/lib/admin-auth';
import { toPublicApprovedMessage } from '@/lib/public';
import { createServiceRoleSupabaseClient } from '@/lib/supabase-server';

function isValidIsoString(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!isUuid(id)) {
    return jsonError('Event ID tidak valid');
  }

  const since = request.nextUrl.searchParams.get('since');
  if (since && !isValidIsoString(since)) {
    return jsonError('Parameter since tidak valid');
  }

  try {
    const supabase = createServiceRoleSupabaseClient();

    const [eventResult, messageResult] = await Promise.all([
      supabase
        .from('events')
        .select('overlay_cleared_at')
        .eq('id', id)
        .eq('is_active', true)
        .single(),
      (() => {
        let query = supabase
          .from('messages')
          .select('id, text, sender_name, approved_at')
          .eq('event_id', id)
          .eq('status', 'approved')
          .order('approved_at', { ascending: true })
          .limit(50);

        if (since) {
          query = query.gt('approved_at', since);
        }

        return query;
      })(),
    ]);

    if (eventResult.error || !eventResult.data) {
      return jsonError('Event tidak ditemukan atau sudah berakhir', 404);
    }

    if (messageResult.error) {
      return jsonError(messageResult.error.message, 500);
    }

    const messages = ((messageResult.data || []) as Pick<Message, 'id' | 'text' | 'sender_name' | 'approved_at'>[])
      .map(toPublicApprovedMessage);
    const nextSince = messages.length > 0 ? messages[messages.length - 1].approved_at : since;

    return NextResponse.json({
      messages,
      nextSince: nextSince || null,
      clearedAt: eventResult.data.overlay_cleared_at || null,
    });
  } catch (error) {
    console.error('Public messages GET error:', error);
    return jsonError('Internal server error', 500);
  }
}
