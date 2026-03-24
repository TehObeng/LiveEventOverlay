# Live Chat Overlay

Real-time audience chat for live events with:

- public chat submission
- OBS-friendly overlay rendering
- admin moderation and event management

## Stack

- Next.js 16 App Router
- React 19
- Supabase Auth + Postgres

## Environment

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

`NEXT_PUBLIC_APP_URL` should be the real public base URL used in QR codes. If it still points to `localhost`, the admin UI falls back to the current browser origin and warns you.

After updating env values, restart the dev server so Next.js reloads environment variables (`Ctrl+C`, then `npm run dev`).

## Commands

```bash
npm install
npm run dev
npm run lint
npm run test
npm run build
```

## Architecture

- `/chat` loads safe public event data from `/api/public/*`
- `/overlay` polls safe public APIs for approved messages and clear-screen state
- `/admin` uses browser Supabase only for auth/session and server `/api/admin/*` routes for all event/message data
- `/api/message` is the only anonymous write endpoint

## Database

Apply [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL editor. The checked-in schema is the source of truth for:

- overlay configuration defaults
- moderation columns
- `overlay_cleared_at` clear-screen support
- tightened RLS that blocks public browser access to raw tables
