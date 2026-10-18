import { useEffect, useRef, useState } from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ColumnOption {
  key: string;
  label: string;
}

const PREFIX = "ojt-hidden-columns:";

function read(storageKey: string, fallback: string[]): Set<string> {
  try {
    const raw = window.localStorage.getItem(PREFIX + storageKey);
    if (raw === null) return new Set(fallback);
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : fallback);
  } catch {
    return new Set(fallback);
  }
}

function write(storageKey: string, hidden: Set<string>) {
  try {
    window.localStorage.setItem(PREFIX + storageKey, JSON.stringify([...hidden]));
  } catch {
    // walang storage: gumagana pa rin hanggang i-refresh ang page
  }
}

/** Mga column na itinago ng user. Naaalala ito kada storageKey (hal. kada tab). */
export function useHiddenColumns(storageKey: string, defaultHidden: string[] = []) {
  const [state, setState] = useState(() => ({
    key: storageKey,
    hidden: read(storageKey, defaultHidden),
  }));

  let current = state;
  if (state.key !== storageKey) {
    current = { key: storageKey, hidden: read(storageKey, defaultHidden) };
    setState(current);
  }

  function commit(next: Set<string>) {
    write(storageKey, next);
    setState({ key: storageKey, hidden: next });
  }

  return {
    hidden: current.hidden,
    isHidden: (key: string) => current.hidden.has(key),
    toggle: (key: string) => {
      const next = new Set(current.hidden);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      commit(next);
    },
    setHidden: (keys: string[]) => commit(new Set(keys)),
    showAll: () => commit(new Set()),
  };
}

interface Props {
  options: ColumnOption[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

/** Menu para itago o ipakita ang mga column ng table */
export function ColumnsMenu({ options, hidden, onToggle, onShowAll, onHideAll }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const hiddenCount = options.filter((o) => hidden.has(o.key)).length;

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        variant={hiddenCount > 0 ? "default" : "outline"}
        size="sm"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Columns
        {hiddenCount > 0 && <span className="text-xs opacity-80">({hiddenCount} hidden)</span>}
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1 w-64 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-xs font-medium text-muted-foreground">Show columns</span>
            <span className="flex gap-1">
              <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onShowAll}>
                Show all
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onHideAll}>
                Hide all
              </Button>
            </span>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {options.map((option) => {
              const visible = !hidden.has(option.key);
              return (
                <button
                  key={option.key}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={visible}
                  onClick={() => onToggle(option.key)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      visible ? "border-primary bg-primary text-primary-foreground" : "border-input",
                    )}
                  >
                    {visible && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
