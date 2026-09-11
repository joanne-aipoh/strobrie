import { useEffect, useState } from "react";
import { api } from "../api.js";

function formatEventDate(iso) {
  return new Date(iso).toLocaleString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmt(n) {
  return `₦${n.toLocaleString("en-NG")}`;
}

function formatTicketedDate(dateStr, time) {
  const d = new Date(`${dateStr}T00:00:00`);
  const dateLabel = d.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" });
  return time ? `${dateLabel} — ${time}` : dateLabel;
}

// Calendar-date key (YYYY-MM-DD) in the viewer's local timezone — used to
// group events onto the same day regardless of what time each one is at.
function localDateKey(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function BuySpotForm({ event }) {
  // Tiers that share the same price are treated as flavor/variant choices of
  // one product (e.g. "pick your breakfast") — shown as a single price with
  // a plain choice list. Tiers with a distinct price (e.g. a multi-session
  // pack) are genuinely different products, shown separately with their own
  // price. This reads correctly however staff rename/reprice tiers week to
  // week, with no extra data needed beyond price grouping.
  const priceGroups = {};
  for (const tier of event.tiers) {
    (priceGroups[tier.price] ||= []).push(tier);
  }
  const groupedPrices = Object.keys(priceGroups)
    .map(Number)
    .sort((a, b) => a - b);
  const commonPrice = groupedPrices.length ? groupedPrices[0] : null;
  const choiceTiers = commonPrice !== null ? priceGroups[commonPrice] : [];
  const altTierGroups = groupedPrices.slice(1);

  const [tierId, setTierId] = useState(choiceTiers[0]?.id ?? event.tiers[0]?.id ?? null);
  const [form, setForm] = useState({ buyer_name: "", buyer_email: "", buyer_contact: "" });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  const isFull = event.spots_remaining === 0;
  const selectedTier = event.tiers.find((t) => t.id === tierId);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!tierId) return;
    setStatus("submitting");
    setError(null);
    try {
      const result = await api.buyTicket(event.id, {
        tier_id: tierId,
        ...form,
        callback_url: `${window.location.origin}/events/confirmation`,
      });
      window.location.href = result.authorization_url;
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  if (isFull) {
    return <p className="form-note">This session is fully booked.</p>;
  }

  return (
    <form className="rsvp-form" onSubmit={handleSubmit}>
      <div className="form-field">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <label style={{ fontSize: 13 }}>Choose your breakfast</label>
          <span style={{ fontWeight: 700 }}>{fmt(commonPrice)} per spot</span>
        </div>
        {choiceTiers.map((tier) => (
          <label
            key={tier.id}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "0.6rem 0.9rem",
              border: "1px solid rgba(0,0,0,0.15)",
              borderRadius: 10,
              marginBottom: 6,
              cursor: tier.remaining === 0 ? "not-allowed" : "pointer",
              opacity: tier.remaining === 0 ? 0.5 : 1,
            }}
          >
            <input
              type="radio"
              name={`tier-${event.id}`}
              checked={tierId === tier.id}
              disabled={tier.remaining === 0}
              onChange={() => setTierId(tier.id)}
              style={{ marginRight: 8 }}
            />
            {tier.name}
            {tier.remaining === 0 ? " (sold out)" : ""}
          </label>
        ))}
      </div>

      {altTierGroups.map((price) => (
        <div className="form-field" key={price}>
          <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>Or, a different option</label>
          {priceGroups[price].map((tier) => (
            <label
              key={tier.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.6rem 0.9rem",
                border: "1px solid rgba(0,0,0,0.15)",
                borderRadius: 10,
                marginBottom: 6,
                cursor: tier.remaining === 0 ? "not-allowed" : "pointer",
                opacity: tier.remaining === 0 ? 0.5 : 1,
              }}
            >
              <span>
                <input
                  type="radio"
                  name={`tier-${event.id}`}
                  checked={tierId === tier.id}
                  disabled={tier.remaining === 0}
                  onChange={() => setTierId(tier.id)}
                  style={{ marginRight: 8 }}
                />
                {tier.name}
                {tier.remaining === 0 ? " (sold out)" : ""}
              </span>
              <span style={{ fontWeight: 700 }}>{fmt(tier.price)}</span>
            </label>
          ))}
        </div>
      ))}
      <input
        type="text"
        placeholder="Your name"
        required
        value={form.buyer_name}
        onChange={(e) => setForm({ ...form, buyer_name: e.target.value })}
      />
      <input
        type="email"
        placeholder="Email"
        required
        value={form.buyer_email}
        onChange={(e) => setForm({ ...form, buyer_email: e.target.value })}
      />
      <input
        type="text"
        placeholder="Phone"
        required
        value={form.buyer_contact}
        onChange={(e) => setForm({ ...form, buyer_contact: e.target.value })}
      />
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="button button-primary" disabled={status === "submitting" || !selectedTier}>
        {status === "submitting" ? "Redirecting to payment…" : selectedTier ? `Book Spot — ${fmt(selectedTier.price)}` : "Book Spot"}
      </button>
    </form>
  );
}

