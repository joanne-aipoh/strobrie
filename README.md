# Strobriē By Joanne

The main website for **Strobriē By Joanne**, a cafe and bakery in Abuja,
Nigeria. Content and branding are based on [@strobrie on Instagram](https://instagram.com/strobrie).

A React frontend talks to a Python (FastAPI) backend, which stores menu
items, events/RSVPs, contact messages, and space-rental booking requests in
Postgres.

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
python -m app.seed        # populates menu items and events
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

## Still needed

- Real photos of the space, food, and drinks
- Confirmed street address
- Confirmed contact email
- Production deployment (hosting for the frontend, backend, and database)
