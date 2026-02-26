import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./styles/index.css";
import { applyPrecisionGraphiteTheme, type ThemeMode } from "./styles/tokens";

const storedTheme = localStorage.getItem("pgc-theme-mode");
let initialTheme: ThemeMode = "dark";

if (storedTheme === "light" || storedTheme === "dark") {
  initialTheme = storedTheme;
} else if (
  window.matchMedia &&
  window.matchMedia("(prefers-color-scheme: light)").matches
) {
  initialTheme = "light";
}

applyPrecisionGraphiteTheme(initialTheme);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
