import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareApprovedMessages,
  encodePublicMessageCursor,
  isMessageAfterCursor,
  parsePublicMessageCursor,
  sortApprovedMessagesByCursor,
} from '../src/lib/public-message-cursor.ts';

test('parsePublicMessageCursor supports legacy plain ISO timestamps', () => {
  assert.deepEqual(parsePublicMessageCursor('2026-04-03T10:00:00.000Z'), {
    approvedAt: '2026-04-03T10:00:00.000Z',
    afterId: null,
  });
});

test('encodePublicMessageCursor round-trips a compound cursor', () => {
  const cursor = encodePublicMessageCursor({
    id: 'bbb',
    approved_at: '2026-04-03T10:00:00.000Z',
  });

  assert.equal(cursor, '2026-04-03T10:00:00.000Z|bbb');
  assert.deepEqual(parsePublicMessageCursor(cursor), {
    approvedAt: '2026-04-03T10:00:00.000Z',
    afterId: 'bbb',
  });
});

test('isMessageAfterCursor excludes equal timestamps until the id passes the cursor', () => {
  const cursor = parsePublicMessageCursor('2026-04-03T10:00:00.000Z|bbb');

  assert.equal(
    isMessageAfterCursor({ id: 'aaa', approved_at: '2026-04-03T10:00:00.000Z' }, cursor),
    false,
  );
  assert.equal(
    isMessageAfterCursor({ id: 'ccc', approved_at: '2026-04-03T10:00:00.000Z' }, cursor),
    true,
  );
  assert.equal(
    isMessageAfterCursor({ id: 'ddd', approved_at: '2026-04-03T10:00:01.000Z' }, cursor),
    true,
  );
});

test('sortApprovedMessagesByCursor keeps pagination deterministic across shared timestamps', () => {
  const sorted = sortApprovedMessagesByCursor([
    { id: 'ccc', approved_at: '2026-04-03T10:00:00.000Z' },
    { id: 'aaa', approved_at: '2026-04-03T09:59:59.000Z' },
    { id: 'bbb', approved_at: '2026-04-03T10:00:00.000Z' },
  ]);

  assert.deepEqual(sorted.map((item) => `${item.approved_at}|${item.id}`), [
    '2026-04-03T09:59:59.000Z|aaa',
    '2026-04-03T10:00:00.000Z|bbb',
    '2026-04-03T10:00:00.000Z|ccc',
  ]);
  assert.equal(compareApprovedMessages(sorted[1], sorted[2]) < 0, true);
});