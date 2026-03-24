import assert from 'node:assert/strict';
import test from 'node:test';
import { toPublicApprovedMessage, toPublicEvent } from '../src/lib/public.ts';

test('toPublicEvent merges overlay defaults and keeps only public fields', () => {
  const result = toPublicEvent({
    id: 'event-1',
    name: 'Launch Night',
    max_chars: 140,
    cooldown_seconds: 12,
    overlay_config: {
      fontSize: 64,
      color: '#FF00FF',
    },
    is_active: true,
    overlay_cleared_at: '2026-03-25T09:00:00.000Z',
  } as never);

  assert.equal(result.id, 'event-1');
  assert.equal(result.overlay_config.fontSize, 64);
  assert.equal(result.overlay_config.scrollDirection, 'rtl');
  assert.equal(result.overlay_cleared_at, '2026-03-25T09:00:00.000Z');
});

test('toPublicApprovedMessage omits moderation-only fields', () => {
  const result = toPublicApprovedMessage({
    id: 'message-1',
    text: 'Halo dunia',
    sender_name: 'Danel',
    approved_at: '2026-03-25T09:05:00.000Z',
  });

  assert.deepEqual(result, {
    id: 'message-1',
    text: 'Halo dunia',
    sender_name: 'Danel',
    approved_at: '2026-03-25T09:05:00.000Z',
  });
  assert.equal('ip_hash' in result, false);
});
