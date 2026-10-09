// Strobriē has no street frontage — it's set back inside HFIA Garden — so the
// job of this page is to help someone actually find the door: an exact map
// pin, one-tap directions, and a WhatsApp button for "I'm outside, where?".
const MAPS_PIN = "https://www.google.com/maps?cid=9023339216612327777";
const MAP_EMBED =
  "https://maps.google.com/maps?q=9.0329,7.4839(Strobri%C4%93%20By%20Joanne)&z=16&output=embed";
const WHATSAPP =
  "https://wa.me/2348090701995?text=" +
  encodeURIComponent("Hi Strobriē! Please help me with directions to the cafe — I'm on my way.");

export default function Visit() {
  return (
    <>
      <section className="section">
        <div className="container">
          <h2 style={{ fontSize: "1.75rem", marginBottom: "0.25rem" }}>Find Us</h2>
          <p style={{ marginTop: 0 }}>
            HFIA Garden, Off Tafawa Balewa Road, Garki, Abuja. We&rsquo;re tucked inside the
            garden &mdash; follow the pin, not the street.
          </p>

          <div
            style={{
              borderRadius: 16,
              overflow: "hidden",
              border: "1px solid rgba(0,0,0,0.1)",
              boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
              margin: "1.25rem 0",
            }}
          >
            <iframe
              title="Map to Strobriē By Joanne, HFIA Garden, Garki"
              src={MAP_EMBED}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              style={{ width: "100%", height: 360, border: 0, display: "block" }}
            />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
            <a
              className="button button-primary"
              href={MAPS_PIN}
              target="_blank"
              rel="noopener noreferrer"
            >
              Get directions &rarr;
            </a>
            <a
              className="button button-ghost"
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
            >
              Message us on WhatsApp
            </a>
          </div>

          <p>
            Mon&ndash;Thu 8am&ndash;6pm &middot; Fri 8am&ndash;9pm
            <br />
            Sat 9am&ndash;6pm &middot; Sun 10am&ndash;3pm
          </p>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container visit-grid">
          <div>
            <h2>Get in Touch</h2>
            {/* Numbers stack in their own column so the second one lines up
                under the first rather than under the "Phone:" label. */}
            <p style={{ display: "flex", gap: "0.35rem" }}>
              <span>Phone:</span>
              <span style={{ display: "flex", flexDirection: "column" }}>
                <a href="tel:+2348090701995">+234 809 070 1995</a>
                <a href="tel:+2348029125229">+234 802 912 5229</a>
              </span>
            </p>
            <p>Email: <a href="mailto:reservation@strobrie.com">reservation@strobrie.com</a></p>
            <p>
              Instagram:{" "}
              <a href="https://instagram.com/strobrie" target="_blank" rel="noopener noreferrer">
                @strobrie
              </a>
            </p>
          </div>
          <div>
            <h2>Enjoyed your visit?</h2>
            <div style={{ textAlign: "center" }}>
              <a
                href="https://g.page/r/CWGBB7Y1Vzl9EAE/review"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-block", fontWeight: 700, marginBottom: "0.75rem" }}
              >
                Leave a review
              </a>
              <br />
              <a
                href="https://g.page/r/CWGBB7Y1Vzl9EAE/review"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-block" }}
              >
                <img
                  src="/google-review-qr.png"
                  alt="Scan to leave Strobriē a Google review"
                  style={{ width: 140, height: 140, borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)" }}
                />
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
