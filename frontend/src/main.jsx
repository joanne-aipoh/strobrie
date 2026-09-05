import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import Home from "./pages/Home.jsx";
import Menu from "./pages/Menu.jsx";
import Events from "./pages/Events.jsx";
import Visit from "./pages/Visit.jsx";

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
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
