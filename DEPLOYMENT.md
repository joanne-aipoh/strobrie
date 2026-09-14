# Deploying to the Hostinger VPS

This is the real, working procedure — it matches what's actually running in
production, not a plan. One Ubuntu server runs everything: Postgres, the
FastAPI backend, and the React frontend (one build, served by Nginx on all
three hostnames: `strobrie.com`, `shop.strobrie.com`, `flow.strobrie.com`).

Current production: Hostinger VPS, Ubuntu 26.04 "resolute", IP `187.7.21.78`.

> **Read this first if you're rebuilding from scratch.** The two things that
> are *not* in git are the ones that matter most: the **database** and the
> **uploaded product photos**. A `git clone` alone gives you an empty shop.
> See [Moving the real data across](#6-moving-the-real-data-across).

## 1. DNS

Hostinger's own nameservers (`lunar`/`solar.dns-parking.com`) are fine — do
not switch to custom nameservers. In hPanel's DNS record editor, point these
at the VPS IP:

```
Type  Name   Value
A     @      <VPS IP>
A     shop   <VPS IP>
A     flow   <VPS IP>
```

`www` is a CNAME to `strobrie.com` and follows `@` automatically. **Leave the
MX, TXT/SPF, DKIM and DMARC records alone** — mail routing is independent of
these A records, and deleting them breaks the cafe's email.

Check propagation before requesting certificates:

```bash
dig +short strobrie.com A shop.strobrie.com A flow.strobrie.com A
```

## 2. Server prerequisites

```bash
apt update && apt install -y nginx postgresql postgresql-contrib \
  certbot python3-certbot-nginx nodejs npm curl rsync git pipx
```

Ubuntu 26.04 ships Node 22 and Postgres 18, both fine.

## 3. Python 3.12 (not the system Python)

The system Python on 26.04 is **3.14**, and the pinned dependencies in
`requirements.txt` (pydantic 2.10.4, psycopg 3.2.3 — late 2024) have no
wheels for it. Deploy time is the wrong moment to also be upgrading
dependency versions, so install a matching 3.12 instead:

```bash
pipx install uv
export UV_PYTHON_INSTALL_DIR=/opt/uv-python
mkdir -p /opt/uv-python
/root/.local/bin/uv python install 3.12
chmod -R a+rX /opt/uv-python
```

**`/opt`, not the default `~/.local`** — the API runs as `www-data`, which
cannot traverse `/root` (mode 700). Installing there gives a
`203/EXEC Permission denied` loop that looks like a broken service file.

## 4. Database

```bash
DBPASS=$(openssl rand -base64 24 | tr -d "/+=" | head -c 32)
echo "$DBPASS" > /root/.strobrie-dbpass && chmod 600 /root/.strobrie-dbpass
sudo -u postgres psql -c "CREATE ROLE strobrie LOGIN PASSWORD '$DBPASS';"
sudo -u postgres createdb strobrie -O strobrie
```

Postgres listens on localhost only; it is never exposed publicly.

## 5. Code and backend

```bash
mkdir -p /var/www && cd /var/www
git clone https://github.com/joanne-aipoh/strobrie.git
cd strobrie/backend

export PATH="/root/.local/bin:$PATH"
uv venv --python /opt/uv-python/cpython-3.12.14-linux-x86_64-gnu/bin/python3.12 venv
VIRTUAL_ENV=$PWD/venv uv pip install -r requirements.txt
```

Write `/var/www/strobrie/backend/.env`:

```
DATABASE_URL=postgresql+psycopg://strobrie:<generated password>@localhost/strobrie
CORS_ORIGINS=https://strobrie.com,https://www.strobrie.com,https://shop.strobrie.com,https://flow.strobrie.com
FRONTEND_URL=https://shop.strobrie.com
PAYSTACK_SECRET_KEY=
SMTP_USER=
SMTP_PASSWORD=
```

Then fix ownership so the service user can read it:

```bash
chown root:www-data .env && chmod 640 .env
```

Fill the three secrets **on the server**, never through a chat window or a
command line that lands in shell history:

```bash
read -rsp "Paste key: " K && sed -i "s|^PAYSTACK_SECRET_KEY=.*|PAYSTACK_SECRET_KEY=$K|" \
  /var/www/strobrie/backend/.env && unset K && systemctl restart strobrie-api && echo DONE
```

`read -rsp` hides the value, keeps it out of `.bash_history`, and avoids the
quoting mistakes that plain `sed` invites. `SMTP_USER`/`SMTP_PASSWORD` are the
cafe's Gmail address and a 16-character Gmail **App Password**. If they're
blank, checkout still works — customers just get no confirmation email.

## 6. Moving the real data across

**This is the step the old version of this document was missing entirely.**
`python -m app.seed` only creates the demo catalogue. Production holds ~298
products, ~300 photo records and **3,000+ loyalty customers** imported from
Loyverse — seeding would silently discard all of it.

On your Mac:

```bash
cd ~/Documents/strobrie
pg_dump -d strobrie --no-owner --no-acl -f /tmp/strobrie-db.sql
tar -czf /tmp/strobrie-uploads.tar.gz -C backend uploads
scp /tmp/strobrie-db.sql /tmp/strobrie-uploads.tar.gz root@<VPS IP>:/tmp/
```

On the server:

```bash
DBPASS=$(cat /root/.strobrie-dbpass)
PGPASSWORD="$DBPASS" psql -h 127.0.0.1 -U strobrie -d strobrie -v ON_ERROR_STOP=1 -f /tmp/strobrie-db.sql
cd /var/www/strobrie/backend && tar -xzf /tmp/strobrie-uploads.tar.gz
chown -R www-data:www-data uploads
```

Restore **before** first starting the API. The app calls
`Base.metadata.create_all()` at startup, which is a no-op against existing
tables but would otherwise create empty ones. A local Postgres 16 dump
restores into the server's 18 without trouble.

Verify the counts match your local database:

```bash
PGPASSWORD="$DBPASS" psql -h 127.0.0.1 -U strobrie -d strobrie \
  -c "select (select count(*) from products) products,
             (select count(*) from product_photos) photos,
             (select count(*) from loyalty_customers) loyalty;"
ls uploads/products | wc -l
```

## 7. The API service

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
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now strobrie-api
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/api/shop/products   # expect 200
```

The API binds to `127.0.0.1` — it is reachable only through Nginx.

## 8. Frontend

```bash
cd /var/www/strobrie/frontend
echo "VITE_API_URL=" > .env
npm install && npm run build
```

**`VITE_API_URL` must be empty**, not a URL. Every request path in the code
already starts with `/api`, so setting it to `https://strobrie.com/api`
produces `/api/api/shop/products` and breaks every call. Empty means requests
go to whichever origin the page was served from, so one build works on all
three hostnames with no cross-origin traffic at all.

This relies on `import.meta.env.VITE_API_URL ?? "http://localhost:8000"` in
the four API clients — `??`, not `||`, or the empty string falls through to
`localhost:8000` and the production build tries to call the customer's own
machine. Sanity check the build:

```bash
grep -c "localhost:8000" dist/assets/*.js    # must be 0
```

## 9. Nginx

Shared config in `/etc/nginx/snippets/strobrie-app.conf`:

```nginx
root /var/www/strobrie/frontend/dist;
index index.html;

# Product photos are uploaded through Flow; nginx defaults to 1MB, which is
# smaller than most phone photos.
client_max_body_size 25M;

location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /uploads/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    expires 30d;
    add_header Cache-Control "public";
}

location /assets/ {          # Vite content-hashes these
    expires 1y;
    add_header Cache-Control "public, immutable";
}

location / {
    try_files $uri /index.html;
}
```

Then one small server block per hostname, each just
`include snippets/strobrie-app.conf;` with its own `server_name`
(`strobrie.com www.strobrie.com`, `shop.strobrie.com`, `flow.strobrie.com`),
symlinked into `sites-enabled`. Remove the default site, then
`nginx -t && systemctl reload nginx`.

## 10. HTTPS

Only after DNS resolves to the server:

```bash
certbot --nginx -d strobrie.com -d www.strobrie.com \
  -d shop.strobrie.com -d flow.strobrie.com --redirect
```

Certbot rewrites the server blocks for TLS, adds the HTTP→HTTPS redirect, and
installs a renewal timer. Confirm renewal actually works:

```bash
certbot renew --dry-run
systemctl list-timers certbot*
```

No account email is registered, so there are no expiry warning emails — the
timer is the safety net. Add one with `certbot update_account --email ...` if
you'd rather have them.

## 11. Switching Paystack between test and live

Staff practising with the online shop need **test** keys, or they'd be
charging real cards. The live key is kept at `/root/.paystack-live-key`.

```bash
# back to live
sed -i "s|^PAYSTACK_SECRET_KEY=.*|PAYSTACK_SECRET_KEY=$(cat /root/.paystack-live-key)|" \
  /var/www/strobrie/backend/.env && systemctl restart strobrie-api
```

To go to test, paste the `sk_test_` key with the `read -rsp` command in §5.
Check which mode is active without printing the key:

```bash
grep ^PAYSTACK_SECRET_KEY= /var/www/strobrie/backend/.env | cut -c1-30
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $(grep ^PAYSTACK_SECRET_KEY= /var/www/strobrie/backend/.env | cut -d= -f2-)" \
  https://api.paystack.co/balance      # 200 = key valid, 401 = rejected
```

Note: rolling the secret key in the Paystack dashboard invalidates the **test**
key as well as the live one. Re-copy both afterwards.

**While a valid test key is live on a public site, a real customer could place
an order that shows as paid but took no money.** Keep the window short.

## 12. Go-live checklist

- [ ] `dig` shows all three names on the VPS IP
- [ ] Row counts on the server match your local database
- [ ] `ls uploads/products | wc -l` matches local
- [ ] `systemctl is-active strobrie-api nginx postgresql` — all active
- [ ] `grep -c localhost:8000 dist/assets/*.js` is 0
- [ ] HTTPS on all four hostnames; HTTP 301s to HTTPS
- [ ] `certbot renew --dry-run` passes
- [ ] Paystack key returns 200, and is the mode you intend
- [ ] Place a real order end-to-end and confirm it lands in Flow → Orders

## Redeploying after future changes

```bash
cd /var/www/strobrie && git pull
cd backend && VIRTUAL_ENV=$PWD/venv /root/.local/bin/uv pip install -r requirements.txt
systemctl restart strobrie-api
cd ../frontend && npm install && npm run build
```

Nginx serves `dist/` straight from disk, so no reload is needed for frontend
changes. Note this deploys whatever is on **`main`** — make sure work has been
merged there, not left on a feature branch.

**Schema changes have no migration tool.** `create_all()` only ever creates
missing *tables*; a new column on an existing table must be added by hand:

```bash
sudo -u postgres psql -d strobrie -c "ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_notes TEXT;"
```

Adding Alembic is the obvious fix if schema changes become frequent.

## Backups

There is currently **no automated backup**. The database holds thousands of
loyalty customers and every order; the photos are 50MB+ of originals that
exist nowhere else. Worth setting up before the data grows further:

```bash
# nightly dump, keeping two weeks
0 3 * * * PGPASSWORD=$(cat /root/.strobrie-dbpass) pg_dump -h 127.0.0.1 -U strobrie strobrie \
  | gzip > /root/backups/strobrie-$(date +\%F).sql.gz && \
  find /root/backups -name '*.sql.gz' -mtime +14 -delete
```

A dump on the same disk protects against a bad migration, not against losing
the server — copy them off-box (Hostinger snapshots, or `rsync` to another
machine) for that.

## Hardening worth considering

- `ufw` is inactive. Only 22 and 80/443 listen publicly, so it adds little
  today, but `ufw allow 22,80,443/tcp && ufw enable` is cheap insurance.
- `flow.strobrie.com` is a staff tool that's easy to stumble onto. Flow's PIN
  login is client-side only — there is no server-side session check, so the
  API behind it is effectively unauthenticated. An `auth_basic` block or an IP
  allowlist on that one server block would be a real improvement.
