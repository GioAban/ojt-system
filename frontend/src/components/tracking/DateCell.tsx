import { useRef, useState } from "react";
import { CalendarDays, CalendarPlus, Lock } from "lucide-react";
import { formatLongDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/** Ang <input type="date"> ay yyyy-MM-dd lang ang tinatanggap */
export function toInputValue(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
}

interface DateCellProps {
  value: string | null;
  label: string;
  pending: boolean;
  disabled?: boolean;
  disabledReason?: string;
  max?: string;
  onSave: (date: string | null) => Promise<void>;
}

/** I-click para pumili o mag-type ng date; Enter o i-click sa labas = save, Esc = cancel */
export function DateCell({
  value,
  label,
  pending,
  disabled = false,
  disabledReason,
  max,
  onSave,
}: DateCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const skipCommit = useRef(false);

  function startEditing() {
    skipCommit.current = false;
    setDraft(toInputValue(value));
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    if (skipCommit.current) {
      skipCommit.current = false;
      return;
    }
    if (draft !== toInputValue(value)) void onSave(draft === "" ? null : draft);
  }

  if (disabled) {
    return (
      <span
        title={disabledReason}
        className="flex h-7 w-full cursor-not-allowed items-center gap-1.5 px-1 text-[11px] text-muted-foreground/50"
      >
        <Lock className="h-3 w-3 shrink-0" />
        <span className="truncate">
          {value ? formatLongDate(value) : "Locked"}
        </span>
      </span>
    );
  }

  if (editing) {
    return (
      <Input
        autoFocus
        type="date"
        max={max}
        aria-label={label}
        className="h-7 px-1 text-xs"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            skipCommit.current = true;
            e.currentTarget.blur();
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      title={`${label} — click to ${value ? "edit" : "set"}`}
      onFocus={startEditing}
      onClick={startEditing}
      className={cn(
        "flex h-7 w-full items-center gap-1.5 rounded-md border px-2 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        value
          ? "border-input bg-background hover:bg-muted"
          : "border-dashed border-primary/40 bg-primary/5 font-medium text-primary hover:bg-primary/10",
        pending && "opacity-40",
      )}
    >
      {value ? (
        <>
          <CalendarDays className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="truncate">{formatLongDate(value)}</span>
        </>
      ) : (
        <>
          <CalendarPlus className="h-3 w-3 shrink-0" />
          <span>Set date</span>
        </>
      )}
    </button>
  );
}
