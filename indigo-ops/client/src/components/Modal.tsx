import React, { useEffect } from "react";

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center bg-black/70 pt-16" onMouseDown={onClose}>
      <div
        className={`panel ${wide ? "w-[880px]" : "w-[480px]"} max-h-[80vh] overflow-y-auto shadow-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="panel-header sticky top-0 bg-ops-panel">
          <span>{title}</span>
          <button onClick={onClose} className="text-ops-dim hover:text-ops-text">
            [ESC] CLOSE
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
