type CursorLikeMessage = {
  id: string;
  approved_at: string | null;
};

export type PublicMessageCursor = {
  approvedAt: string;
  afterId: string | null;
};

function isValidIsoString(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

export function parsePublicMessageCursor(value: string | null | undefined): PublicMessageCursor | null {
  if (!value) {
    return null;
  }

  const separatorIndex = value.indexOf('|');
  if (separatorIndex === -1) {
    return isValidIsoString(value)
      ? {
          approvedAt: value,
          afterId: null,
        }
      : null;
  }

  const approvedAt = value.slice(0, separatorIndex);
  const afterId = value.slice(separatorIndex + 1) || null;
  if (!isValidIsoString(approvedAt)) {
    return null;
  }

  return {
    approvedAt,
    afterId,
  };
}

export function compareApprovedMessages(a: CursorLikeMessage, b: CursorLikeMessage) {
  const approvedAtA = a.approved_at || '';
  const approvedAtB = b.approved_at || '';

  if (approvedAtA !== approvedAtB) {
    return approvedAtA.localeCompare(approvedAtB);
  }

  return a.id.localeCompare(b.id);
}

export function sortApprovedMessagesByCursor<T extends CursorLikeMessage>(messages: T[]) {
  return [...messages].sort(compareApprovedMessages);
}

export function isMessageAfterCursor(message: CursorLikeMessage, cursor: PublicMessageCursor | null) {
  if (!message.approved_at) {
    return false;
  }

  if (!cursor) {
    return true;
  }

  if (message.approved_at > cursor.approvedAt) {
    return true;
  }

  if (message.approved_at < cursor.approvedAt) {
    return false;
  }

  if (!cursor.afterId) {
    return false;
  }

  return message.id > cursor.afterId;
}

export function encodePublicMessageCursor(message: CursorLikeMessage | null | undefined) {
  if (!message?.approved_at) {
    return null;
  }

  return `${message.approved_at}|${message.id}`;
}