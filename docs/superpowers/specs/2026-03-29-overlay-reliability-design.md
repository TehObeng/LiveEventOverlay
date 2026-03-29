# Overlay Reliability Hardening Design

Date: 2026-03-29
Status: Approved for planning
Primary goal: Make the OBS overlay resilient to transient API/network failures without replaying old content or flooding the screen after reconnect.

## Why This Exists

This file is the canonical handoff and resume document for the overlay reliability pass. If work is interrupted, resume from this file first.

The current product already polls public APIs and renders approved messages successfully, but it is still too easy for live behavior to degrade in ways that feel unreliable on stage:

- polling requests can overlap and race
- reconnect behavior is implicit rather than stateful
- the cursor is based on `approved_at` only
- catch-up after a gap can produce uneven or bursty behavior

The user-approved live behavior is:

- only show newly approved chats
- if the overlay disconnects, already visible messages must not disappear
- those visible messages should finish naturally
- after reconnect, messages approved during the outage should be caught up
- catch-up should add a little delay so the screen is not spammed
- end-to-end approval-to-overlay latency only needs to stay under 5 seconds

## Scope

In scope:

- harden the existing polling overlay instead of replacing it
- tighten the public messages cursor contract
- add explicit overlay connection and catch-up state
- prevent replay and reduce skip risk at reconnect boundaries
- add focused tests for reconnect, catch-up pacing, and clear-screen interactions
- document the implementation sequence so work can resume cleanly after interruption

Out of scope:

- migrating to websockets, SSE, or Supabase Realtime
- redesigning the overlay visuals
- broader admin/security refactors unrelated to overlay reliability
- generalized product refactoring outside the touched flow

## Chosen Approach

Keep the current polling architecture and harden it.

Why this approach was selected:

- it already matches the product shape and deployment model
- it satisfies the user's acceptable latency target
- it minimizes operational complexity for stage production
- it avoids introducing more infrastructure or browser-runtime risk than necessary

Rejected alternatives:

- stronger transport redesign such as Realtime/WebSocket: lower latency, but more runtime and operational complexity than needed
- leave the timestamp-only cursor in place: smaller change, but correctness is weaker under tied approval timestamps

## Runtime Contract

The overlay should behave as a small state machine rather than a passive poll loop.

States:

- `booting`: initial event/config load before first usable render state
- `live`: message polling is succeeding and new approved messages are queued normally
- `reconnecting`: the overlay has lost message API continuity and is retrying quietly
- `catching_up`: polling has recovered and the overlay is draining missed approved messages at a controlled pace

Rules:

- after the overlay has loaded successfully once, transient polling failures must not clear visible messages
- OBS mode should stay visually quiet during transient failures; no intrusive runtime error layer after successful boot
- existing rendered messages continue until they age out naturally
- no old content from before the local session start should be replayed
- after reconnect, only messages approved after the last delivered cursor should be considered for catch-up
- when catch-up backlog drains completely, the overlay returns to `live`
- admin clear-screen remains authoritative and resets both the rendered state and pending queues

## Cursor Contract

The current `since=approved_at` behavior is too weak for sale-ready reliability because two approvals can share the same timestamp boundary.

The hardened cursor should be based on:

- `approved_at`
- `id` as a deterministic tie-breaker

Conceptually, the client tracks `lastDeliveredCursor = { approvedAt, id }`.

Behavior:

- before any message has been delivered in the current session, the effective lower bound is the local session start timestamp
- the client only advances the cursor after successfully accepting server data
- if a poll returns no messages, the cursor does not move
- reconnect requests ask for messages strictly after the last delivered cursor using:
  `approved_at > sinceApprovedAt OR (approved_at = sinceApprovedAt AND id > sinceId)`
- local `seen` tracking still protects against accidental duplicates in the current session
- a clear-screen event resets the local queue and moves the effective lower bound to the clear timestamp

## API Changes

The public messages endpoint should keep the same shape overall, but the cursor contract needs to be explicit and deterministic.

Current endpoint:

- `GET /api/public/events/[id]/messages?since=<iso>`

Planned contract:

- accept `sinceApprovedAt`
- accept `sinceId`
- return messages ordered by `approved_at ASC, id ASC`
- return `nextCursor` with both fields when at least one message is returned
- preserve `clearedAt`

