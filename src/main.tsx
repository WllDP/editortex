import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/app/App";
import "@fontsource/montserrat/latin-400.css";
import "@fontsource/montserrat/latin-500.css";
import "@fontsource/montserrat/latin-600.css";
import "@fontsource/montserrat/latin-700.css";
import "@fontsource/montserrat/latin-ext-400.css";
import "@fontsource/montserrat/latin-ext-500.css";
import "@fontsource/montserrat/latin-ext-600.css";
import "@fontsource/montserrat/latin-ext-700.css";
import "@/styles/globals.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
