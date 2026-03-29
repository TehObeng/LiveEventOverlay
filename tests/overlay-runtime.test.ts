import assert from 'node:assert/strict';
import test from 'node:test';
import {
  completeCatchUpDrain,
  createOverlayDeliveryState,
  getCatchUpSpawnInterval,
  mergeIncomingMessages,
  reducePollStatus,
  resetOverlayDeliveryState,
} from '../src/lib/overlay-runtime.ts';

test('reducePollStatus moves from live to reconnecting on poll failure', () => {
  const state = reducePollStatus(createOverlayDeliveryState(), {
    type: 'poll-failed',
  });

  assert.equal(state.mode, 'reconnecting');
});

test('reducePollStatus returns to live when reconnecting poll succeeds', () => {
  const reconnecting = reducePollStatus(createOverlayDeliveryState(), {
    type: 'poll-failed',
  });

  const state = reducePollStatus(reconnecting, {
    type: 'poll-succeeded',
  });

  assert.equal(state.mode, 'live');
});

test('mergeIncomingMessages enters catching_up when backlog arrives after reconnect', () => {
  const reconnecting = reducePollStatus(createOverlayDeliveryState(), {
    type: 'poll-failed',
  });

  const state = mergeIncomingMessages(reconnecting, [
    { id: 'message-1', approved_at: '2026-03-29T10:00:01.000Z' },
    { id: 'message-2', approved_at: '2026-03-29T10:00:02.000Z' },
  ]);

  assert.equal(state.mode, 'catching_up');
  assert.equal(state.catchUpBacklog, 2);
});

test('getCatchUpSpawnInterval enforces a 1600ms floor', () => {
  assert.equal(getCatchUpSpawnInterval(900), 1600);
  assert.equal(getCatchUpSpawnInterval(2200), 2200);
});

test('resetOverlayDeliveryState clears reconnect backlog', () => {
  assert.deepEqual(
    resetOverlayDeliveryState({
      mode: 'catching_up',
      catchUpBacklog: 3,
    }),
    {
      mode: 'booting',
      catchUpBacklog: 0,
    },
  );
});

test('completeCatchUpDrain returns live mode when backlog reaches zero', () => {
  const state = completeCatchUpDrain({
    mode: 'catching_up',
    catchUpBacklog: 1,
  });

  assert.equal(state.mode, 'live');
  assert.equal(state.catchUpBacklog, 0);
});

test('completeCatchUpDrain stays in catching_up while backlog remains', () => {
  const state = completeCatchUpDrain({
    mode: 'catching_up',
    catchUpBacklog: 3,
  });

  assert.equal(state.mode, 'catching_up');
  assert.equal(state.catchUpBacklog, 2);
});
