import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import api from "@/lib/api";
import { SKILL_MAX_LENGTH, skillDisplay, skillKey } from "@/lib/skills";
import { cn } from "@/lib/utils";

interface SkillsInputProps {
  id?: string;
  value: string[];
  onChange: (next: string[]) => void;
  /**
   * Endpoint ng mungkahi (hal. "/student/skills/search" o "/coordinator/skills/search").
   * Blangko = walang mungkahi (hal. sa public na form ng company, na walang login).
   */
  searchUrl: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Ilang chip ang ipinapakita bago ang "+N more" */
  collapseAfter?: number;
  "aria-describedby"?: string;
}

/**
 * Tag input ng skills: Enter o kuwit para magdagdag, ✕ para mag-alis, Backspace sa blangkong input para alisin ang huli.
 * May mungkahi mula sa catalog habang nagta-type (para iisa ang pangalan ng parehong skill) at "Create 'xyz'".
 */
export function SkillsInput({
  id, value, onChange, searchUrl, placeholder = "Type a skill and press Enter", disabled, invalid,
  collapseAfter = 8, "aria-describedby": describedBy,
}: SkillsInputProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");

  const have = new Set(value.map(skillKey));
  const typed = skillDisplay(text);
  const typedKey = skillKey(typed);

  // Mungkahi mula sa catalog (saglit na paghihintay habang nagta-type)
  useEffect(() => {
    if (!typedKey || !searchUrl) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      api.get<string[]>(searchUrl, { params: { q: typed } })
        .then((res) => { if (!cancelled) setSuggestions(res.data); })
        .catch(() => { if (!cancelled) setSuggestions([]); });
    }, 200);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [typed, typedKey, searchUrl]);

  const fresh = typedKey ? suggestions.filter((s) => !have.has(skillKey(s))) : [];
  const exact = fresh.some((s) => skillKey(s) === typedKey) || have.has(typedKey);
  const options = [...fresh.slice(0, 8), ...(typedKey && !exact ? [`__create__${typed}`] : [])];

  function add(raw: string) {
    const name = skillDisplay(raw);
    const key = skillKey(name);
    if (!key) return;
    if (name.length > SKILL_MAX_LENGTH) {
      setError(`Keep each skill to ${SKILL_MAX_LENGTH} characters.`);
      return;
    }
    setError("");
    if (!have.has(key)) onChange([...value, name]);
    setText("");
    setSuggestions([]);
    setActive(0);
    inputRef.current?.focus();
  }

  const remove = (i: number) => onChange(value.filter((_, k) => k !== i));

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const pick = open && options[active];
      if (pick) add(pick.startsWith("__create__") ? pick.slice(10) : pick);
      else add(text);
      return;
    }
    if (e.key === "Backspace" && !text && value.length > 0) {
      e.preventDefault();
      remove(value.length - 1);
      return;
    }
    if (e.key === "ArrowDown" && options.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % options.length);
    }
    if (e.key === "ArrowUp" && options.length > 0) {
      e.preventDefault();
      setActive((i) => (i - 1 + options.length) % options.length);
    }
    if (e.key === "Escape") setOpen(false);
  }

  const shown = expanded ? value : value.slice(0, collapseAfter);
  const hidden = value.length - shown.length;

  return (
    <div className="relative">
      <div
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring",
          invalid && "border-destructive",
          disabled && "opacity-50",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {shown.map((s, i) => (
          <span key={`${s}-${i}`} className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-sm">
            <span className="truncate">{s}</span>
            {!disabled && (
              <button
                type="button"
                aria-label={`Remove ${s}`}
                className="-mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground pointer-coarse:h-7 pointer-coarse:w-7"
                onClick={(e) => { e.stopPropagation(); remove(i); }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {hidden > 0 && (
          <button type="button" className="rounded-full px-2 py-0.5 text-sm text-primary hover:underline pointer-coarse:min-h-8"
            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}>
            +{hidden} more
          </button>
        )}
        {expanded && value.length > collapseAfter && (
          <button type="button" className="rounded-full px-2 py-0.5 text-sm text-muted-foreground hover:underline"
            onClick={(e) => { e.stopPropagation(); setExpanded(false); }}>
            Show less
          </button>
        )}
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open && options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          value={text}
          maxLength={SKILL_MAX_LENGTH + 10}
          placeholder={value.length === 0 ? placeholder : "Add another"}
          className="min-w-32 flex-1 bg-transparent py-1 text-base outline-none placeholder:text-muted-foreground md:text-sm pointer-coarse:py-2"
          onChange={(e) => {
            const v = e.target.value;
            // Kuwit habang nagta-type o nagpe-paste: idagdag ang bawat bahagi
            if (v.includes(",")) {
              const parts = v.split(",");
              const last = parts.pop() ?? "";
              let next = [...value];
              for (const p of parts) {
                const name = skillDisplay(p);
                if (skillKey(name) && name.length <= SKILL_MAX_LENGTH && !next.some((x) => skillKey(x) === skillKey(name))) next = [...next, name];
              }
              if (next.length !== value.length) onChange(next);
              setText(last);
            } else {
              setText(v);
            }
            if (!v.trim()) setSuggestions([]);
            setOpen(true);
            setActive(0);
            setError("");
          }}
          onKeyDown={onKey}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        />
      </div>

      {open && options.length > 0 && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover p-1 text-sm shadow-md">
          {options.map((o, i) => {
            const create = o.startsWith("__create__");
            const label = create ? o.slice(10) : o;
            return (
              <li
                key={o}
                role="option"
                aria-selected={i === active}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 pointer-coarse:py-2.5",
                  i === active ? "bg-accent text-accent-foreground" : "",
                )}
                onMouseDown={(e) => { e.preventDefault(); add(label); }}
                onMouseEnter={() => setActive(i)}
              >
                {create ? <><Plus className="h-3.5 w-3.5" /> Create "{label}"</> : label}
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
