import { Check, Copy, FlaskConical, LayoutDashboard, LogIn } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { buttonClass } from "./ui.jsx";

// "For testers": the shared admin login, shown on the home page only while
// the server has DEMO_ADMIN_ACCESS_CODE and DEMO_ADMIN_PIN set. Delete those
// two variables and this box disappears.
function useDemoAccess() {
  const [demo, setDemo] = useState(null);
  useEffect(() => {
    let active = true;
    api
      .get("/api/public/demo-access")
      .then((result) => active && setDemo(result?.enabled ? result : null))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return demo;
}

function CopyValue({ label, value, inline = false }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the value is on screen to type.
    }
  }
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-xl bg-white ring-1 ring-amber-200 ${
        inline ? "py-1 pl-3 pr-1" : "px-3 py-2"
      }`}
    >
      <span className={inline ? "flex items-baseline gap-2 whitespace-nowrap" : "min-w-0"}>
        <span className="block text-[11px] font-bold uppercase tracking-wide text-amber-800">{label}</span>
        <span className="block whitespace-nowrap font-mono text-base font-bold text-ink">{value}</span>
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label.toLowerCase()}`}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-amber-800 hover:bg-amber-100"
      >
        {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}

export default function DemoAccessCard({ variant = "card" }) {
  const demo = useDemoAccess();
  if (!demo) return null;
  const { accessCode, pin, loginPath } = demo.admin;
  const say = "For testers. Use this access code and PIN to open the admin dashboard.";

  // Desktop: one slim strip under the top menu, seen before scrolling.
  if (variant === "strip") {
    return (
      <section aria-label="Test login" className="border-b border-amber-200 bg-amber-50" data-say={say}>
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-8 py-3">
          <p className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-200/70 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-900">
            <FlaskConical size={13} aria-hidden="true" /> For testers and judges
          </p>
          <p className="min-w-0 flex-1 truncate text-sm text-ink">
            <span className="font-bold">Try the admin dashboard (Ministry view).</span>{" "}
            <span className="text-ink-soft">Shared test login: it cannot change its code or PIN, or send SMS.</span>
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <CopyValue label="Access code" value={accessCode} inline />
            <CopyValue label="PIN" value={pin} inline />
            <Link to={loginPath} state={{ accessCode }} className={buttonClass("primary", "md", "whitespace-nowrap")}>
              <LogIn size={16} aria-hidden="true" /> Admin sign-in
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Test login"
      className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-4"
      data-say={say}
    >
      <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-200/70 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-900">
        <FlaskConical size={13} aria-hidden="true" /> For testers and judges
      </p>
      <h2 className="mt-2 flex items-center gap-2 text-base font-bold text-ink">
        <LayoutDashboard size={18} className="shrink-0 text-amber-800" aria-hidden="true" />
        Try the admin dashboard (Ministry view)
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        A shared test login: you can look around and try things, but it cannot change its code or PIN, or send SMS.
      </p>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <CopyValue label="Access code" value={accessCode} />
        <CopyValue label="PIN" value={pin} />
        <Link to={loginPath} state={{ accessCode }} className={buttonClass("primary", "lg", "col-span-2 w-full")}>
          <LogIn size={18} aria-hidden="true" /> Open admin sign-in
        </Link>
      </div>
    </section>
  );
}
