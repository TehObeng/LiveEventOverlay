# Hostinger VPS deployment

This app cannot run on GitHub Pages as-is because it uses:
- Next.js Route Handlers under `src/app/api/*`
- cookie-based admin sessions
- server-side Supabase access with `SUPABASE_SERVICE_ROLE_KEY`

Recommended non-Netlify host: Hostinger VPS or any Node-capable server.

## What this repo now supports

- `next.config.ts` uses `output: 'standalone'`
- `Dockerfile` builds a production-ready standalone container
- `docker-compose.yml` runs the app on port `3000`

## Required environment variables

Create `.env.production` on the server with:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_BASE_PATH=/liveeventoverlay
NEXT_PUBLIC_APP_URL=https://eventdanel.site/liveeventoverlay
```

## VPS deployment steps

1. Install Docker and Docker Compose plugin on the VPS.
2. Clone the repo:

```bash
git clone https://github.com/TehObeng/LiveEventOverlay.git
cd LiveEventOverlay
```

3. Create `.env.production`.
4. Build and start:

```bash
docker compose up -d --build
```

5. Put a reverse proxy in front of port 3000.

Example Nginx config:

```nginx
location /liveeventoverlay/ {
    proxy_pass http://127.0.0.1:3000/liveeventoverlay/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}

location = /liveeventoverlay {
    return 301 /liveeventoverlay/;
}
```

## Update workflow after deployment

```bash
cd LiveEventOverlay
git pull origin main
docker compose up -d --build
```

## If you only have regular shared hosting

Regular static/shared hosting or GitHub Pages will not work without a major rewrite that removes the server APIs and service-role logic.
