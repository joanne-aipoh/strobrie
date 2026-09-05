import { Link } from "react-router-dom";

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <p className="eyebrow">Cafe &middot; Bakery &middot; Abuja</p>
          <h1>
            Come in. Take a seat.
            <br />
            Order the usual.
          </h1>
          <p className="tagline">
            A cozy, plant-filled corner in Abuja for great coffee, fresh bakes,
            hearty plates, and good company.
          </p>
          <div className="hero-actions">
            <Link to="/menu" className="button button-primary">
              View Menu
            </Link>
            <a
              href="https://instagram.com/strobrie"
              target="_blank"
              rel="noopener noreferrer"
              className="button button-ghost"
            >
              Follow @strobrie
            </a>
          </div>
        </div>
      </section>

      <section id="about" className="section">
        <div className="container about-grid">
          <div>
            <h2>Our Space</h2>
            <p>
              Strobriē By Joanne is a cafe and bakery built around warm wood,
              greenery, and natural light. It's the kind of place to slow down
              over a Ube Latte, catch up with friends, or get a little work
              done &mdash; and on weekends, it doubles as a gathering spot for
              art, pottery, and community events.
            </p>
          </div>
          <div className="about-facts">
            <div className="fact">
              <span className="fact-label">Where</span>
              <span>Abuja, Nigeria</span>
            </div>
            <div className="fact">
              <span className="fact-label">Service</span>
              <span>Dine-in &middot; Pick up &middot; Delivery</span>
            </div>
            <div className="fact">
              <span className="fact-label">Hours</span>
              <span>
                Mon&ndash;Fri 8am&ndash;6pm
                <br />
                Sat 9am&ndash;6pm &middot; Sun 10am&ndash;3pm
              </span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
