import { useState } from "react";
import { api } from "../api.js";

function BookingForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    event_type: "birthday",
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
      await api.createBookingRequest(form);
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
        max="50"
        placeholder="Guest count"
        required
        value={form.guest_count}
        onChange={(e) => setForm({ ...form, guest_count: Number(e.target.value) })}
      />
      <input
        type="date"
        required
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

export default function Space() {
  return (
    <section className="section">
      <div className="container">
        <h2>Rent Our Space</h2>
        <p>
          Up to 50 guests — birthdays, corporate gatherings, brunch parties, and private
          dinners.
        </p>
        <p>
          Choose the setting that fits your event — our cozy indoor space, or the open-air green
          patio.
        </p>
        <img
          src="/tableview.jpg"
          alt="A full table spread at Strobriē, set up for a gathering"
          style={{ width: "100%", borderRadius: 20, objectFit: "cover", maxHeight: 480, display: "block", marginTop: "1.5rem" }}
        />
        <div className="form-card" style={{ maxWidth: 480, marginTop: "2rem" }}>
          <p className="menu-note">Up to 50 guests &middot; from &#8358;350,000</p>
          <BookingForm />
        </div>
      </div>
    </section>
  );
}
