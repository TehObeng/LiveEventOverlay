# Overlay Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the existing polling overlay so transient message API failures do not clear visible content, reconnect safely catches up missed approved messages, and replay/skip risk is removed with a composite cursor.

**Architecture:** Keep the current polling overlay and public API shape, but add a shared composite cursor helper, route-side deterministic filtering, and a small pure runtime helper for queue mode transitions. Wire the overlay page to use single-flight polling plus paced catch-up so the stage-facing runtime becomes predictable without changing the deployment model.

**Tech Stack:** Next.js 16 App Router, React 19 client components, TypeScript, Node `node:test`, Playwright

---

## File Structure

- `src/lib/types.ts`
  Add shared cursor and response types used by both the API route and overlay client.
- `src/lib/public-message-cursor.ts`
  New pure helper for parsing, comparing, advancing, and serializing the composite message cursor.
- `src/lib/overlay-runtime.ts`
  New pure helper for queue mode transitions and catch-up pacing decisions.
- `src/lib/public-api.ts`
  Update the public messages fetcher to send the new cursor query params.
- `src/app/api/public/events/[id]/messages/route.ts`
  Update the route to accept the composite cursor, sort deterministically, filter after the cursor boundary, and return `nextCursor`.
- `src/app/overlay/page.tsx`
  Add single-flight polling, explicit runtime mode tracking, reconnect handling, and catch-up draining.
- `tests/public-message-cursor.test.ts`
  Add unit coverage for cursor comparison, serialization, and advancement.
- `tests/overlay-runtime.test.ts`
  Add unit coverage for runtime mode transitions and paced catch-up behavior.
- `tests/e2e/polish.spec.ts`
  Add a reconnect-focused overlay scenario on the existing mock-backed Playwright suite.

### Task 1: Add Shared Cursor Types And Helpers

**Files:**
- Create: `src/lib/public-message-cursor.ts`
- Modify: `src/lib/types.ts`
- Test: `tests/public-message-cursor.test.ts`

- [ ] **Step 1: Write the failing cursor tests**

```ts
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

  assert.equal(query.toString(), 'sinceApprovedAt=2026-03-29T10%3A00%3A00.000Z&sinceId=message-c');
});

test('parseMessageCursorInput accepts empty values and returns null', () => {
  assert.equal(parseMessageCursorInput(null, null), null);
});
```

- [ ] **Step 2: Run the cursor tests to verify they fail**

Run: `node --import tsx --test tests/public-message-cursor.test.ts`
Expected: FAIL with module or export errors because `src/lib/public-message-cursor.ts` does not exist yet.

- [ ] **Step 3: Write the minimal cursor helper and shared types**

```ts
// src/lib/types.ts
export interface MessageCursor {
  approvedAt: string;
  id: string;
}

export interface PublicMessagesResponse {
  messages: PublicApprovedMessage[];
  nextCursor: MessageCursor | null;
  clearedAt: string | null;
}
```

```ts
// src/lib/public-message-cursor.ts
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
```

- [ ] **Step 4: Run the cursor tests to verify they pass**

Run: `node --import tsx --test tests/public-message-cursor.test.ts`
Expected: PASS with 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/public-message-cursor.ts tests/public-message-cursor.test.ts
git commit -m "Add composite overlay message cursor helpers"
```

### Task 2: Update The Public Messages API Contract

**Files:**
- Modify: `src/lib/public-api.ts`
- Modify: `src/app/api/public/events/[id]/messages/route.ts`
- Test: `tests/public-message-cursor.test.ts`

- [ ] **Step 1: Add a failing test for cursor query serialization from the client helper**

```ts
import { fetchPublicMessages } from '../src/lib/public-api.ts';

