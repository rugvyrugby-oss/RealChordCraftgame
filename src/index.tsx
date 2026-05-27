import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import App from "./App";
import Terms from "./Terms";

const rootElement = document.getElementById("root")!;
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/terms" element={<Terms />} />
      </Routes>
      <footer style={{ textAlign: "center", padding: "16px", marginTop: 8 }}>
        <Link
          to="/terms"
          style={{ color: "#475569", fontSize: 12, fontFamily: "Georgia,serif", textDecoration: "underline" }}
        >
          Terms of Service
        </Link>
      </footer>
    </BrowserRouter>
  </React.StrictMode>
);
