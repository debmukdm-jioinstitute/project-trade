import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { suggestCommands, matchedKeyword, type CommandSpec } from "../lib/commands";
import { renderTerminalLine } from "../lib/terminalFormat";

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
    { cmd: "", lines: ["INDIGO OPS COMMAND TERMINAL — type HELP for a list of commands, or start typing for suggestions."] },
  ]);
  const [input, setInput] = useState("");
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeSuggest, setActiveSuggest] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => suggestCommands(input), [input]);
  const keyword = useMemo(() => matchedKeyword(input), [input]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [history]);
  useEffect(() => {
    setSuggestOpen(suggestions.length > 0);
    setActiveSuggest(0);
  }, [suggestions]);

  async function submit(overrideCmd?: string) {
    const cmd = (overrideCmd ?? input).trim();
    if (!cmd) return;
    setCmdHistory((h) => [...h, cmd]);
    setHistIdx(-1);
    setInput("");
    setSuggestOpen(false);
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

  function acceptSuggestion(s: CommandSpec) {
    if (!s.args) {
      submit(s.cmd);
    } else {
      setInput(s.cmd + " ");
      setSuggestOpen(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (suggestOpen && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveSuggest((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSuggest((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        acceptSuggestion(suggestions[activeSuggest]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSuggestOpen(false);
        return;
      }
    }

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

  const unrecognized = input.trim().length > 0 && !keyword && suggestions.length === 0;

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
              {h.lines.map((l, j) => renderTerminalLine(l, j))}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="relative border-t border-ops-border">
          {suggestOpen && suggestions.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 panel border-b-0 max-h-56 overflow-y-auto shadow-2xl">
              {suggestions.map((s, i) => (
                <button
                  key={s.cmd + s.args}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    acceptSuggestion(s);
                  }}
                  onMouseEnter={() => setActiveSuggest(i)}
                  className={`w-full text-left px-3 py-1.5 flex items-center justify-between text-[12px] ${
                    i === activeSuggest ? "bg-ops-panel2" : ""
                  }`}
                >
                  <span>
                    <span className="text-ops-indigoBright font-semibold">{s.cmd}</span>
                    {s.args && <span className="text-ops-dim"> {s.args}</span>}
                  </span>
                  <span className="text-ops-dim">{s.desc}</span>
                </button>
              ))}
              <div className="px-3 py-1 text-[10px] text-ops-dim border-t border-ops-border">
                [↑↓] NAVIGATE &nbsp; [TAB] COMPLETE &nbsp; [ENTER] RUN
              </div>
            </div>
          )}

          <div className="flex items-center px-3 py-2">
            <span className="text-ops-indigoBright mr-2">OPS&gt;</span>
            <div className="relative flex-1">
              <div aria-hidden className="absolute inset-0 whitespace-pre overflow-hidden pointer-events-none">
                {keyword ? (
                  <>
                    <span className="text-ops-indigoBright font-semibold">{input.slice(0, keyword.length)}</span>
                    <span className="text-ops-text">{input.slice(keyword.length)}</span>
                  </>
                ) : (
                  <span className={unrecognized ? "text-ops-red" : "text-ops-indigoBright"}>{input}</span>
                )}
              </div>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                className="relative w-full bg-transparent outline-none text-transparent caret-ops-text placeholder:text-ops-dim"
                placeholder="type a command, e.g. PNR SEARCH A7K9PQ — or just start typing for suggestions"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
