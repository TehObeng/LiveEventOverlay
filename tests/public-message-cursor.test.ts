import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMessageCursorQuery,
  getNextMessageCursor,
  isMessageAfterCursor,
  parseMessageCursorInput,
} from '../src/lib/public-message-cursor.ts';

test('isMessageAfterCursor uses id as a tie breaker when approved_at matches', () => {
  const cursor = { approvedAt: '2026-03-29T10:00:00.000Z', id: 'message-b' };

  assert.equal(
    isMessageAfterCursor(
      { id: 'message-a', approved_at: '2026-03-29T10:00:00.000Z' },
      cursor,
    ),
    false,
  );
  assert.equal(
    isMessageAfterCursor(
      { id: 'message-c', approved_at: '2026-03-29T10:00:00.000Z' },
      cursor,
    ),
    true,
  );
});

test('getNextMessageCursor returns the last approved message in deterministic order', () => {
  const cursor = getNextMessageCursor([
    { id: 'message-a', approved_at: '2026-03-29T10:00:00.000Z' },
    { id: 'message-c', approved_at: '2026-03-29T10:00:00.000Z' },
  ]);

  assert.deepEqual(cursor, {
    approvedAt: '2026-03-29T10:00:00.000Z',
    id: 'message-c',
  });
});

test('buildMessageCursorQuery serializes both cursor fields when present', () => {
  const query = buildMessageCursorQuery({
    approvedAt: '2026-03-29T10:00:00.000Z',
    id: 'message-c',
  });

  assert.equal(
    query.toString(),
    'sinceApprovedAt=2026-03-29T10%3A00%3A00.000Z&sinceId=message-c',
  );
});

test('parseMessageCursorInput accepts empty values and returns null', () => {
  assert.equal(parseMessageCursorInput(null, null), null);
});
