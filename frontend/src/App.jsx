import { NavLink, Outlet } from "react-router-dom";

const SHOP_SITE_URL = "https://shop.strobrie.com";
const isLocalDev = typeof window !== "undefined" && window.location.hostname === "localhost";

function Header() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <NavLink to="/" className="logo">
          <span className="logo-name">
            Strobri<span className="logo-e">ē</span>
          </span>
          <span className="logo-sub">by Joanne</span>
        </NavLink>
        <nav className="nav">
          <NavLink to="/menu">Menu</NavLink>
          {isLocalDev ? <NavLink to="/shop">Shop</NavLink> : <a href={SHOP_SITE_URL}>Shop</a>}
          <NavLink to="/events">Events</NavLink>
          <NavLink to="/space">Space</NavLink>
          <NavLink to="/visit">Contact Us</NavLink>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <p>&copy; {new Date().getFullYear()} Strobriē By Joanne. All rights reserved.</p>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
