# Strobriē By Joanne

The main website for **Strobriē By Joanne**, a cafe and bakery in Abuja,
Nigeria. Content and branding are based on [@strobrie on Instagram](https://instagram.com/strobrie).

A React frontend talks to a Python (FastAPI) backend, which stores menu
items, events/RSVPs, contact messages, and space-rental booking requests in
Postgres.

The frontend also includes **Flow**, an internal till/operations app for
staff, at `/pos` — see [Flow (the POS app)](#flow-the-pos-app) below.

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
python -m app.seed        # populates menu items, events, inventory & recipes
uvicorn app.main:app --reload --port 8000
```

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
| GET | `/api/menu` | List menu items |
| GET | `/api/events` | List upcoming events (with RSVP counts) |
| POST | `/api/events/{id}/rsvps` | RSVP to an event |
| POST | `/api/contact` | Submit a contact message |
| POST | `/api/bookings` | Submit a space-rental booking request |

Flow (the POS) adds a further set of endpoints under `/api/pos/*` — staff,
sales, customers, waste, inventory/recipes, and ticketed events. See
`backend/app/routers/pos_*.py` or the interactive docs at `/docs`.

## Flow (the POS app)

Flow is Strobrie's internal till and operations tool, at `/pos` on the same
frontend. It started as a self-contained prototype and was rebuilt here to
share the same Postgres database as the public site, so every device at the
till sees the same live data.

**First run:** open `/pos` — since no staff exist yet, it prompts to create
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

## Still needed

- Real photos of the space, food, and drinks
- Confirmed street address
- Confirmed contact email
- Production deployment (hosting for the frontend, backend, and database)