function TicketedEventCard({ event, featured }) {
  return (
    <div
      className="event-card upcoming-card"
      style={featured ? { padding: "2.25rem", maxWidth: 560, margin: "0 auto" } : undefined}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: featured ? "1.6rem" : undefined }}>{event.name}</h3>
        {event.spots_remaining !== null && (
          <span
            style={{
              flexShrink: 0,
              background: event.spots_remaining === 0 ? "#e5e5e5" : "var(--color-hot-pink-dark)",
              color: event.spots_remaining === 0 ? "#666" : "#fff",
              fontSize: featured ? 13 : 12,
              fontWeight: 700,
              padding: featured ? "5px 12px" : "4px 10px",
              borderRadius: 999,
              whiteSpace: "nowrap",
            }}
          >
            {event.spots_remaining === 0
              ? "Fully booked"
              : `${event.spots_remaining} spot${event.spots_remaining === 1 ? "" : "s"} left`}
          </span>
        )}
      </div>
      <p className="event-date" style={featured ? { fontSize: "0.95rem" } : undefined}>
        {formatTicketedDate(event.date, event.time)}
      </p>
      {event.description && <p>{event.description}</p>}
      <BuySpotForm event={event} />
    </div>
  );
}

function RsvpForm({ event, onRsvped }) {
  const [form, setForm] = useState({ name: "", email: "", party_size: 1 });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  const spotsLeft =
    event.capacity != null ? Math.max(event.capacity - event.rsvp_count, 0) : null;
  const isFull = spotsLeft === 0;

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      await api.createRsvp(event.id, form);
      setStatus("success");
      onRsvped();
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  if (status === "success") {
    return <p className="form-success">You're on the list! See you there.</p>;
  }

  if (isFull) {
    return <p className="form-note">This session is fully booked.</p>;
  }

  return (
    <form className="rsvp-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Your name"
        required
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <input
        type="email"
        placeholder="Email"
        required
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <input
        type="number"
        min="1"
        max="10"
        required
        value={form.party_size}
        onChange={(e) => setForm({ ...form, party_size: Number(e.target.value) })}
      />
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="button button-primary" disabled={status === "submitting"}>
        {status === "submitting" ? "Sending…" : "RSVP"}
      </button>
    </form>
  );
}

function RsvpEventCard({ event, onRsvped, featured }) {
  return (
    <div
      className="event-card upcoming-card"
      style={featured ? { padding: "2.25rem", maxWidth: 560, margin: "0 auto" } : undefined}
    >
      <h3 style={featured ? { fontSize: "1.6rem" } : undefined}>{event.title}</h3>
      <p className="event-date" style={featured ? { fontSize: "0.95rem" } : undefined}>
        {formatEventDate(event.start_time)}
      </p>
      <p>{event.description}</p>
      <RsvpForm event={event} onRsvped={onRsvped} />
    </div>
  );
}

