import "@fontsource-variable/inter";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { SyncProvider } from "./contexts/SyncContext.jsx";
import { ToastProvider } from "./contexts/ToastContext.jsx";
import { VoiceProvider } from "./contexts/VoiceContext.jsx";
import "./styles.css";

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
