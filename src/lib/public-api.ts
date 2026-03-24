import { PublicEventResponse, PublicMessagesResponse } from './types';
import { requestJson } from './request';

export async function fetchPublicEvent(eventId: string) {
  const data = await requestJson<PublicEventResponse>(`/api/public/events/${encodeURIComponent(eventId)}`);
  return data.event;
}

export function fetchPublicMessages(eventId: string, since?: string) {
  const params = new URLSearchParams();
  if (since) {
    params.set('since', since);
  }

  const query = params.toString();
  return requestJson<PublicMessagesResponse>(
    `/api/public/events/${encodeURIComponent(eventId)}/messages${query ? `?${query}` : ''}`,
  );
}
