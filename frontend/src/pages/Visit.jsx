export default function Visit() {
  return (
    <>
      <section className="section">
        <div className="container visit-grid visit-grid-3">
          <div>
            <h2>Visit Us</h2>
            <p>HFIA Garden, Off Tafawa Balewa Road, Garki, Abuja, Federal Capital Territory, Nigeria</p>
            <p>
              Mon&ndash;Thu 8am&ndash;6pm &middot; Fri 8am&ndash;9pm
              <br />
              Sat 9am&ndash;6pm &middot; Sun 10am&ndash;3pm
            </p>
          </div>
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
            <div style={{ textAlign: "center", paddingRight: "3rem" }}>
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
