import { NavLink, Outlet, useLocation } from "react-router-dom";
import "./shop.css";
import { CartProvider, useCart } from "./CartContext.jsx";
import { isShopHost, shopPath } from "./shopBase.js";

const MAIN_SITE_URL = "https://strobrie.com";

function ShopHeader() {
  const { count } = useCart();
  const location = useLocation();
  const normalize = (p) => p.replace(/\/+$/, "") || "/";
  const onShopRoot = normalize(location.pathname) === normalize(shopPath("/"));
  return (
    <header className="site-header">
      <div className="container header-inner">
        <NavLink to={shopPath("/")} className="logo">
          <span className="logo-name">
            Strobri<span className="logo-e">ē</span>
          </span>
          <span className="logo-sub">shop</span>
        </NavLink>
        <nav className="nav">
          {isShopHost ? <a href={MAIN_SITE_URL}>Main Site</a> : <NavLink to="/">Main Site</NavLink>}
          {!onShopRoot && (
            <NavLink to={shopPath("/")} end>
              All Products
            </NavLink>
          )}
          <NavLink to={shopPath("/cart")} className="cart-link">
            Cart{count > 0 ? ` (${count})` : ""}
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export default function ShopLayout() {
  return (
    <CartProvider>
      <ShopHeader />
      <main>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container">
          <p>&copy; {new Date().getFullYear()} Strobriē By Joanne. All rights reserved.</p>
        </div>
      </footer>
    </CartProvider>
  );
}
