import "@fontsource-variable/inter";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { SyncProvider } from "./contexts/SyncContext.jsx";
import { ToastProvider } from "./contexts/ToastContext.jsx";
import { VoiceProvider } from "./contexts/VoiceContext.jsx";
import { refreshLanguagePack } from "./lib/i18n.js";
import { ACTIVE_LANGUAGE } from "./lib/i18nState.js";
import "./styles.css";

document.documentElement.dataset.language = ACTIVE_LANGUAGE.code;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <VoiceProvider>
        <ToastProvider>
          <AuthProvider>
            <SyncProvider>
              <App />
            </SyncProvider>
          </AuthProvider>
        </ToastProvider>
      </VoiceProvider>
    </BrowserRouter>
  </React.StrictMode>
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// Captured early so the install card can still offer the browser prompt after
// React mounts; the default mini-infobar is replaced by our own button.
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  window.__mindersInstallPrompt = event;
  window.dispatchEvent(new Event("minders:install-available"));
});

// A newer word pack for the chosen language is used the next time the app opens.
window.addEventListener("load", () => {
  refreshLanguagePack();
});
