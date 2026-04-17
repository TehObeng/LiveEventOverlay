import { NextRequest } from 'next/server';
import { Message } from '@/lib/types';
import { isUuid, jsonError } from '@/lib/admin-auth';
import {
  encodePublicMessageCursor,
  isMessageAfterCursor,
  parsePublicMessageCursor,
  sortApprovedMessagesByCursor,
} from '@/lib/public-message-cursor';
import { toPublicApprovedMessage } from '@/lib/public';
import { getSchemaSyncMessage, isMissingColumnError } from '@/lib/supabase-errors';
import { noStoreJson } from '@/lib/response';
import { createServiceRoleSupabaseClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function isValidIsoString(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

const PAGE_SIZE = 50;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!isUuid(id)) {
    return jsonError('Event ID tidak valid');
  }

  const since = request.nextUrl.searchParams.get('since');
  const cursor = parsePublicMessageCursor(since);
  if (since && !cursor && !isValidIsoString(since)) {
    return jsonError('Parameter since tidak valid');
  }

  try {
    const supabase = createServiceRoleSupabaseClient();

    const eventPromise = supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    const createApprovedMessageQuery = () =>
      supabase
        .from('messages')
        .select('id, text, sender_name, approved_at')
        .eq('event_id', id)
        .eq('status', 'approved');

    const messagePromise = cursor
      ? Promise.all([
          createApprovedMessageQuery()
            .eq('approved_at', cursor.approvedAt)
            .order('id', { ascending: true }),
          createApprovedMessageQuery()
            .gt('approved_at', cursor.approvedAt)
            .order('approved_at', { ascending: true })
            .limit(PAGE_SIZE),
        ])
      : createApprovedMessageQuery()
          .order('approved_at', { ascending: false })
          .limit(PAGE_SIZE);

    const [eventResult, rawMessageResult] = await Promise.all([
      eventPromise,
      messagePromise,
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

    const collectedRows: Pick<Message, 'id' | 'text' | 'sender_name' | 'approved_at'>[] = [];

    if (Array.isArray(rawMessageResult)) {
      const [sameTimestampResult, newerMessagesResult] = rawMessageResult;

      if (sameTimestampResult.error) {
        return jsonError(sameTimestampResult.error.message, 500);
      }

      if (newerMessagesResult.error) {
        return jsonError(newerMessagesResult.error.message, 500);
      }

      collectedRows.push(...((sameTimestampResult.data || []) as Pick<Message, 'id' | 'text' | 'sender_name' | 'approved_at'>[]));
      collectedRows.push(...((newerMessagesResult.data || []) as Pick<Message, 'id' | 'text' | 'sender_name' | 'approved_at'>[]));
    } else {
      if (rawMessageResult.error) {
        return jsonError(rawMessageResult.error.message, 500);
      }

      collectedRows.push(...((rawMessageResult.data || []) as Pick<Message, 'id' | 'text' | 'sender_name' | 'approved_at'>[]));
    }

    const sortedMessages = sortApprovedMessagesByCursor(collectedRows);
    const pageRows = (cursor
      ? sortedMessages.filter((message) => isMessageAfterCursor(message, cursor))
      : sortedMessages
    ).slice(0, PAGE_SIZE);

    const messages = pageRows.map(toPublicApprovedMessage);
    const nextSince = encodePublicMessageCursor(pageRows[pageRows.length - 1]) || since;

    return noStoreJson({
      messages,
      nextSince: nextSince || null,
      clearedAt: eventData.overlay_cleared_at ?? null,
    });
  } catch (error) {
    console.error('Public messages GET error:', error);
    return jsonError('Internal server error', 500);
  }
}
