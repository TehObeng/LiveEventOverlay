import { NextRequest, NextResponse } from 'next/server';
import { Message } from '@/lib/types';
import { isUuid, jsonError } from '@/lib/admin-auth';
import {
  getNextMessageCursor,
  isMessageAfterCursor,
  parseMessageCursorInput,
} from '@/lib/public-message-cursor';
import { toPublicApprovedMessage } from '@/lib/public';
import { getSchemaSyncMessage, isMissingColumnError } from '@/lib/supabase-errors';
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

  const legacySince = request.nextUrl.searchParams.get('since');
  const sinceApprovedAt = request.nextUrl.searchParams.get('sinceApprovedAt');
  const sinceId = request.nextUrl.searchParams.get('sinceId');

  if (legacySince && !isValidIsoString(legacySince)) {
    return jsonError('Parameter since tidak valid');
  }

  if (sinceApprovedAt && !isValidIsoString(sinceApprovedAt)) {
    return jsonError('Parameter sinceApprovedAt tidak valid');
  }

  if ((sinceApprovedAt && !sinceId) || (!sinceApprovedAt && sinceId)) {
    return jsonError('Cursor pesan tidak valid');
  }

  const cursor = parseMessageCursorInput(sinceApprovedAt, sinceId);

  try {
    const supabase = createServiceRoleSupabaseClient();

    const [eventResult, messageResult] = await Promise.all([
      supabase
        .from('events')
        .select('*')
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

        if (cursor) {
          query = query.gte('approved_at', cursor.approvedAt);
        } else if (legacySince) {
          query = query.gt('approved_at', legacySince);
        }

        return query;
      })(),
    ]);

    if (eventResult.error) {
      if (isMissingColumnError(eventResult.error, 'events.overlay_cleared_at')) {
        return jsonError(getSchemaSyncMessage('events.overlay_cleared_at'), 500);
      }

      return jsonError(eventResult.error.message, 500);
    }

    if (!eventResult.data) {
      return jsonError('Event tidak ditemukan atau sudah berakhir', 404);
    }

    const eventData = eventResult.data as { overlay_cleared_at?: string | null };

    if (messageResult.error) {
      return jsonError(messageResult.error.message, 500);
    }

    const messages = ((messageResult.data || []) as Pick<Message, 'id' | 'text' | 'sender_name' | 'approved_at'>[])
      .sort((left, right) => {
        if (left.approved_at === right.approved_at) {
          return left.id.localeCompare(right.id);
        }

        return String(left.approved_at).localeCompare(String(right.approved_at));
      })
      .filter((message) => (cursor ? isMessageAfterCursor(message, cursor) : true))
      .map(toPublicApprovedMessage);
    const nextCursor = getNextMessageCursor(messages);
    const nextSince = nextCursor?.approvedAt ?? legacySince ?? null;

    return NextResponse.json({
      messages,
      nextCursor,
      nextSince,
      clearedAt: eventData.overlay_cleared_at ?? null,
    });
  } catch (error) {
    console.error('Public messages GET error:', error);
    return jsonError('Internal server error', 500);
  }
}
