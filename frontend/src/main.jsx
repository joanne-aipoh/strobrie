import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import Home from "./pages/Home.jsx";
import Menu from "./pages/Menu.jsx";
import Events from "./pages/Events.jsx";
import Visit from "./pages/Visit.jsx";
import PosLayout, { PosManagerRoute } from "./pos/PosLayout.jsx";
import PosSell from "./pos/pages/Sell.jsx";
import PosWaste from "./pos/pages/Waste.jsx";
import PosCustomers from "./pos/pages/Customers.jsx";
import PosEvents from "./pos/pages/Events.jsx";
import PosEventDetail from "./pos/pages/EventDetail.jsx";
import PosInventory from "./pos/pages/Inventory.jsx";
import PosReports from "./pos/pages/Reports.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Home />} />
          <Route path="menu" element={<Menu />} />
          <Route path="events" element={<Events />} />
          <Route path="visit" element={<Visit />} />
        </Route>
        <Route path="/pos" element={<PosLayout />}>
          <Route index element={<Navigate to="/pos/sell" replace />} />
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
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
