import { PublicEventResponse, PublicMessagesResponse, SiteContentResponse } from './types';
import { requestJson } from './request';

export async function fetchPublicEvent(eventId: string, init?: RequestInit) {
  const data = await requestJson<PublicEventResponse>(`/api/public/events/${encodeURIComponent(eventId)}`, init);
  return data.event;
}

export function fetchPublicMessages(eventId: string, since?: string, init?: RequestInit) {
  const params = new URLSearchParams();
  if (since) {
    params.set('since', since);
  }

  const query = params.toString();
  return requestJson<PublicMessagesResponse>(
    `/api/public/events/${encodeURIComponent(eventId)}/messages${query ? `?${query}` : ''}`,
    init,
  );
}


export async function fetchPublicSiteContent() {
  const data = await requestJson<SiteContentResponse>('/api/public/site-content');
  return data.content;
}
