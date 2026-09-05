# Strobriē By Joanne

The main website for **Strobriē By Joanne**, a cafe and bakery in Abuja,
Nigeria. Content and branding are based on [@strobrie on Instagram](https://instagram.com/strobrie).

A React frontend talks to a Python (FastAPI) backend, which stores menu
items, events/RSVPs, contact messages, and space-rental booking requests in
Postgres.

The frontend also includes:
- **Flow**, an internal till/operations app for staff, at `/pos` in local
  dev — meant to live at `flow.strobrie.com` — see
  [Flow (the POS app)](#flow-the-pos-app) below
- **The shop**, a customer-facing storefront for cakes/drinks/food, at
  `/shop` in local dev — meant to live at `shop.strobrie.com` — see
  [The shop](#the-shop) below

## Structure

- `frontend/` — React app (Vite)
- `backend/` — FastAPI app
- `docker-compose.yml` — local Postgres database

## Running locally

### 1. Database

Start Postgres with Docker:

```bash
docker compose up -d
```

This creates a `strobrie` database with user/password `strobrie`/`strobrie`,
matching `backend/.env.example`.

(No Docker? Any local Postgres works — create a `strobrie` database and point
`DATABASE_URL` in `backend/.env` at it instead.)

### 2. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m app.seed        # populates products (menu), events, inventory & recipes
uvicorn app.main:app --reload --port 8000
```

(Pulling this after having an older checkout with a separate `menu_items`
table? Run `psql -d strobrie -f migrate_menu_to_products.sql` once first —
see that file's header comment. A database that's never been seeded needs
nothing extra.)

The API is now at http://localhost:8000 (interactive docs at `/docs`).

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env       # VITE_API_URL, defaults to http://localhost:8000
npm run dev
```

The site is now at http://localhost:5173.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/shop/products` | List sellable items (the public menu/shop catalog) |
| GET | `/api/events` | List upcoming events (with RSVP counts) |
| POST | `/api/events/{id}/rsvps` | RSVP to an event |
| POST | `/api/contact` | Submit a contact message |
| POST | `/api/bookings` | Submit a space-rental booking request |

The public Menu page and the shop's storefront both read from the same
`/api/shop/products` — see [The shop](#the-shop) below for why there's one
shared catalog rather than two.

Flow (the POS) adds a further set of endpoints under `/api/pos/*` — staff,
sales, customers, waste, inventory/recipes, and ticketed events. See
`backend/app/routers/pos_*.py` or the interactive docs at `/docs`.

The shop adds endpoints under `/api/shop/*` — public product listing and
checkout, plus `/api/shop/admin/*` for product/photo/order management (also
used by Flow's Sell screen and Products tab). See
`backend/app/routers/shop_*.py`.

## Flow (the POS app)

Flow is Strobrie's internal till and operations tool, at `/pos` on the same
frontend in local dev (meant to live at `flow.strobrie.com` in production —
the app detects a `flow.` hostname and shows Flow at `/` instead of the
marketing site; see [DEPLOYMENT.md](DEPLOYMENT.md)). It started as a
self-contained prototype and was rebuilt here to share the same Postgres
database as the public site, so every device at the till sees the same live
data.

**First run:** open `/pos` (or `flow.strobrie.com` in production) — since no
staff exist yet, it prompts to create
the first manager account (name + a 4-6 digit PIN). After that, staff pick
their name and enter their PIN to log in.

**What it does:**
- **Sell** — the till: browse the real menu by category, build a cart
  (including one-off custom items and per-line price overrides), attach a
  loyalty customer by phone to redeem/earn points, charge in Cash or Card,
  and print a receipt
- **Waste log** — record spoilage/breakage/etc. with a cost impact, for
  tracking food cost
- **Customers** — the loyalty list: search, view points/visits/spend, or add
  a customer manually
- **Events** — ticketed events with tiers, capacity, pay-now or reserve/pay-at-door,
  door check-in, and (for managers) a revenue-vs-cost-budget P&L per event.
  This is separate from the public site's RSVP events (Karaoke Night, Sip &
  Paint, etc.) — Flow's events are ticketed/paid, the public ones are free
  RSVPs.
- **Inventory** *(managers)* — stock levels with low-stock flags, restocking,
  and recipes (which ingredients, and how much, each menu item consumes —
  selling an item with a recipe deducts stock automatically, and voiding a
  sale restores it)
- **Reports** *(managers)* — today's/all-time sales, a category breakdown,
  a sale log with void (which reverses inventory and loyalty effects) and
  receipt reprint, and CSV export for sales and waste

**Known limitation — PIN auth is lightweight, by design for now:** logging in
verifies the PIN against the server and never exposes PIN hashes to the
client, but after login there's no session token. Every write request (a
sale, a void, a waste entry, etc.) just carries the staff's numeric ID, which
the browser trusts client-side. This matches how the original prototype
worked and is fine for a LAN-only till, but anyone who can reach the API
directly could impersonate a staff ID. Worth revisiting (e.g. a real session
token) before this is exposed beyond a trusted local network.

## The shop

A customer-facing storefront for ordering cakes, drinks, and food online, at
`/shop` in local dev. In production it's meant to be reached at
`shop.strobrie.com` — the app detects a `shop.` hostname and shows the
storefront at `/` instead of the marketing site (see
[DEPLOYMENT.md](DEPLOYMENT.md) for the Nginx setup that makes that work).

**Catalog**: one shared `products` table powers the shop, the public Menu
page, *and* Flow's Sell screen — the same real menu (transcribed from
Strobrie's actual printed menus — Coffee, Tea, Juices, Smoothies,
Milkshakes, Lemonades, Breakfast, Lunch, Bakery, Cakes, Cheesecakes,
Mocktails, Cocktails, Schweppes, Beer) is sellable in-person and orderable
online, no separate lists to keep in sync. Items sold in multiple sizes or
quantities (cake sizes, box counts, pancake stacks, cocktail flavours) are
each their own product, since they're each independently priced. Each
product can have multiple photos, a stock quantity (or unlimited), and an
"available online" toggle (Flow can still sell a hidden-from-online item at
the till; the toggle only gates the public storefront).

**Managing products & photos**: in Flow, under the manager-only **Products**
tab (`/pos/products`, or `flow.strobrie.com/products` in production) —
add/edit/delete products, upload/reorder/delete photos, quick-restock, and
toggle whether each one is visible in the shop. This is also the easy way to
adjust prices — one edit updates the price everywhere it's sold.

**Checkout**: cart → customer details (pickup or delivery) → redirected to a
Paystack-hosted payment page → redirected back to an order confirmation page,
which verifies the payment server-side before marking the order paid and
decrementing stock. Needs `PAYSTACK_SECRET_KEY` set in `backend/.env` (from
your [Paystack dashboard](https://dashboard.paystack.com)) — without it,
checkout fails with a clear "payments aren't set up yet" message instead of a
confusing error.

**Viewing orders**: in Flow, under the manager-only **Orders** tab
(`/pos/orders`, or `flow.strobrie.com/orders` in production) — lists every
order with items, fulfillment method, payment status, and a dropdown to
update status (pending/paid/fulfilled/cancelled).

**Known limitation**: same trust model as the rest of Flow (see above) — the
admin product/order endpoints under `/api/shop/admin/*` don't re-verify a
staff session per request.

## Still needed

- Real photos of the space, food, and drinks
- Confirmed street address
- Confirmed contact email
- Production deployment — see [DEPLOYMENT.md](DEPLOYMENT.md) for the
  Hostinger VPS setup (Nginx for both domains, systemd service, HTTPS)
- A live (not test) Paystack key once you're ready to accept real payments