export default function Events() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);
  const [ticketedEvents, setTicketedEvents] = useState(null);
  const [ticketedError, setTicketedError] = useState(null);

  function loadEvents() {
    api
      .getEvents()
      .then(setEvents)
      .catch((err) => setError(err.message));
  }

  useEffect(loadEvents, []);
  useEffect(() => {
    api
      .getTicketedEvents()
      .then(setTicketedEvents)
      .catch((err) => setTicketedError(err.message));
  }, []);

  // Both lists come back soonest-first from the backend. Whichever calendar
  // date is nearest overall (across both event types, time of day ignored)
  // gets the big, featured treatment up top — every event on that date,
  // ticketed or RSVP, renders side by side there; everything else stays in
  // its normal section below.
  const nextTicketedDate = ticketedEvents?.[0]?.date ?? null;
  const nextRsvpDate = events?.[0] ? localDateKey(events[0].start_time) : null;
  const soonestDate = [nextTicketedDate, nextRsvpDate].filter(Boolean).sort()[0] ?? null;

  const featuredTicketed = soonestDate ? (ticketedEvents ?? []).filter((e) => e.date === soonestDate) : [];
  const featuredRsvp = soonestDate ? (events ?? []).filter((e) => localDateKey(e.start_time) === soonestDate) : [];
  const featuredItems = [
    ...featuredTicketed.map((data) => ({ kind: "ticketed", data })),
    ...featuredRsvp.map((data) => ({ kind: "rsvp", data })),
  ];

  const remainingTicketed = soonestDate ? (ticketedEvents ?? []).filter((e) => e.date !== soonestDate) : ticketedEvents ?? [];
  const remainingRsvp = soonestDate ? (events ?? []).filter((e) => localDateKey(e.start_time) !== soonestDate) : events ?? [];

  return (
    <>
      <section className="section">
        <div className="container">
          <h2>Events</h2>
          <p>
            From art nights and pottery sessions to Sunday morning yoga and everything in between, we host a mix
            of paid and drop-in events throughout the month — see what's coming up below.
          </p>
        </div>
      </section>

      <p style={{ textAlign: "center", fontWeight: 700, fontSize: "1.1rem", margin: 0, padding: "0 1.5rem" }}>
        Book your spot now. Come back for new upcoming events weekly.
      </p>

      {featuredItems.length > 0 && (
        <section className="section section-alt">
          <div className="container">
            <h2>Coming Up Next</h2>
            <div
              style={
                featuredItems.length > 1
                  ? { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2rem" }
                  : undefined
              }
            >
              {featuredItems.map((item) =>
                item.kind === "ticketed" ? (
                  <TicketedEventCard event={item.data} featured key={`t-${item.data.id}`} />
                ) : (
                  <RsvpEventCard event={item.data} onRsvped={loadEvents} featured key={`r-${item.data.id}`} />
                )
              )}
            </div>
          </div>
        </section>
      )}

      <section className={featuredItems.length > 0 ? "section" : "section section-alt"}>
        <div className="container">
          <h2>Breakfast &amp; Yoga</h2>
          <p style={{ marginBottom: "1.5rem" }}>
            Sunday mornings — book your spot and pick your breakfast. Options are limited each week.
          </p>

          {ticketedError && (
            <p className="form-error">Couldn't load sessions right now ({ticketedError}).</p>
          )}
          {!ticketedEvents && !ticketedError && <p>Loading sessions&hellip;</p>}
          {ticketedEvents && ticketedEvents.length === 0 && (
            <p>No sessions posted yet — check back soon.</p>
          )}
          {ticketedEvents && ticketedEvents.length > 0 && remainingTicketed.length === 0 && (
            <p className="form-note">See the featured session above — check back for more soon.</p>
          )}

          {remainingTicketed.length > 0 && (
            <div className="event-grid">
              {remainingTicketed.map((event) => (
                <TicketedEventCard event={event} key={event.id} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2>Upcoming Sessions</h2>

          {error && (
            <p className="form-error">
              Couldn't load upcoming events right now ({error}).
            </p>
          )}
          {!events && !error && <p>Loading events&hellip;</p>}
          {events && events.length === 0 && <p>No upcoming sessions posted yet — check back soon.</p>}
          {events && events.length > 0 && remainingRsvp.length === 0 && (
            <p className="form-note">See the featured session above — check back for more soon.</p>
          )}

          {remainingRsvp.length > 0 && (
            <div className="event-grid">
              {remainingRsvp.map((event) => (
                <RsvpEventCard event={event} onRsvped={loadEvents} key={event.id} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
