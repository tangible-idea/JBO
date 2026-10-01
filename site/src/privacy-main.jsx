import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import PrivacyPolicy from "./PrivacyPolicy.jsx";
import "./analytics.js";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PrivacyPolicy />
  </StrictMode>,
);
