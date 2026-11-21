import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

const ToastContext = createContext(null);

const styles = {
  success: { Icon: CheckCircle2, className: "border-success/25 bg-white text-ink", icon: "text-success" },
  error: { Icon: AlertTriangle, className: "border-danger/25 bg-white text-ink", icon: "text-danger" },
  info: { Icon: Info, className: "border-primary/25 bg-white text-ink", icon: "text-primary" }
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message, type) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((current) => [...current.slice(-2), { id, message, type }]);
      window.setTimeout(() => remove(id), 4200);
    },
    [remove]
  );

  const value = useMemo(
    () => ({
      success: (message) => push(message, "success"),
      error: (message) => push(message, "error"),
      info: (message) => push(message, "info")
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => {
          const { Icon, className, icon } = styles[toast.type] || styles.info;
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-float animate-fade-in ${className}`}
            >
              <Icon size={18} className={`mt-0.5 shrink-0 ${icon}`} />
              <p className="flex-1 leading-snug">{toast.message}</p>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => remove(toast.id)}
                className="rounded-full p-1 text-ink-soft hover:bg-canvas"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
