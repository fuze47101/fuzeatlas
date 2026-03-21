"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

// ─── Types ───

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// ─── Icons ───

const icons: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
  warning: "⚠",
};

const colors: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: "bg-emerald-50", border: "border-emerald-400", text: "text-emerald-800", icon: "text-emerald-500" },
  error: { bg: "bg-red-50", border: "border-red-400", text: "text-red-800", icon: "text-red-500" },
  info: { bg: "bg-blue-50", border: "border-blue-400", text: "text-blue-800", icon: "text-blue-500" },
  warning: { bg: "bg-amber-50", border: "border-amber-400", text: "text-amber-800", icon: "text-amber-500" },
};

// ─── Toast Item ───

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, toast.duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [toast.id, toast.duration, onDismiss]);

  const c = colors[toast.type];

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg transition-all duration-300 ${c.bg} ${c.border} ${
        exiting ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"
      }`}
      role="alert"
    >
      <span className={`text-lg font-bold ${c.icon} flex-shrink-0`}>{icons[toast.type]}</span>
      <span className={`text-sm font-medium ${c.text} flex-1`}>{toast.message}</span>
      <button
        onClick={() => {
          setExiting(true);
          setTimeout(() => onDismiss(toast.id), 300);
        }}
        className={`${c.text} opacity-50 hover:opacity-100 text-lg leading-none flex-shrink-0`}
      >
        &times;
      </button>
    </div>
  );
}

// ─── Provider ───

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = "info", duration = 4000) => {
    const id = `toast-${++nextId}-${Date.now()}`;
    setToasts((prev) => [...prev.slice(-4), { id, message, type, duration }]); // max 5 visible
  }, []);

  const value: ToastContextValue = {
    toast: addToast,
    success: useCallback((msg: string, dur?: number) => addToast(msg, "success", dur), [addToast]),
    error: useCallback((msg: string, dur?: number) => addToast(msg, "error", dur ?? 6000), [addToast]),
    info: useCallback((msg: string, dur?: number) => addToast(msg, "info", dur), [addToast]),
    warning: useCallback((msg: string, dur?: number) => addToast(msg, "warning", dur ?? 5000), [addToast]),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container — fixed top-right */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-80 pointer-events-auto">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
