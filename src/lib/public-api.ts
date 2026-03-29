import { buildMessageCursorQuery } from './public-message-cursor';
import { MessageCursor, PublicEventResponse, PublicMessagesResponse, SiteContentResponse } from './types';
import { requestJson } from './request';

export async function fetchPublicEvent(eventId: string) {
  const data = await requestJson<PublicEventResponse>(`/api/public/events/${encodeURIComponent(eventId)}`);
  return data.event;
}

export function fetchPublicMessages(eventId: string, cursor?: MessageCursor | string | null) {
  const params =
    typeof cursor === 'string'
      ? new URLSearchParams(cursor ? { since: cursor } : undefined)
      : buildMessageCursorQuery(cursor ?? null);

  const query = params.toString();
  return requestJson<PublicMessagesResponse>(
    `/api/public/events/${encodeURIComponent(eventId)}/messages${query ? `?${query}` : ''}`,
  );
}

export async function fetchPublicSiteContent() {
  const data = await requestJson<SiteContentResponse>('/api/public/site-content');
  return data.content;
}
