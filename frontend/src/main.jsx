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
import Pottery from "./pages/Pottery.jsx";
import PotteryConfirmation from "./pages/PotteryConfirmation.jsx";
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
import PosPottery from "./pos/pages/Pottery.jsx";
import PosSpaceRequests from "./pos/pages/SpaceRequests.jsx";
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

// Offline support is only for Flow (the till). The public site and shop should
// always be fresh, so we register the service worker on the Flow host only and
// actively unregister any that lingered on the other hosts (it used to register
// everywhere, which made the marketing site cache a stale version).
if ("serviceWorker" in navigator) {
  if (isFlowHost) {
    window.addEventListener("load", () => {
      const notify = (reg) => {
        window.__flowSwReg = reg;
        window.dispatchEvent(new Event("flow-update-available"));
      };
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          if (reg.waiting && navigator.serviceWorker.controller) notify(reg);
          reg.addEventListener("updatefound", () => {
            const sw = reg.installing;
            if (!sw) return;
            sw.addEventListener("statechange", () => {
              if (sw.state === "installed" && navigator.serviceWorker.controller) notify(reg);
            });
          });
        })
        .catch(() => {});
      // When the new worker takes over (after the user taps Update), reload once.
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });
    });
  } else {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {});
    if (window.caches) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
  }
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
            <Route path="pottery" element={<Pottery />} />
            <Route path="pottery/confirmation" element={<PotteryConfirmation />} />
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
            path="pottery"
            element={
              <PosOpsRoute>
                <PosPottery />
              </PosOpsRoute>
            }
          />
          <Route
            path="space-requests"
            element={
              <PosOpsRoute>
                <PosSpaceRequests />
              </PosOpsRoute>
            }
          />
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
          <Route path="products" element={<PosProducts />} />
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
