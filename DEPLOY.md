# Deploy

## 1. Point DNS at the VPS (do this first — certificates depend on it)

At your domain registrar/DNS provider, create these A records, all pointing at the VPS's public IP:

- `turkiyeningazetesi.com` → VPS IP
- `www.turkiyeningazetesi.com` → VPS IP
- `turkiyeningazetesi.org` → VPS IP
- `www.turkiyeningazetesi.org` → VPS IP

DNS propagation can take anywhere from a few minutes to a few hours. Verify with `dig turkiyeningazetesi.com +short` (or `nslookup` on Windows) before continuing — it should print the VPS's IP.

## 2. First-time VPS setup

1. Install Docker + the Docker Compose plugin on the VPS.
2. Clone this repo onto the VPS (e.g. into `/opt/gazete`).
3. Create a `.env` file there (not committed) with: `POSTGRES_PASSWORD`, `RESEND_API_KEY`,
   `RESEND_WEBHOOK_SECRET`, `FROM_EMAIL=info@turkiyeningazetesi.com`, `ANTHROPIC_API_KEY`, `BASE_URL=https://turkiyeningazetesi.com`.
   `RESEND_API_KEY` requires verifying `turkiyeningazetesi.com` as a sending domain in the Resend dashboard first (it will ask you to add its own DNS TXT/CNAME records, separate from the A records above).
4. Seed the RSS sources once: `docker compose run --rm migrate npx prisma db seed --schema=packages/db/prisma/schema.prisma`
5. Start the app stack: `docker compose up -d --build` — this does **not** touch ports 80/443; `web` only binds to `127.0.0.1:3000`.
6. Check logs: `docker compose logs -f worker`

## 3. Wire up the existing host nginx (only nginx-level step — do not touch the other two apps' server blocks)

1. Copy `deploy/nginx/gazete.conf` from this repo to `/etc/nginx/sites-available/gazete.conf` on the VPS.
2. Symlink it into `sites-enabled`: `sudo ln -s /etc/nginx/sites-available/gazete.conf /etc/nginx/sites-enabled/gazete.conf`
3. Test the config before reloading, so a typo can't take down the other two apps: `sudo nginx -t`
4. Reload: `sudo systemctl reload nginx`
5. Issue TLS certificates (this edits `gazete.conf` in place to add the HTTPS server blocks): `sudo certbot --nginx -d turkiyeningazetesi.com -d www.turkiyeningazetesi.com -d turkiyeningazetesi.org -d www.turkiyeningazetesi.org`
6. Visit `https://turkiyeningazetesi.com` to confirm the app loads, and `https://turkiyeningazetesi.org` to confirm it redirects.
