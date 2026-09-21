import { whatsappLink } from "../whatsapp.js";

// Shared footer used across the marketing site and the shop, so contact
// details sit at the bottom of every page.
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer-contact">
          <h3>Contact Us</h3>
          <p>HFIA Garden, Off Tafawa Balewa Road, Garki, Abuja</p>
          <p>
            <a href="tel:+2348090701995">+234 809 070 1995</a>
            {" · "}
            <a href="tel:+2348029125229">+234 802 912 5229</a>
          </p>
          <p>
            <a href="mailto:reservation@strobrie.com">reservation@strobrie.com</a>
          </p>
          <p className="site-footer-links">
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
            {" · "}
            <a href="https://instagram.com/strobrie" target="_blank" rel="noopener noreferrer">
              @strobrie
            </a>
          </p>
        </div>
        <p className="site-footer-copyright">
          &copy; {new Date().getFullYear()} Strobriē By Joanne. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
