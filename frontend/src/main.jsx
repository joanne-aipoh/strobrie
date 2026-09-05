import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import Home from "./pages/Home.jsx";
import Menu from "./pages/Menu.jsx";
import Events from "./pages/Events.jsx";
import Space from "./pages/Space.jsx";
import Visit from "./pages/Visit.jsx";
import PosLayout, { PosManagerRoute } from "./pos/PosLayout.jsx";
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
import { isFlowHost, posPath } from "./pos/posBase.js";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {!isShopHost && !isFlowHost && (
          <Route path="/" element={<App />}>
            <Route index element={<Home />} />
            <Route path="menu" element={<Menu />} />
            <Route path="events" element={<Events />} />
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
              <PosManagerRoute>
                <PosInventory />
              </PosManagerRoute>
            }
          />
          <Route
            path="reports"
            element={
              <PosManagerRoute>
                <PosReports />
              </PosManagerRoute>
            }
          />
          <Route
            path="products"
            element={
              <PosManagerRoute>
                <PosProducts />
              </PosManagerRoute>
            }
          />
          <Route
            path="orders"
            element={
              <PosManagerRoute>
                <PosOrders />
              </PosManagerRoute>
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