test('fetchPublicMessages sends both cursor params to the public messages route', async () => {
  let requestedUrl = '';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({ messages: [], nextCursor: null, clearedAt: null }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  await fetchPublicMessages('event-1', {
    approvedAt: '2026-03-29T10:00:00.000Z',
    id: 'message-c',
  });

  globalThis.fetch = originalFetch;
  assert.match(requestedUrl, /sinceApprovedAt=2026-03-29T10%3A00%3A00.000Z/);
  assert.match(requestedUrl, /sinceId=message-c/);
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `node --import tsx --test tests/public-message-cursor.test.ts`
Expected: FAIL because `fetchPublicMessages` still only accepts a timestamp-based `since` argument.

- [ ] **Step 3: Update the client helper and route to use the composite cursor**

```ts
// src/lib/public-api.ts
import { MessageCursor, PublicEventResponse, PublicMessagesResponse, SiteContentResponse } from './types';
import { buildMessageCursorQuery } from './public-message-cursor';

export function fetchPublicMessages(eventId: string, cursor?: MessageCursor | null) {
  const query = buildMessageCursorQuery(cursor ?? null).toString();
  return requestJson<PublicMessagesResponse>(
    `/api/public/events/${encodeURIComponent(eventId)}/messages${query ? `?${query}` : ''}`,
  );
}
```

```ts
// src/app/api/public/events/[id]/messages/route.ts
import {
  getNextMessageCursor,
  isMessageAfterCursor,
  parseMessageCursorInput,
} from '@/lib/public-message-cursor';

const cursor = parseMessageCursorInput(
  request.nextUrl.searchParams.get('sinceApprovedAt'),
  request.nextUrl.searchParams.get('sinceId'),
);

const messages = ((messageResult.data || []) as Pick<Message, 'id' | 'text' | 'sender_name' | 'approved_at'>[])
  .sort((left, right) => {
    if (left.approved_at === right.approved_at) {
      return left.id.localeCompare(right.id);
    }

    return String(left.approved_at).localeCompare(String(right.approved_at));
  })
  .filter((message) => isMessageAfterCursor(message, cursor))
  .map(toPublicApprovedMessage);

return NextResponse.json({
  messages,
  nextCursor: getNextMessageCursor(messages),
  clearedAt: eventData.overlay_cleared_at ?? null,
});
```

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `node --import tsx --test tests/public-message-cursor.test.ts`
Expected: PASS, including the fetch helper serialization test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/public-api.ts src/app/api/public/events/[id]/messages/route.ts tests/public-message-cursor.test.ts
git commit -m "Use composite cursor for public overlay messages"
```

### Task 3: Add Runtime Helpers For Reconnect And Catch-Up

**Files:**
- Create: `src/lib/overlay-runtime.ts`
- Test: `tests/overlay-runtime.test.ts`

- [ ] **Step 1: Write the failing runtime tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
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
```

- [ ] **Step 2: Run the runtime tests to verify they fail**

Run: `node --import tsx --test tests/overlay-runtime.test.ts`
Expected: FAIL because `src/lib/overlay-runtime.ts` does not exist yet.

- [ ] **Step 3: Write the minimal runtime helper**

```ts
// src/lib/overlay-runtime.ts
export type OverlayRuntimeMode = 'booting' | 'live' | 'reconnecting' | 'catching_up';

type CursorLikeMessage = {
  id: string;
  approved_at: string | null;
};

export type OverlayDeliveryState = {
  mode: OverlayRuntimeMode;
  catchUpBacklog: number;
};

export function createOverlayDeliveryState(): OverlayDeliveryState {
  return {
    mode: 'booting',
    catchUpBacklog: 0,
  };
}

export function reducePollStatus(
  state: OverlayDeliveryState,
  event: { type: 'poll-succeeded' } | { type: 'poll-failed' },
): OverlayDeliveryState {
  if (event.type === 'poll-failed') {
    return {
      ...state,
      mode: 'reconnecting',
    };
  }

  return state.mode === 'booting'
    ? { ...state, mode: 'live' }
    : state;
}

export function mergeIncomingMessages(
  state: OverlayDeliveryState,
  messages: CursorLikeMessage[],
): OverlayDeliveryState {
  if (state.mode === 'reconnecting' && messages.length > 0) {
    return {
      mode: 'catching_up',
      catchUpBacklog: messages.length,
    };
  }

  if (messages.length === 0 && state.catchUpBacklog === 0) {
    return {
      ...state,
      mode: state.mode === 'booting' ? 'live' : state.mode,
    };
  }

  return {
    ...state,
    mode: state.mode === 'booting' ? 'live' : state.mode,
    catchUpBacklog: state.catchUpBacklog + messages.length,
  };
}

export function getCatchUpSpawnInterval(spawnInterval: number) {
  return Math.max(spawnInterval, 1600);
}

export function resetOverlayDeliveryState(_state?: OverlayDeliveryState): OverlayDeliveryState {
  return createOverlayDeliveryState();
}
```

- [ ] **Step 4: Run the runtime tests to verify they pass**

Run: `node --import tsx --test tests/overlay-runtime.test.ts`
Expected: PASS with 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/overlay-runtime.ts tests/overlay-runtime.test.ts
git commit -m "Add overlay reconnect runtime helpers"
```

### Task 4: Refactor The Overlay Page To Use Single-Flight Polling And Catch-Up Pacing

**Files:**
- Modify: `src/app/overlay/page.tsx`
- Modify: `src/lib/public-api.ts`
- Modify: `src/lib/types.ts`
- Test: `tests/overlay-runtime.test.ts`
- Test: `tests/public-message-cursor.test.ts`

- [ ] **Step 1: Add a failing runtime test for catch-up drain completion**

```ts
import { completeCatchUpDrain } from '../src/lib/overlay-runtime.ts';

test('completeCatchUpDrain returns live mode when backlog reaches zero', () => {
  const state = completeCatchUpDrain({
    mode: 'catching_up',
    catchUpBacklog: 1,
  });

  assert.equal(state.mode, 'live');
  assert.equal(state.catchUpBacklog, 0);
});
```

- [ ] **Step 2: Run the runtime tests to verify they fail**

Run: `node --import tsx --test tests/overlay-runtime.test.ts`
Expected: FAIL because `completeCatchUpDrain` is not implemented yet.

- [ ] **Step 3: Implement overlay page changes with minimal churn**

```ts
// src/app/overlay/page.tsx
const cursorRef = useRef<MessageCursor | null>(null);
const pollInFlightRef = useRef(false);
const runtimeStateRef = useRef(createOverlayDeliveryState());
const queueModeRef = useRef<'live' | 'catchup'>('live');

const queueApprovedMessages = useCallback((messages: PublicApprovedMessage[], queueMode: 'live' | 'catchup') => {
  messages.forEach((message) => {
    if (!message.approved_at || message.approved_at < sessionStartRef.current) {
      return;
    }

    if (seenRef.current.has(message.id)) {
      return;
    }

    seenRef.current.add(message.id);
    queueRef.current.push({
      id: message.id,
      text: message.sender_name ? `${message.sender_name}: ${message.text}` : message.text,
      senderName: message.sender_name,
      approvedAt: message.approved_at,
      lane: 0,
      pos: 0,
      speed: 0,
      startTime: 0,
      size: 0,
      queueMode,
    });
  });
}, []);

const loadMessages = useCallback(async (id: string) => {
  if (pollInFlightRef.current) {
    return;
  }

  pollInFlightRef.current = true;

  try {
    const response = await fetchPublicMessages(id, cursorRef.current);
    runtimeStateRef.current = reducePollStatus(runtimeStateRef.current, { type: 'poll-succeeded' });

    if (response.clearedAt && response.clearedAt !== clearedAtRef.current) {
      clearedAtRef.current = response.clearedAt;
      cursorRef.current = null;
      runtimeStateRef.current = resetOverlayDeliveryState(runtimeStateRef.current);
      clearOverlayState(true);
    }

    const queueMode = runtimeStateRef.current.mode === 'reconnecting' ? 'catchup' : 'live';
    queueApprovedMessages(response.messages, queueMode);
    runtimeStateRef.current = mergeIncomingMessages(runtimeStateRef.current, response.messages);
    cursorRef.current = response.nextCursor;
  } catch {
    runtimeStateRef.current = reducePollStatus(runtimeStateRef.current, { type: 'poll-failed' });
  } finally {
    pollInFlightRef.current = false;
  }
}, [clearOverlayState, queueApprovedMessages]);

const currentSpawnInterval =
  runtimeStateRef.current.mode === 'catching_up'
    ? getCatchUpSpawnInterval(configRef.current.spawnInterval)
    : configRef.current.spawnInterval;
```

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `node --import tsx --test tests/public-message-cursor.test.ts tests/overlay-runtime.test.ts`
Expected: PASS with all cursor and runtime tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/overlay/page.tsx src/lib/public-api.ts src/lib/types.ts src/lib/overlay-runtime.ts tests/public-message-cursor.test.ts tests/overlay-runtime.test.ts
git commit -m "Harden overlay reconnect and catch-up behavior"
```

### Task 5: Add End-To-End Coverage For Reconnect Recovery

**Files:**
- Modify: `tests/e2e/polish.spec.ts`
- Test: `tests/e2e/polish.spec.ts`

- [ ] **Step 1: Write the failing Playwright reconnect scenario**

```ts
test('@polish overlay reconnect keeps visible content and catches up missed messages', async ({ browser, request }) => {
  test.slow();
  const overlayContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const overlayPage = await overlayContext.newPage();
  let outageEnabled = false;
  let outageHits = 0;

  await overlayPage.route(`**/api/public/events/${EVENT_ID}/messages**`, async (route) => {
    if (outageEnabled) {
      outageHits += 1;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'mock outage' }),
      });
      return;
    }

    await route.continue();
  });

  await request.post('/api/admin/session', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, resetStore: true },
  });

  await overlayPage.goto(`/overlay?eventId=${EVENT_ID}&obs=1`, { waitUntil: 'networkidle' });
  await expect(overlayPage.locator('.overlay-container')).toBeVisible();

  await request.post('/api/message', {
    data: { eventId: EVENT_ID, text: 'Before outage', senderName: 'Reconnect Test' },
  });
  await expect.poll(async () => overlayPage.locator('.overlay-container').innerHTML(), { timeout: 6000 }).toContain('Before outage');

  outageEnabled = true;
  await request.post('/api/message', {
    data: { eventId: EVENT_ID, text: 'During outage', senderName: 'Reconnect Test' },
  });

  await expect.poll(() => outageHits, { timeout: 4000 }).toBeGreaterThan(0);
  await expect.poll(async () => overlayPage.locator('.overlay-container').innerHTML(), { timeout: 3000 }).toContain('Before outage');

  const beforeRecover = await overlayPage.locator('.overlay-container').innerHTML();
  outageEnabled = false;
  await expect.poll(async () => overlayPage.locator('.overlay-container').innerHTML(), { timeout: 8000 }).toContain('During outage');
  const afterRecover = await overlayPage.locator('.overlay-container').innerHTML();

  expect(beforeRecover).not.toContain('During outage');
  expect(afterRecover).toContain('During outage');
});
```

- [ ] **Step 2: Run the targeted Playwright test to verify it fails**

Run: `npx playwright test tests/e2e/polish.spec.ts --grep "overlay reconnect keeps visible content"`
Expected: FAIL because reconnect behavior is not implemented yet, even though the browser route can already simulate the outage.

- [ ] **Step 3: Update the reconnect scenario to assert paced recovery instead of an immediate burst**

```ts
const beforeRecover = await overlayPage.locator('.overlay-container').innerHTML();
outageEnabled = false;

await expect.poll(async () => overlayPage.locator('.overlay-container').innerHTML(), { timeout: 8000 }).toContain('During outage');
const afterRecover = await overlayPage.locator('.overlay-container').innerHTML();

expect(beforeRecover).not.toContain('During outage');
expect(afterRecover).toContain('During outage');
```

- [ ] **Step 4: Run the targeted Playwright test to verify it passes**

Run: `npx playwright test tests/e2e/polish.spec.ts --grep "overlay reconnect keeps visible content"`
Expected: PASS with the reconnect scenario green.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/polish.spec.ts
git commit -m "Cover overlay reconnect recovery in e2e"
```

### Task 6: Full Verification

**Files:**
- Modify: `docs/superpowers/specs/2026-03-29-overlay-reliability-design.md`
- Modify: `docs/superpowers/plans/2026-03-29-overlay-reliability-implementation.md`

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: PASS with exit code 0.

- [ ] **Step 2: Run type-check**

Run: `npm run type-check`
Expected: PASS with exit code 0.

- [ ] **Step 3: Run unit tests**

Run: `npm test`
Expected: PASS with all root `tests/*.test.ts` green.

- [ ] **Step 4: Run the targeted Playwright reconnect coverage**

Run: `npx playwright test tests/e2e/polish.spec.ts --grep "overlay reconnect keeps visible content|admin moderation and overlay playback"`
Expected: PASS with both overlay-critical scenarios green.

- [ ] **Step 5: Sync the resume docs with the final implementation**

```md
Confirm both docs mention:
- `src/lib/public-message-cursor.ts`
- `src/lib/overlay-runtime.ts`
- `nextCursor` as the public route response field
- the exact verification commands that were run in Step 1 through Step 4
```

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-03-29-overlay-reliability-design.md docs/superpowers/plans/2026-03-29-overlay-reliability-implementation.md
git commit -m "Document final overlay reliability implementation details"
```

## Execution Notes

- Worktree used for implementation: `~/.config/superpowers/worktrees/LiveEventOverlay/feature-overlay-reliability`
- Branch used for implementation: `feature/overlay-reliability`
- Verification commands executed in this environment:
  - `npm run lint`
  - `npm run type-check`
  - `npm test`
  - `npm run build`
  - `npx playwright test tests/e2e/polish.spec.ts --project=chromium --grep "overlay reconnect keeps visible content and catches up missed messages without flooding"`
  - `npx playwright test tests/e2e/polish.spec.ts --project=chromium --grep "admin moderation and overlay playback work in a real controlled browser"`
- Environment note: Firefox Playwright verification was not run here because the Firefox browser binary is not installed on this VPS image.
