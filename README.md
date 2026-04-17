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
- `LIVE_DATA_BACKEND`
- `NEXT_PUBLIC_BASE_PATH`
- `NEXT_PUBLIC_APP_URL`

`NEXT_PUBLIC_BASE_PATH` controls where the app is mounted, for example `/liveeventoverlay`.

`LIVE_DATA_BACKEND` controls where events, messages, and CMS content are stored at runtime. Use `local` for the file-backed store in `data/local-db.json` on a standalone host, or `supabase` to keep event/message data in Supabase.

`NEXT_PUBLIC_APP_URL` can be set to the full public base URL used in QR codes when you intentionally want to advertise a deployed/public URL. During normal standalone operation the admin UI prefers the current browser origin plus base path, and warns when that origin is localhost-only.

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

If you already have an older database and event pages say `Event tidak ditemukan atau sudah berakhir`, run [`supabase/schema-repair.sql`](./supabase/schema-repair.sql) and then `npm run check:schema`.

## Documentation

- Complete setup and operations guide: [`docs/COMPLETE_USER_GUIDE.md`](./docs/COMPLETE_USER_GUIDE.md)
- Schema repair SQL: [`supabase/schema-repair.sql`](./supabase/schema-repair.sql)
- Schema compatibility check: `npm run check:schema`
