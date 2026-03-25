# Live Chat Overlay System: Complete User Guide

## Executive Summary

This app lets an audience send messages from a phone, displays approved messages in an OBS-friendly overlay, and gives an admin a moderation/control panel for live events.

If you see:

- `Event tidak ditemukan atau sudah berakhir`
- `Overlay tidak dapat dimuat`

while the event clearly exists in Supabase, the most likely cause is an outdated database schema. In your current case, the `events.overlay_cleared_at` column is missing.

Use [supabase/schema-repair.sql](/C:/Users/danel/Documents/Project/Running%20Text%20Live%20Event/app/supabase/schema-repair.sql) in the Supabase SQL Editor, then restart the app.

## 5W + 3H

### What

This is a live-event messaging system with three user-facing surfaces:

- `/chat`
  Audience message submission page.
- `/overlay`
  Transparent overlay for OBS or browser source capture.
- `/admin`
  Moderation, event creation, event settings, QR sharing, and overlay controls.

### Why

The app is designed so:

- public users never talk directly to raw Supabase tables
- admin data operations go through server routes
- overlay rendering is safe for broadcast use
- moderation stays under organizer control

### Who

Typical roles:

- organizer/admin
  Creates events, logs into `/admin`, moderates messages, configures overlay.
- audience
  Scans the QR code and sends messages through `/chat?eventId=...`.
- stream operator
  Loads `/overlay?eventId=...&obs=1` into OBS.

### When

Use it:

- before an event to create/configure the room
- during the event to moderate and display messages
- after deployment changes to verify schema and env compatibility

### Where

Main setup surfaces:

- Next.js app files: [src](/C:/Users/danel/Documents/Project/Running%20Text%20Live%20Event/app/src)
- database schema source of truth: [supabase/schema.sql](/C:/Users/danel/Documents/Project/Running%20Text%20Live%20Event/app/supabase/schema.sql)
- repair/migration SQL for existing installs: [supabase/schema-repair.sql](/C:/Users/danel/Documents/Project/Running%20Text%20Live%20Event/app/supabase/schema-repair.sql)
- env template: [.env.example](/C:/Users/danel/Documents/Project/Running%20Text%20Live%20Event/app/.env.example)
- schema verifier: [scripts/check-supabase-schema.mjs](/C:/Users/danel/Documents/Project/Running%20Text%20Live%20Event/app/scripts/check-supabase-schema.mjs)

### How

High-level setup flow:

1. Create a Supabase project.
2. Run the SQL schema.
3. Create at least one Auth user for the admin.
4. Fill in `.env`.
5. Start the app.
6. Log in at `/admin`.
7. Create an event and share the chat/overlay links.

### How Long

Typical fresh setup time:

- 10-20 minutes for a first install
- 2-5 minutes for a schema repair on an existing install

### How Much

Operational cost depends on Supabase and hosting usage. The app itself expects:

- one Supabase project
- one public app URL
- one browser-capable host for the Next.js app

## Architecture Walkthrough

### Public Chat Flow

1. The user opens `/chat?eventId=<event-id>`.
2. The page calls `/api/public/events/[id]`.
3. The app checks the `events` table and returns safe public event data.
4. Submissions go to `/api/message`.
5. Messages are auto-approved or held for moderation based on `auto_approve` and risk checks.

### Overlay Flow

1. OBS loads `/overlay?eventId=<event-id>&obs=1`.
2. The overlay calls `/api/public/events/[id]` and `/api/public/events/[id]/messages`.
3. Approved messages are animated as danmaku or TikTok-style stacked messages.
4. Clear-screen state uses `events.overlay_cleared_at`.

### Admin Flow

1. Admin authenticates with Supabase Auth at `/admin/login`.
2. The browser session is checked through Supabase Auth.
3. Server routes under `/api/admin/*` perform event and message operations.
4. Admin actions include:
   - create/edit/delete events
   - moderate pending messages
   - send test messages
   - clear the overlay
   - copy chat and overlay share links

## Environment Setup

