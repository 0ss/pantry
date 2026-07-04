"use client";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import { cn } from "@/lib/utils";

interface Toast {
  id: number;
  message: string;
  tone: "success" | "error";
}

const ToastContext = createContext<{ push: (message: string, tone?: Toast["tone"]) => void }>({
  push: () => {},
});

/** App-wide toast provider; render once near the root. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn("rounded-md px-4 py-2 text-sm text-white shadow-lg", t.tone === "success" ? "bg-emerald-600" : "bg-red-600")}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Access the toast pusher: `const { push } = useToast()`. */
export function useToast() {
  return useContext(ToastContext);
}
