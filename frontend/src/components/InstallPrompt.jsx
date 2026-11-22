import { Download, Share, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui.jsx";

const DISMISS_KEY = "minders.install.dismissedAt";
const DISMISS_MS = 30 * 24 * 60 * 60 * 1000;

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export default function InstallPrompt() {
  const [mode, setMode] = useState(null);
  const promptRef = useRef(null);

  useEffect(() => {
    if (isStandalone()) return undefined;
    if (Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < DISMISS_MS) {
      return undefined;
    }

    const showPrompt = (event) => {
      promptRef.current = event;
      setMode("prompt");
    };
    const handleAvailable = () => {
      if (window.__mindersInstallPrompt) showPrompt(window.__mindersInstallPrompt);
    };
    const handleInstalled = () => {
      promptRef.current = null;
      window.__mindersInstallPrompt = null;
      setMode(null);
    };

    window.addEventListener("minders:install-available", handleAvailable);
    window.addEventListener("appinstalled", handleInstalled);
    handleAvailable();

    let timer;
    if (isIOS() && !window.__mindersInstallPrompt) {
      timer = setTimeout(() => setMode((current) => current || "ios"), 4000);
    }

    return () => {
      window.removeEventListener("minders:install-available", handleAvailable);
      window.removeEventListener("appinstalled", handleInstalled);
      clearTimeout(timer);
    };
  }, []);

  if (!mode) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    promptRef.current = null;
    setMode(null);
  }

  async function install() {
    const event = promptRef.current;
    if (!event) return;
    promptRef.current = null;
    window.__mindersInstallPrompt = null;
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") setMode(null);
    else dismiss();
  }

  return (
    <div
      role="region"
      aria-label="Install FarmBok"
      className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-sm rounded-2xl border border-line bg-white p-4 shadow-float md:bottom-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Download size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-ink">Install FarmBok</p>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Close install message"
              className="rounded-lg p-1 text-ink-soft hover:bg-canvas"
            >
              <X size={16} />
            </button>
          </div>
          {mode === "ios" ? (
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              Tap <Share size={12} className="inline align-baseline" aria-hidden="true" /> Share,
              then <span className="font-semibold text-ink">Add to Home Screen</span> to use
              FarmBok like an app, even without internet.
            </p>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              Add FarmBok to your home screen so it opens in one tap and keeps working offline.
            </p>
          )}
          <div className="mt-3 flex gap-2">
            {mode === "prompt" ? (
              <Button size="sm" onClick={install}>
                <Download size={15} /> Install app
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={dismiss}>
              {mode === "ios" ? "Got it" : "Not now"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
