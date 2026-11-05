import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import Home from "./pages/Home.jsx";
import Menu from "./pages/Menu.jsx";
import Events from "./pages/Events.jsx";
import EventTicketConfirmation from "./pages/EventTicketConfirmation.jsx";
import Space from "./pages/Space.jsx";
import Visit from "./pages/Visit.jsx";
import PosLayout, { PosOpsRoute } from "./pos/PosLayout.jsx";
import PosSell from "./pos/pages/Sell.jsx";
import PosWaste from "./pos/pages/Waste.jsx";
import PosCustomers from "./pos/pages/Customers.jsx";
import PosEvents from "./pos/pages/Events.jsx";
import PosEventDetail from "./pos/pages/EventDetail.jsx";
import PosInventory from "./pos/pages/Inventory.jsx";
import PosReports from "./pos/pages/Reports.jsx";
import PosProducts from "./pos/pages/Products.jsx";
import PosOrders from "./pos/pages/Orders.jsx";
import ShopLayout from "./shop/ShopLayout.jsx";
import Catalog from "./shop/pages/Catalog.jsx";
import ProductDetail from "./shop/pages/ProductDetail.jsx";
import Cart from "./shop/pages/Cart.jsx";
import Checkout from "./shop/pages/Checkout.jsx";
import OrderConfirmation from "./shop/pages/OrderConfirmation.jsx";
import { isShopHost } from "./shop/shopBase.js";
import { isFlowHost, posPath, ordersEnabled } from "./pos/posBase.js";
import { pageView, startPixel } from "./metaPixel.js";

startPixel();

// Register the service worker so Flow (and the site) can load with no network.
// It only caches the app shell + static assets; API calls stay network-only.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support just won't be available; the app still works online */
    });
  });
}

// A single-page app never reloads between pages, so the pixel's PageView has
// to be sent on every route change rather than once from index.html.
function PixelPageViews() {
  const { pathname } = useLocation();
  useEffect(() => {
    pageView();
  }, [pathname]);
  return null;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <PixelPageViews />
      <Routes>
        {!isShopHost && !isFlowHost && (
          <Route path="/" element={<App />}>
            <Route index element={<Home />} />
            <Route path="menu" element={<Menu />} />
            <Route path="events" element={<Events />} />
            <Route path="events/confirmation" element={<EventTicketConfirmation />} />
            <Route path="space" element={<Space />} />
            <Route path="visit" element={<Visit />} />
          </Route>
        )}
        <Route path={isFlowHost ? "/" : "/pos"} element={<PosLayout />}>
          <Route index element={<Navigate to={posPath("/sell")} replace />} />
          <Route path="sell" element={<PosSell />} />
          <Route path="waste" element={<PosWaste />} />
          <Route path="customers" element={<PosCustomers />} />
          <Route path="events" element={<PosEvents />} />
          <Route path="events/:eventId" element={<PosEventDetail />} />
          <Route
            path="inventory"
            element={
              <PosOpsRoute>
                <PosInventory />
              </PosOpsRoute>
            }
          />
          <Route
            path="reports"
            element={
              <PosOpsRoute>
                <PosReports />
              </PosOpsRoute>
            }
          />
          <Route
            path="products"
            element={
              <PosOpsRoute>
                <PosProducts />
              </PosOpsRoute>
            }
          />
          <Route
            path="orders"
            element={
              ordersEnabled ? (
                <PosOpsRoute>
                  <PosOrders />
                </PosOpsRoute>
              ) : (
                <Navigate to={posPath("/sell")} replace />
              )
            }
          />
        </Route>
        <Route path={isShopHost ? "/" : "/shop"} element={<ShopLayout />}>
          <Route index element={<Catalog />} />
          <Route path="product/:productId" element={<ProductDetail />} />
          <Route path="cart" element={<Cart />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="order-confirmation" element={<OrderConfirmation />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
