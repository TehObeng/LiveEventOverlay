import { MessageCursor } from './types';

type CursorLikeMessage = {
  id: string;
  approved_at: string | null;
};

export function parseMessageCursorInput(
  approvedAt: string | null,
  id: string | null,
): MessageCursor | null {
  if (!approvedAt || !id) {
    return null;
  }

  return { approvedAt, id };
}

export function isMessageAfterCursor(
  message: CursorLikeMessage,
  cursor: MessageCursor | null,
): boolean {
  if (!message.approved_at) {
    return false;
  }

  if (!cursor) {
    return true;
  }

  return (
    message.approved_at > cursor.approvedAt ||
    (message.approved_at === cursor.approvedAt && message.id > cursor.id)
  );
}

export function getNextMessageCursor(messages: CursorLikeMessage[]): MessageCursor | null {
  const last = [...messages]
    .filter((message) => Boolean(message.approved_at))
    .sort((left, right) => {
      if (left.approved_at === right.approved_at) {
        return left.id.localeCompare(right.id);
      }

      return String(left.approved_at).localeCompare(String(right.approved_at));
    })
    .at(-1);

  return last?.approved_at ? { approvedAt: last.approved_at, id: last.id } : null;
}

export function buildMessageCursorQuery(cursor: MessageCursor | null) {
  const params = new URLSearchParams();

  if (cursor) {
    params.set('sinceApprovedAt', cursor.approvedAt);
    params.set('sinceId', cursor.id);
  }

  return params;
}
