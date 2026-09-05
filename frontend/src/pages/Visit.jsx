import { useState } from "react";
import { api } from "../api.js";

function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      await api.createContactMessage(form);
      setStatus("success");
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  if (status === "success") {
    return <p className="form-success">Thanks for reaching out — we'll reply by email soon.</p>;
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
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
      <textarea
        placeholder="Message"
        required
        rows={4}
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
      />
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="button button-primary" disabled={status === "submitting"}>
        {status === "submitting" ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}

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

export default function Visit() {
  return (
    <>
      <section className="section">
        <div className="container visit-grid">
          <div>
            <h2>Visit Us</h2>
            <p>Abuja, Nigeria &mdash; full address coming soon.</p>
            <p>Mon&ndash;Fri 8am&ndash;6pm &middot; Sat 9am&ndash;6pm &middot; Sun 10am&ndash;3pm</p>
          </div>
          <div>
            <h2>Get in Touch</h2>
            <p>Email: <a href="mailto:hello@strobrie.com">hello@strobrie.com</a></p>
            <p>
              Instagram:{" "}
              <a href="https://instagram.com/strobrie" target="_blank" rel="noopener noreferrer">
                @strobrie
              </a>
            </p>
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container form-grid">
          <div className="form-card">
            <h2>Send a Message</h2>
            <ContactForm />
          </div>
          <div className="form-card">
            <h2>Rent Our Space</h2>
            <p className="menu-note">Up to 50 guests &middot; from &#8358;350,000</p>
            <BookingForm />
          </div>
        </div>
      </section>
    </>
  );
}