Example response shape:

```json
{
  "messages": [
    {
      "id": "message-id",
      "text": "hello",
      "sender_name": "Host",
      "approved_at": "2026-03-29T10:00:00.000Z"
    }
  ],
  "nextCursor": {
    "approvedAt": "2026-03-29T10:00:00.000Z",
    "id": "message-id"
  },
  "clearedAt": null
}
```

If backward compatibility is needed inside the codebase during the change, the route can temporarily support the old `since` parameter while the client is migrated, but the final intended contract is cursor-based rather than timestamp-only.

## Client Overlay Changes

Primary file:

- `src/app/overlay/page.tsx`

Supporting files likely touched:

- `src/app/api/public/events/[id]/messages/route.ts`
- `src/lib/public-api.ts`
- `src/lib/types.ts`

Implementation requirements:

- enforce single-flight polling for messages so intervals cannot overlap
- keep event/config polling separate from message polling
- store explicit connection mode in refs or state without causing render churn in OBS
- split queue behavior into normal live flow and catch-up flow
- when reconnect delivers backlog, drain it with a controlled minimum interval so the screen does not spam
- preserve current behavior that old messages before local session start are not replayed
- keep clear-screen logic authoritative over active messages, pending queue, seen-set, and cursor state

## Catch-Up Pacing

Catch-up should be intentionally slower than a normal burst of live approvals.

Desired behavior:

- normal live messages use the configured `spawnInterval`
- when reconnect returns a backlog, the overlay enters `catching_up`
- catch-up messages are appended to a backlog queue and drained with a minimum spacing floor
- once backlog reaches zero, the overlay returns to normal live pacing

The exact pacing rule should be:

- `max(config.spawnInterval, 1600ms)` during catch-up

The important requirement is behavioral, not cosmetic:

- reconnect must feel controlled rather than dumping a wall of messages on screen

## Failure Handling

Initial boot:

- if the event cannot load initially, non-OBS mode may still show a visible setup/debug state
- OBS mode may stay visually minimal, but initial setup failure should still be diagnosable in logs

After a successful start:

- message polling failures transition to `reconnecting`
- no destructive clear happens on message poll failure
- event/config polling failures should not erase current config immediately; last known good config remains active until recovery or explicit replacement
- retry continues automatically

## Testing

Unit coverage:

- cursor advancement with no messages, one message, and multiple messages
- tie-handling where multiple messages share the same `approved_at`
- queue mode transitions: `live -> reconnecting -> catching_up -> live`
- clear-screen resetting queue, cursor, and seen tracking

E2E coverage:

- overlay loads, receives a message, then temporary message API failure occurs; currently visible content remains until natural expiry
- overlay reconnects and catches up missed messages without dumping them all at once
- clear-screen during or after reconnect resets content and prevents stale replay

## Implementation Sequence

1. Add cursor types to shared types and public API helpers.
2. Update the public messages route to accept and return the stronger cursor.
3. Refactor overlay polling to single-flight behavior with explicit runtime mode tracking.
4. Add catch-up queue pacing and reconnect recovery logic.
5. Add or update tests for cursor correctness and reconnect behavior.
6. Run lint, type-check, unit tests, build, and any relevant e2e coverage.

## Interruption Recovery

If implementation is interrupted, resume in this order:

1. Re-read this file completely.
2. Check current branch and worktree status.
3. Inspect current state of:
   - `src/app/overlay/page.tsx`
   - `src/app/api/public/events/[id]/messages/route.ts`
   - `src/lib/public-api.ts`
   - `src/lib/types.ts`
4. Confirm whether the route already supports a composite cursor.
5. Confirm whether the overlay already prevents overlapping message polls.
6. Continue from the earliest incomplete step in `Implementation Sequence`.
7. Before claiming success, verify reconnect behavior with tests or a targeted manual run.

## Non-Negotiable Acceptance Criteria

- transient message API failures do not clear already visible overlay content
- overlay resumes automatically after reconnect
- messages approved during the outage are eventually shown
- reconnect catch-up is paced and does not spam the screen
- old messages are not replayed on reconnect
- clear-screen still works correctly across reconnect boundaries
- approval-to-overlay latency remains comfortably under 5 seconds in normal operation
