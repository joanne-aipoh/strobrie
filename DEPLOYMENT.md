# Deploying to the Hostinger VPS

This assumes a fresh Hostinger VPS (Ubuntu), with `strobrie.com` already
pointed at it in Hostinger's DNS. One server runs everything: Postgres, the
FastAPI backend, and the React frontend (served as static files by Nginx —
same build, served on all three domains: `strobrie.com`, `shop.strobrie.com`,
`flow.strobrie.com`).

## 1. DNS

In Hostinger's DNS zone for `strobrie.com`, add **A records** for `shop` and
`flow`, both pointing at the same VPS IP address as the root domain:

```
Type  Name  Value
A     shop  <your VPS IP>
A     flow  <your VPS IP>
```

That's it for DNS — `shop.strobrie.com` and `flow.strobrie.com` are normal
subdomains served by the same server, not separate hosts.

## 2. Server prerequisites

SSH into the VPS, then:

```bash
sudo apt update && sudo apt install -y nginx postgresql postgresql-contrib python3.12 python3.12-venv nodejs npm certbot python3-certbot-nginx git
```

(If `python3.12` isn't in the default apt repos for your Ubuntu version, use
the [deadsnakes PPA](https://launchpad.net/~deadsnakes/+archive/ubuntu/ppa).)

## 3. Database

```bash
sudo -u postgres createuser strobrie -P   # set a real password when prompted
sudo -u postgres createdb strobrie -O strobrie
```

## 4. Get the code

```bash
cd /var/www
sudo git clone https://github.com/joanne-aipoh/strobrie.git
sudo chown -R $USER:$USER strobrie
cd strobrie
```

## 5. Backend

```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env`:

```
DATABASE_URL=postgresql+psycopg://strobrie:<the password you set>@localhost/strobrie
CORS_ORIGINS=https://strobrie.com,https://shop.strobrie.com,https://flow.strobrie.com
FRONTEND_URL=https://shop.strobrie.com
PAYSTACK_SECRET_KEY=<your live secret key from the Paystack dashboard>
```

Seed the database (menu, community events, inventory/recipes — this is safe
to run once; it skips anything already seeded):

```bash
python -m app.seed
```

Run it as a systemd service so it survives reboots. Create
`/etc/systemd/system/strobrie-api.service`:

```ini
[Unit]
Description=Strobrie FastAPI backend
After=network.target postgresql.service

[Service]
User=www-data
WorkingDirectory=/var/www/strobrie/backend
Environment=PATH=/var/www/strobrie/backend/venv/bin
ExecStart=/var/www/strobrie/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo chown -R www-data:www-data /var/www/strobrie/backend/uploads
sudo systemctl daemon-reload
sudo systemctl enable --now strobrie-api
```

## 6. Frontend

```bash
cd /var/www/strobrie/frontend
npm install
cp .env.example .env
```

Edit `.env`:

```
VITE_API_URL=https://strobrie.com/api
```

(The API is reverse-proxied under `/api` on the same domain in the Nginx
config below, so `strobrie.com`, `shop.strobrie.com`, and `flow.strobrie.com`
can all reach it without a separate CORS-facing hostname for the API itself.)

```bash
npm run build
```

This produces `frontend/dist/` — the same build is served on all three
domains. Re-run `npm run build` (and reload Nginx isn't even necessary — it
just reads the files) every time you deploy new frontend changes.

## 7. Nginx

Create `/etc/nginx/sites-available/strobrie.com`:

```nginx
server {
    listen 80;
    server_name strobrie.com www.strobrie.com;
    root /var/www/strobrie/frontend/dist;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:8000;
    }

    location / {
        try_files $uri /index.html;
    }
}
```

Create `/etc/nginx/sites-available/shop.strobrie.com` and
`/etc/nginx/sites-available/flow.strobrie.com` — both identical to the block
above, just a different `server_name` each (the frontend code detects the
`shop.`/`flow.` hostname itself and shows the storefront or Flow instead of
the marketing site):

```nginx
server {
    listen 80;
    server_name shop.strobrie.com;
    root /var/www/strobrie/frontend/dist;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:8000;
    }

    location / {
        try_files $uri /index.html;
    }
}
```

```nginx
server {
    listen 80;
    server_name flow.strobrie.com;
    root /var/www/strobrie/frontend/dist;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:8000;
    }

    location / {
        try_files $uri /index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/strobrie.com /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/shop.strobrie.com /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/flow.strobrie.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 8. HTTPS

```bash
sudo certbot --nginx -d strobrie.com -d www.strobrie.com -d shop.strobrie.com -d flow.strobrie.com
```

Certbot edits all three server blocks to add TLS and a redirect from port 80.

**Worth considering for `flow.strobrie.com` specifically**: since it's a
staff-only tool with no reason to be publicly discoverable, you could
additionally lock it down with HTTP Basic Auth in front of the app (an extra
`auth_basic` line in that one server block) or restrict it to specific IPs —
Flow's own PIN login still applies underneath either way. Not required to
launch, just worth knowing it's an option since this subdomain is easier to
stumble onto than a URL path was.

## 9. Go live checklist

- [ ] DNS: `shop` and `flow` A records added, propagated
      (`dig shop.strobrie.com`, `dig flow.strobrie.com`)
- [ ] `backend/.env`: real `DATABASE_URL`, `CORS_ORIGINS` includes all three
      domains, `PAYSTACK_SECRET_KEY` is your **live** key (not test)
- [ ] `python -m app.seed` run once
- [ ] `strobrie-api` systemd service running (`systemctl status strobrie-api`)
- [ ] `frontend/.env`: `VITE_API_URL` points at the production API path,
      then `npm run build`
- [ ] All three Nginx server blocks enabled, `nginx -t` passes
- [ ] HTTPS issued for all three hostnames
- [ ] Visit `https://strobrie.com` — marketing site loads
- [ ] Visit `https://shop.strobrie.com` — storefront loads at `/`, not
      `/shop`
- [ ] Visit `https://flow.strobrie.com` — staff login loads at `/`, not
      `/pos`
- [ ] Log into `https://flow.strobrie.com`, add at least one real product
      with real photos in the **Products** tab, mark it "Available online"
- [ ] Place a real ₦100-ish test order through the live storefront to
      confirm Paystack, then void/refund it from your Paystack dashboard
- [ ] Check `https://flow.strobrie.com/orders` shows it

## Redeploying after future changes

```bash
cd /var/www/strobrie
git pull
cd backend && source venv/bin/activate && pip install -r requirements.txt && sudo systemctl restart strobrie-api
cd ../frontend && npm install && npm run build
```
