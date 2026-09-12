import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

interface CommandResult {
  lines: string[];
  navigate?: string | null;
  clear?: boolean;
}

export function CommandConsole({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate: (target: string) => void;
}) {
  const [history, setHistory] = useState<{ cmd: string; lines: string[] }[]>([
    { cmd: "", lines: ["INDIGO OPS COMMAND TERMINAL — type HELP for a list of commands."] },
  ]);
  const [input, setInput] = useState("");
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [history]);

  async function submit() {
    const cmd = input.trim();
    if (!cmd) return;
    setCmdHistory((h) => [...h, cmd]);
    setHistIdx(-1);
    setInput("");
    try {
      const result = await api.post<CommandResult>("/command", { command: cmd });
      if (result.clear) {
        setHistory([]);
        return;
      }
      setHistory((h) => [...h, { cmd, lines: result.lines }]);
      if (result.navigate) {
        onNavigate(result.navigate);
      }
    } catch (e) {
      setHistory((h) => [...h, { cmd, lines: [`ERROR: ${(e as Error).message}`] }]);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") submit();
    else if (e.key === "Escape") onClose();
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cmdHistory.length === 0) return;
      const idx = histIdx === -1 ? cmdHistory.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(idx);
      setInput(cmdHistory[idx]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx === -1) return;
      const idx = histIdx + 1;
      if (idx >= cmdHistory.length) {
        setHistIdx(-1);
        setInput("");
      } else {
        setHistIdx(idx);
        setInput(cmdHistory[idx]);
      }
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/80 pt-20" onMouseDown={onClose}>
      <div
        className="panel w-[720px] max-h-[70vh] flex flex-col shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="panel-header">
          <span>OPERATIONS COMMAND TERMINAL</span>
          <span className="text-ops-dim">[ESC] CLOSE</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 text-[12px] space-y-2">
          {history.map((h, i) => (
            <div key={i}>
              {h.cmd && (
                <div className="text-ops-indigoBright">
                  OPS&gt; <span className="text-ops-text">{h.cmd}</span>
                </div>
              )}
              {h.lines.map((l, j) => (
                <div key={j} className={l.startsWith("ERROR") ? "text-ops-red" : "text-ops-dim"}>
                  {l || " "}
                </div>
              ))}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-ops-border flex items-center px-3 py-2">
          <span className="text-ops-indigoBright mr-2">OPS&gt;</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            className="flex-1 bg-transparent outline-none text-ops-text placeholder:text-ops-dim"
            placeholder="type a command, e.g. PNR SEARCH A7K9PQ"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
