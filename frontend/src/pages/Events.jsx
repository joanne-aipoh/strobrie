import { useEffect, useState } from "react";
import { api } from "../api.js";

const STATIC_OFFERINGS = [
  {
    title: "Rent Our Space",
    description:
      "Up to 50 guests — birthdays, corporate gatherings, brunch parties, and private dinners.",
  },
  { title: "Art Events", description: "Community art sessions in the cafe." },
  { title: "Pottery", description: "Hands-on pottery sessions for all skill levels." },
  { title: "Sip & Paint", description: "Drinks, canvases, and good company." },
];

function formatEventDate(iso) {
  return new Date(iso).toLocaleString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
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

export default function Events() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);

  function loadEvents() {
    api
      .getEvents()
      .then(setEvents)
      .catch((err) => setError(err.message));
  }

  useEffect(loadEvents, []);

  return (
    <>
      <section className="section">
        <div className="container">
          <h2>Events &amp; Space</h2>
          <div className="event-grid">
            {STATIC_OFFERINGS.map((offering) => (
              <div className="event-card" key={offering.title}>
                <h3>{offering.title}</h3>
                <p>{offering.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <h2>Upcoming Sessions</h2>

          {error && (
            <p className="form-error">
              Couldn't load upcoming events right now ({error}).
            </p>
          )}
          {!events && !error && <p>Loading events&hellip;</p>}
          {events && events.length === 0 && <p>No upcoming sessions posted yet — check back soon.</p>}

          <div className="event-grid">
            {events?.map((event) => (
              <div className="event-card upcoming-card" key={event.id}>
                <h3>{event.title}</h3>
                <p className="event-date">{formatEventDate(event.start_time)}</p>
                <p>{event.description}</p>
                <RsvpForm event={event} onRsvped={loadEvents} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
