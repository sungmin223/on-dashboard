import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./theme/apple.css";
import "./theme/stage4.css";
import "./theme/sales.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
