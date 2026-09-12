import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

interface ToastItem {
  id: number;
  kind: "info" | "error" | "success";
  title: string;
  message?: string;
}

interface ToastCtx {
  push: (t: Omit<ToastItem, "id">) => void;
}

const Ctx = createContext<ToastCtx>({ push: () => {} });
export const useToast = () => useContext(Ctx);

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = ++counter;
    setItems((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 5000);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 w-96">
        {items.map((t) => (
          <div
            key={t.id}
            className={`panel border-l-2 px-3 py-2 text-[12px] shadow-lg ${
              t.kind === "error" ? "border-l-ops-red" : t.kind === "success" ? "border-l-ops-green" : "border-l-ops-indigo"
            }`}
          >
            <div className="uppercase tracking-wide text-[11px] font-semibold">
              {t.kind === "error" ? `ERROR — ${t.title}` : t.title}
            </div>
            {t.message && <div className="text-ops-dim mt-0.5">{t.message}</div>}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
