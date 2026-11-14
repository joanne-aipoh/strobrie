import { useEffect, useState } from "react";
import { api } from "../api.js";
import { newEventId, track } from "../metaPixel.js";

const SPACES = [
  {
    id: "indoor",
    name: "The Indoor Space",
    photo: "/indoor-space.jpg",
    capacity: "Up to 50 people",
    price: "₦350,000",
    spend: 550000,
    description: "Birthdays, corporate gatherings, brunch parties, & private dinners.",
    offer: "Spend ₦550,000 on your dining experience and enjoy complimentary exclusive venue access.",
  },
  {
    id: "green_patio",
    name: "The Green Patio",
    photo: "/green-patio.jpg",
    capacity: "Up to 50–70 people",
    price: "₦150,000",
    spend: 250000,
    description: "Birthdays, corporate gatherings, brunch parties, private dinners, & sip & paint.",
    offer: "Spend ₦250,000 on your dining experience and enjoy complimentary exclusive venue access.",
  },
  {
    id: "front_lawn",
    name: "The Front Lawn",
    photo: "/front-lawn.jpg",
    capacity: "Up to 100–150 people",
    price: "₦200,000",
    spend: 300000,
    description: "Birthdays, corporate gatherings, brunch parties, private dinners, & pop ups.",
    offer: "Spend ₦300,000 on your dining experience and enjoy complimentary exclusive venue access.",
  },
];

function BookingForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    event_type: "birthday",
    space: "indoor",
    spend: SPACES[0].spend,
    guest_count: 10,
    preferred_date: "",
    notes: "",
  });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      const metaEventId = newEventId();
      await api.createBookingRequest(form, metaEventId);
      track("Lead", { content_category: "space_rental", content_name: form.space }, metaEventId);
      setStatus("success");
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  if (status === "success") {
    return (
      <p className="form-success">
        Thanks! Your space-rental request is in — we'll follow up by email.
      </p>
    );
  }

  return (
    <form className="booking-form" onSubmit={handleSubmit}>
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
        type="tel"
        placeholder="Phone number"
        required
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
      />
      <select
        value={form.space}
        onChange={(e) => {
          // Spend is recorded from the chosen space's tier (no separate control).
          const picked = SPACES.find((s) => s.id === e.target.value);
          setForm({ ...form, space: e.target.value, spend: picked ? picked.spend : form.spend });
        }}
      >
        {SPACES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} — rent {s.price} · min. spend ₦{s.spend.toLocaleString("en-NG")}
          </option>
        ))}
      </select>
      <select
        value={form.event_type}
        onChange={(e) => setForm({ ...form, event_type: e.target.value })}
      >
        <option value="birthday">Birthday celebration</option>
        <option value="corporate">Corporate gathering</option>
        <option value="brunch">Brunch party</option>
        <option value="private_dinner">Private dinner</option>
        <option value="other">Other</option>
      </select>
      <input
        type="number"
        min="1"
        max="150"
        placeholder="Guest count"
        required
        value={form.guest_count}
        onChange={(e) => setForm({ ...form, guest_count: Number(e.target.value) })}
      />
      <input
        type="date"
        required
        min={new Date().toLocaleDateString("en-CA")}
        value={form.preferred_date}
        onChange={(e) => setForm({ ...form, preferred_date: e.target.value })}
      />
      <textarea
        placeholder="Anything else we should know?"
        rows={3}
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
      />
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="button button-primary" disabled={status === "submitting"}>
        {status === "submitting" ? "Sending…" : "Request Booking"}
      </button>
    </form>
  );
}

function SpaceCard({ space, onOpen }) {
  return (
    <div className="event-card">
      <img
        src={space.photo}
        alt={space.name}
        onClick={() => onOpen({ src: space.photo, alt: space.name })}
        style={{ width: "100%", height: "auto", display: "block", borderRadius: 12, marginBottom: "0.75rem", cursor: "zoom-in" }}
        title="Click to view full size"
      />
      <h3 style={{ marginBottom: 2 }}>{space.name}</h3>
      <p className="event-date" style={{ marginBottom: 8 }}>
        {space.capacity} &middot; {space.price}
      </p>
      <p>{space.description}</p>
      <p style={{ fontSize: "0.85rem", color: "var(--color-text-soft, #6b6b6b)", marginTop: 8 }}>{space.offer}</p>
    </div>
  );
}

export default function Space() {
  const [lightbox, setLightbox] = useState(null); // { src, alt } | null

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => e.key === "Escape" && setLightbox(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  return (
    <section className="section">
      <div className="container">
        <h2>Rent Our Space</h2>
        <p>
          Three settings to choose from, each suited to a different kind of gathering — birthdays,
          corporate gatherings, brunch parties, private dinners, and more.
        </p>

        <div className="event-grid" style={{ marginTop: "1.5rem" }}>
          {SPACES.map((space) => (
            <SpaceCard space={space} key={space.id} onOpen={setLightbox} />
          ))}
        </div>

        {lightbox && (
          <div
            onClick={() => setLightbox(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2000,
              padding: 16,
              cursor: "zoom-out",
            }}
          >
            <img
              src={lightbox.src}
              alt={lightbox.alt}
              style={{ maxWidth: "95vw", maxHeight: "92vh", objectFit: "contain", borderRadius: 8, boxShadow: "0 10px 50px rgba(0,0,0,0.5)" }}
            />
            <button
              onClick={() => setLightbox(null)}
              aria-label="Close"
              style={{
                position: "fixed",
                top: 14,
                right: 18,
                width: 42,
                height: 42,
                borderRadius: 999,
                border: "none",
                background: "rgba(255,255,255,0.18)",
                color: "#fff",
                fontSize: 24,
                lineHeight: 1,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>
        )}

        <div className="form-card" style={{ maxWidth: 480, marginTop: "2.5rem" }}>
          <h2 style={{ marginTop: 0 }}>Request a Booking</h2>
          <BookingForm />
        </div>
      </div>
    </section>
  );
}
