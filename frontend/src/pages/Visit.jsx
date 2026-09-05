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

export default function Visit() {
  return (
    <>
      <section className="section">
        <div className="container">
          <div className="form-card" style={{ maxWidth: 480, margin: "0 auto" }}>
            <h2>Send a Message</h2>
            <ContactForm />
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container visit-grid">
          <div>
            <h2>Contact Us</h2>
            <p>HFIA Garden, Off Tafawa Balewa Road, Garki, Abuja, Federal Capital Territory, Nigeria</p>
            <p>Mon&ndash;Fri 8am&ndash;6pm &middot; Sat 9am&ndash;6pm &middot; Sun 10am&ndash;3pm</p>
          </div>
          <div>
            <h2>Get in Touch</h2>
            <p>
              Phone: <a href="tel:+2348090701995">+234 809 070 1995</a> &middot;{" "}
              <a href="tel:+2348029125229">+234 802 912 5229</a>
            </p>
            <p>Email: <a href="mailto:hello@strobrie.com">hello@strobrie.com</a></p>
            <p>
              Instagram:{" "}
              <a href="https://instagram.com/strobrie" target="_blank" rel="noopener noreferrer">
                @strobrie
              </a>
            </p>
            <p>
              We also make custom cakes &mdash; please contact us directly on Instagram or call us
              for customized designs.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