Create `.env` from [.env.example](/C:/Users/danel/Documents/Project/Running%20Text%20Live%20Event/app/.env.example):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://192.168.1.4:3000
```

### Environment Variable Meanings

- `NEXT_PUBLIC_SUPABASE_URL`
  Your Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  Public browser key used for auth/session.
- `SUPABASE_SERVICE_ROLE_KEY`
  Server-only key used by Next.js API routes.
- `NEXT_PUBLIC_APP_URL`
  The public base URL used in QR codes and shared links.

### Important Rules

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.
- `NEXT_PUBLIC_APP_URL` must match the real reachable URL.
- After changing `.env`, restart the Next.js server.

## Supabase Setup

### Fresh Install

In the Supabase SQL Editor:

1. Open [supabase/schema.sql](/C:/Users/danel/Documents/Project/Running%20Text%20Live%20Event/app/supabase/schema.sql)
2. Copy all SQL
3. Paste into the SQL Editor
4. Run it

### Existing Install Repair

If the app used to work or was created from an older schema:

1. Open [supabase/schema-repair.sql](/C:/Users/danel/Documents/Project/Running%20Text%20Live%20Event/app/supabase/schema-repair.sql)
2. Copy all SQL
3. Paste into the Supabase SQL Editor
4. Run it
5. Restart the app
6. Run `npm run check:schema`

### Current Known Real Issue

Your current live project is missing:

- `events.overlay_cleared_at`

That caused the public event API to fail even though the event row existed and was active.

## Admin User Setup

This app expects admins to exist in Supabase Auth.

### Create the First Admin User

In Supabase Dashboard:

1. Go to `Authentication`
2. Go to `Users`
3. Create a user or invite one
4. Confirm the email if email confirmation is enabled
5. Use that email/password at `/admin/login`

Your current project already has at least one confirmed Auth user.

## Local App Setup

From [app](/C:/Users/danel/Documents/Project/Running%20Text%20Live%20Event/app):

```bash
npm install
npm run check:schema
npm run dev
```

Production-style verification:

```bash
npm run lint
npm run build
npm run type-check
npm run test
npx playwright test --grep polish
```

## How To Use The System

### Create an Event

1. Open `/admin`
2. Log in
3. Click `+ Baru`
4. Enter the event name and date
5. Save

### Share Chat Link

From `/admin`:

1. Select the event
2. Copy the chat link
3. Share the QR code or URL with the audience

### Use In OBS

1. Open the overlay URL from `/admin`
2. In OBS, add a `Browser Source`
3. Paste:

```text
http://your-app-host/overlay?eventId=<event-id>&obs=1
```

4. Set width/height to match your scene, usually `1920x1080`
5. Keep background transparent

### Moderate Messages

In `/admin`:

1. Open the pending tab
2. Approve or reject messages
3. Use `Kirim Test` to preview overlay behavior
4. Use `Bersihkan Layar` to clear current overlay state

## Troubleshooting

### Symptom: Event not found, but the event exists

Likely causes:

- the event is inactive
- the event ID is wrong
- the database schema is behind the app

Checks:

1. Verify the event row exists in `events`
2. Confirm `is_active = true`
3. Run `npm run check:schema`
4. Run [supabase/schema-repair.sql](/C:/Users/danel/Documents/Project/Running%20Text%20Live%20Event/app/supabase/schema-repair.sql)

### Symptom: Overlay says `Overlay tidak dapat dimuat`

Likely causes:

- `/api/public/events/[id]` is failing
- `overlay_cleared_at` column is missing
- wrong `eventId`

Fix:

1. Repair the schema
2. Restart the app
3. Reload the overlay page

### Symptom: Admin login fails

Checks:

1. Confirm env variables are present
2. Confirm the admin user exists in Supabase Auth
3. Confirm the email is verified if your project requires it
4. Reset the password in Supabase Dashboard if needed

### Symptom: QR code or copied links use the wrong host

Cause:

- `NEXT_PUBLIC_APP_URL` still points to the wrong address

Fix:

1. Update `NEXT_PUBLIC_APP_URL`
2. Restart the server

### Symptom: Clear-screen button fails

Cause:

- `events.overlay_cleared_at` column is missing

Fix:

1. Run [supabase/schema-repair.sql](/C:/Users/danel/Documents/Project/Running%20Text%20Live%20Event/app/supabase/schema-repair.sql)
2. Restart the app

## Closed-Loop Verification Checklist

After setup or repair:

1. Run `npm run check:schema`
2. Open `/chat?eventId=<event-id>`
3. Confirm the event name renders
4. Open `/overlay?eventId=<event-id>&obs=1`
5. Confirm no load error appears
6. Log into `/admin`
7. Send a test message
8. Approve/moderate a message
9. Confirm the overlay updates
10. Use `Bersihkan Layar` and confirm the overlay clears

## Operational Best Practices

- keep one stable public URL for QR usage
- verify schema after every deploy
- keep at least one confirmed admin Auth user
- use `npm run build` before production release
- run Playwright checks after meaningful UI or API changes

## Source Files To Know

- public event route: [src/app/api/public/events/[id]/route.ts](/C:/Users/danel/Documents/Project/Running%20Text%20Live%20Event/app/src/app/api/public/events/[id]/route.ts)
- public messages route: [src/app/api/public/events/[id]/messages/route.ts](/C:/Users/danel/Documents/Project/Running%20Text%20Live%20Event/app/src/app/api/public/events/[id]/messages/route.ts)
- admin clear route: [src/app/api/admin/events/[id]/clear/route.ts](/C:/Users/danel/Documents/Project/Running%20Text%20Live%20Event/app/src/app/api/admin/events/[id]/clear/route.ts)
- schema checker: [scripts/check-supabase-schema.mjs](/C:/Users/danel/Documents/Project/Running%20Text%20Live%20Event/app/scripts/check-supabase-schema.mjs)
- repair SQL: [supabase/schema-repair.sql](/C:/Users/danel/Documents/Project/Running%20Text%20Live%20Event/app/supabase/schema-repair.sql)
