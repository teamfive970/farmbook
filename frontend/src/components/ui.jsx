import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  Cloud,
  Inbox,
  Loader2,
  Smartphone,
  X
} from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { WORDS } from "../lib/words.js";
import { SpeakButton, useSpeakOnOpen } from "./Voice.jsx";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60";

const sizes = {
  sm: "min-h-9 px-3 text-xs",
  md: "min-h-12 px-4 text-sm",
  lg: "min-h-14 px-5 text-base"
};

const variants = {
  primary: "bg-primary text-white shadow-sm hover:bg-primary-dark",
  secondary: "border border-line bg-white text-ink hover:bg-primary-soft",
  ghost: "text-primary hover:bg-primary-soft",
  danger: "bg-danger text-white hover:bg-red-700"
};

export function buttonClass(variant = "primary", size = "md", className = "") {
  return `${base} ${sizes[size] || sizes.md} ${variants[variant] || variants.primary} ${className}`;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  type = "button",
  disabled,
  ...props
}) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Card({ className = "", as: Tag = "div", children, ...props }) {
  return (
    <Tag className={`rounded-2xl bg-white p-5 shadow-card ${className}`} {...props}>
      {children}
    </Tag>
  );
}

// `say`: a phrase (from words.js) read aloud when the page opens with "Talk to
// me" on, and whenever the speaker button is tapped.
export function PageHeader({ title, subtitle, backTo, action, say, className = "" }) {
  useSpeakOnOpen(say);
  return (
    <div className={`mb-5 flex items-start justify-between gap-3 ${className}`}>
      <div className="flex items-start gap-2">
        {backTo && (
          <Link
            to={backTo}
            aria-label="Go back"
            className="-ml-2 mt-0.5 rounded-full p-2 text-ink-soft hover:bg-primary-soft hover:text-primary-dark"
          >
            <ChevronLeft size={20} />
          </Link>
        )}
        <div>
          <h1 className="text-xl font-bold text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {say && <SpeakButton phrase={say} />}
        {action}
      </div>
    </div>
  );
}

export function Field({ label, hint, error, htmlFor, children, className = "" }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-danger">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-ink-soft">{hint}</p>
      )}
    </div>
  );
}

export function TextInput({ className = "", ...props }) {
  return <input className={`input ${className}`} {...props} />;
}

export function Select({ className = "", children, ...props }) {
  return (
    <div className="relative">
      <select className={`input appearance-none pr-10 ${className}`} {...props}>
        {children}
      </select>
      <ChevronDown
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
      />
    </div>
  );
}

export function Textarea({ className = "", ...props }) {
  return <textarea className={`input min-h-24 resize-y ${className}`} {...props} />;
}

export function ErrorBanner({ message, className = "" }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger ${className}`}
    >
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function Spinner({ size = 20, className = "" }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} aria-hidden="true" />;
}

export function PageLoading({ label = "Loading…" }) {
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 text-ink-soft">
      <Spinner size={28} className="text-primary" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className = "" }) {
  return (
    <div className={`flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-white/70 px-6 py-10 text-center ${className}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Icon size={24} />
      </div>
      <div>
        <p className="font-semibold text-ink">{title}</p>
        {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// A cloud with a tick: "sent online". Built from two basic icons so it works
// with any lucide version.
export function CloudSentIcon({ size = 16, className = "" }) {
  return (
    <span className={`relative inline-flex ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <Cloud size={size} strokeWidth={2.2} />
      <Check
        size={Math.round(size * 0.55)}
        strokeWidth={3.2}
        className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2"
      />
    </span>
  );
}

// Three pictures a farmer can learn once, instead of words like "sync":
//   phone          = saved on this phone (it will be sent when there is network)
//   cloud + tick   = sent online, safe even if the phone is lost
//   orange warning = needs help (the server refused the record)
export const SYNC_PICTURES = {
  pending: {
    label: WORDS.statusPending.text,
    longLabel: WORDS.statusPending.say,
    className: "bg-slate-100 text-slate-700",
    Icon: Smartphone
  },
  syncing: {
    label: WORDS.statusSyncing.text,
    longLabel: "Sending now…",
    className: "bg-sky-100 text-sky-700",
    Icon: Loader2,
    spin: true
  },
  synced: {
    label: WORDS.statusSynced.text,
    longLabel: WORDS.statusSynced.say,
    className: "bg-success/10 text-success",
    Icon: CloudSentIcon
  },
  failed: {
    label: WORDS.statusFailed.text,
    longLabel: WORDS.statusFailed.say,
    className: "bg-orange-100 text-orange-700",
    Icon: AlertTriangle
  }
};

const STATUS_WORDS = {
  pending: WORDS.statusPending,
  syncing: WORDS.statusSyncing,
  synced: WORDS.statusSynced,
  failed: WORDS.statusFailed
};

export function StatusChip({ status = "synced", className = "", showLabel = true }) {
  const style = SYNC_PICTURES[status] || SYNC_PICTURES.synced;
  const words = STATUS_WORDS[status] || STATUS_WORDS.synced;
  const { Icon } = style;
  return (
    <span
      data-say={words.say}
      data-say-key={words.key}
      title={style.longLabel}
      aria-label={style.longLabel}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${style.className} ${className}`}
    >
      <Icon size={15} className={style.spin ? "animate-spin" : ""} aria-hidden="true" />
      {showLabel && style.label}
    </span>
  );
}

// The same three pictures, explained once, for the sync screen and first use.
export function SyncPictureKey({ className = "" }) {
  return (
    <ul className={`space-y-2 ${className}`}>
      {["pending", "synced", "failed"].map((key) => {
        const { Icon, className: tone, longLabel, label } = SYNC_PICTURES[key];
        return (
          <li key={key} className="flex items-center gap-3" data-say={longLabel}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`}>
              <Icon size={20} />
            </span>
            <span className="text-sm text-ink">
              <strong className="font-bold">{label}:</strong> {longLabel}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function Modal({ open, title, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-md animate-fade-in rounded-2xl bg-white p-5 shadow-float">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-full p-1.5 text-ink-soft hover:bg-canvas"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-ink-soft">{message}</p>
    </Modal>
  );
}
