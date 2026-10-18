import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface EditableCellProps {
  value: string | null;
  label: string;
  kind?: "text" | "tel" | "date" | "multiline";
  placeholder?: string;
  maxLength?: number;
  validate?: (value: string) => string | null;
  display?: (value: string) => ReactNode;
  onSave: (value: string) => Promise<void>;
}

/**
 * Cell na pwedeng i-edit nang direkta: i-click, i-type, Enter o i-click ang labas para i-save, Esc para i-cancel.
 */
export function EditableCell({
  value,
  label,
  kind = "text",
  placeholder,
  maxLength,
  validate,
  display,
  onSave,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const closed = useRef(true);
  const busy = useRef(false);

  const current = value ?? "";

  function start() {
    closed.current = false;
    setDraft(current);
    setError("");
    setEditing(true);
  }

  function close() {
    closed.current = true;
    setEditing(false);
    setError("");
  }

  async function commit(fromBlur = false) {
    if (closed.current || busy.current) return;

    const next = draft.trim();
    if (next === current.trim()) {
      close();
      return;
    }

    const problem = validate?.(next) ?? null;
    if (problem) {
      if (fromBlur) {
        notify.error(`${label}: ${problem}`);
        close();
      } else {
        setError(problem);
      }
      return;
    }

    busy.current = true;
    setSaving(true);
    setError("");

    try {
      await onSave(next);
      close();
    } catch (err) {
      const message = getErrorMessage(err, "Couldn't save the change.");
      if (fromBlur) {
        notify.error(`${label}: ${message}`);
        close();
      } else {
        setError(message);
      }
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  function handleKeyDown(
    e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Enter" && !(kind === "multiline" && e.shiftKey)) {
      e.preventDefault();
      void commit();
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={start}
        aria-label={`Edit ${label}`}
        title="Click to edit"
        className="group flex w-full items-start gap-1 rounded-md px-2 py-1 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0 flex-1 break-words">
          {current ? (
            display ? (
              display(current)
            ) : (
              current
            )
          ) : (
            <span className="text-muted-foreground">{placeholder ?? "—"}</span>
          )}
        </span>
        <Pencil className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {kind === "multiline" ? (
        <Textarea
          rows={3}
          value={draft}
          maxLength={maxLength}
          autoFocus
          readOnly={saving}
          aria-label={label}
          aria-invalid={Boolean(error)}
          onKeyDown={handleKeyDown}
          onBlur={() => void commit(true)}
          onChange={(e) => {
            setDraft(e.target.value);
            setError("");
          }}
        />
      ) : (
        <Input
          type={kind === "date" ? "date" : kind === "tel" ? "tel" : "text"}
          value={draft}
          maxLength={maxLength}
          autoFocus
          readOnly={saving}
          aria-label={label}
          aria-invalid={Boolean(error)}
          onKeyDown={handleKeyDown}
          onBlur={() => void commit(true)}
          onChange={(e) => {
            setDraft(e.target.value);
            setError("");
          }}
        />
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
      {saving && <p className="text-xs text-muted-foreground">Saving...</p>}
    </div>
  );
}
