import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { PrefsProvider } from "./i18n/PrefsProvider";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <PrefsProvider>
        <App />
      </PrefsProvider>
    </BrowserRouter>
  </StrictMode>,
);
