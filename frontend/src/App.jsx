import { NavLink, Outlet } from "react-router-dom";

function Header() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <NavLink to="/" className="logo">
          Strobri<span className="logo-e">ē</span>
          <span className="logo-sub">by Joanne</span>
        </NavLink>
        <nav className="nav">
          <NavLink to="/menu">Menu</NavLink>
          <NavLink to="/events">Events &amp; Space</NavLink>
          <NavLink to="/visit">Visit Us</NavLink>
          <a href="https://instagram.com/strobrie" target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
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
