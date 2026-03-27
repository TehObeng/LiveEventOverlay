import {
  AdminBulkMessageAction,
  AdminEventResponse,
  AdminEventsResponse,
  AdminMessagesResponse,
  AdminSessionResponse,
  Message,
  OverlayConfig,
  SuccessResponse,
  SiteContent,
  SiteContentResponse,
} from './types';
import { requestJson } from './request';

function eventPath(eventId: string) {
  return `/api/admin/events/${encodeURIComponent(eventId)}`;
}

function messagePath(messageId: string) {
  return `/api/admin/messages/${encodeURIComponent(messageId)}`;
}

export function fetchAdminSession() {
  return requestJson<AdminSessionResponse>('/api/admin/session');
}

export async function fetchAdminEvents() {
  const data = await requestJson<AdminEventsResponse>('/api/admin/events');
  return data.events;
}

export async function createAdminEvent(input: {
  name: string;
  date: string | null;
}) {
  const data = await requestJson<AdminEventResponse>('/api/admin/events', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.event;
}

export async function updateAdminEvent(eventId: string, input: {
  name?: string;
  date?: string | null;
  overlay_config?: OverlayConfig;
  auto_approve?: boolean;
}) {
  const data = await requestJson<AdminEventResponse>(eventPath(eventId), {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return data.event;
}

export function deleteAdminEvent(eventId: string) {
  return requestJson<SuccessResponse>(eventPath(eventId), {
    method: 'DELETE',
  });
}

export async function fetchAdminMessages(eventId: string) {
  const data = await requestJson<AdminMessagesResponse>(`${eventPath(eventId)}/messages`);
  return data.messages;
}

export function approveAdminMessage(messageId: string) {
  return requestJson<SuccessResponse>(`${messagePath(messageId)}/approve`, {
    method: 'POST',
  });
}

export function rejectAdminMessage(messageId: string) {
  return requestJson<SuccessResponse>(`${messagePath(messageId)}/reject`, {
    method: 'POST',
  });
}

export function updateAdminMessage(messageId: string, input: Partial<Pick<Message, 'text'>>) {
  return requestJson<SuccessResponse>(messagePath(messageId), {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteAdminMessage(messageId: string) {
  return requestJson<SuccessResponse>(messagePath(messageId), {
    method: 'DELETE',
  });
}

export function banEventSender(eventId: string, ipHash: string) {
  return requestJson<SuccessResponse>(`${eventPath(eventId)}/ban`, {
    method: 'POST',
    body: JSON.stringify({ ipHash }),
  });
}

export function runBulkMessageAction(eventId: string, input: {
  action: AdminBulkMessageAction;
  ids: string[];
}) {
  return requestJson<SuccessResponse>(`${eventPath(eventId)}/messages/bulk`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function sendAdminTestMessage(eventId: string) {
  return requestJson<SuccessResponse>(`${eventPath(eventId)}/messages/test`, {
    method: 'POST',
  });
}

export function clearAdminOverlay(eventId: string) {
  return requestJson<SuccessResponse>(`${eventPath(eventId)}/clear`, {
    method: 'POST',
  });
}


export async function fetchAdminSiteContent() {
  const data = await requestJson<SiteContentResponse>('/api/admin/site-content');
  return data.content;
}

export async function updateAdminSiteContent(content: SiteContent) {
  const data = await requestJson<SiteContentResponse>('/api/admin/site-content', {
    method: 'PUT',
    body: JSON.stringify(content),
  });

  return data.content;
}
