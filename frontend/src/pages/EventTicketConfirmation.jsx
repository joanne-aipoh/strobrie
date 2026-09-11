import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { whatsappLink } from "../whatsapp.js";

export default function EventTicketConfirmation() {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get("reference") || searchParams.get("trxref");
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!reference) return;
    api
      .verifyTicket(reference)
      .then(setTicket)
      .catch((err) => setError(err.message));
  }, [reference]);

  if (!reference) {
    return (
      <div className="container" style={{ padding: "3rem 1.5rem" }}>
        <p>No booking reference found.</p>
        <Link to="/events">&larr; Back to Events</Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ padding: "3rem 1.5rem" }}>
        <p className="form-error">Couldn't confirm this booking ({error}).</p>
      </div>
    );
  }

  if (!ticket) return <p className="container" style={{ padding: "3rem 1.5rem" }}>Confirming your payment&hellip;</p>;

  return (
    <section className="section">
      <div className="container">
        {ticket.paid ? (
          <>
            <h1 style={{ fontSize: "2rem" }}>You're in, {ticket.buyer_name}!</h1>
            <p className="form-success">Payment confirmed — your spot is booked.</p>
            <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>
              Show this page (or your confirmation email) at check-in as proof of payment.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "2rem" }}>Payment not confirmed</h1>
            <p className="form-error">
              We couldn't confirm payment for this booking. If you were charged, please contact us with
              reference {reference}.
            </p>
          </>
        )}

        <p style={{ marginTop: "1.5rem", fontSize: "0.9rem" }}>
          Questions about your booking?{" "}
          <a
            href={whatsappLink(`Hi Strobriē! I have a question about my booking (ticket #${ticket.id}).`)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--color-hot-pink-dark)", fontWeight: 600 }}
          >
            Message us on WhatsApp
          </a>
          .
        </p>

        <Link to="/events" className="link-btn" style={{ display: "inline-block", marginTop: "1rem" }}>
          &larr; Back to Events
        </Link>
      </div>
    </section>
  );
}
