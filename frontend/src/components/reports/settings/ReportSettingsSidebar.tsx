import { useId, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Pencil, Plus, RotateCcw, ShieldAlert, Trash2, Users } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { BLANK_LABEL, DATE_FORMAT_LABEL } from "@/lib/reportDisplay";
import type { ManualSignatory } from "@/lib/manualSignatories";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { PageSettingsPanel } from "@/components/reports/editor/PageSettingsPanel";
import type { BlankDisplay, DateFormat, DisplaySettings, PageSettings } from "@/types/reports";

// Iisang sidebar ng mga setting para sa lahat ng report: parehong ayos, label at kilos.
// Ang bawat report ay nagpapasa lang ng mga section at option na may saysay dito.

const FIELD = "flex flex-col gap-1.5";
const LABEL = "text-xs font-medium text-muted-foreground";
const SELECT =
  "block h-9 w-full rounded-md border bg-background px-3 text-base outline-none pointer-coarse:h-11 md:text-sm focus-visible:ring-2 focus-visible:ring-ring";

// ---- Layout ----------------------------------------------------------------------

/**
 * Desktop: sidebar sa kaliwa (naitatago), ang papel sa kanan.
 * Telepono: ang parehong panel bilang bottom sheet na binubuksan ng "Settings" sa toolbar.
 */
export function ReportSettingsLayout({ open, onOpenChange, sidebar, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sidebar: ReactNode;
  children: ReactNode;
}) {
  const touch = useIsMobile();
  if (touch) {
    return (
      <>
        {children}
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent side="bottom" className="max-h-[90dvh] gap-0 p-0">
            <SheetHeader className="border-b p-4">
              <SheetTitle>Report settings</SheetTitle>
              <SheetDescription>Saved with this report.</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">{sidebar}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  }
  return (
    <div className={cn("grid min-w-0 gap-3", open && "lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start")}>
      {open && (
        <aside
          aria-label="Report settings"
          className="min-w-0 rounded-xl border bg-card lg:sticky lg:top-32 lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto"
        >
          {sidebar}
        </aside>
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// ---- Section ----------------------------------------------------------------------

/** Isang section na naititiklop, may "Reset to defaults" sa ibaba */
export function SettingsSection({ title, count, onReset, defaultOpen = true, children }: {
  title: string;
  count?: number;
  onReset?: () => void;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="border-b last:border-b-0">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/50 pointer-coarse:min-h-12"
        >
          <span>
            {title}
            {count !== undefined && <span className="font-normal text-muted-foreground"> ({count})</span>}
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
      </h3>
      {open && (
        <div id={id} className="flex flex-col gap-4 px-4 pb-4">
          {children}
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline pointer-coarse:min-h-11"
            >
              <RotateCcw className="h-3 w-3" /> Reset to defaults
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// ---- Mga field -----------------------------------------------------------------------

export function TextField({ label, value, onChange, placeholder, maxLength = 200 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number;
}) {
  const id = useId();
  return (
    <div className={FIELD}>
      <label htmlFor={id} className={LABEL}>{label}</label>
      <Input id={id} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function TextAreaField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const id = useId();
  return (
    <div className={FIELD}>
      <label htmlFor={id} className={LABEL}>{label}</label>
      <Textarea id={id} rows={2} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export function SelectField({ label, value, options, onChange, hint }: {
  label: string; value: string; options: SelectOption[]; onChange: (v: string) => void; hint?: string;
}) {
  const id = useId();
  return (
    <div className={FIELD}>
      <label htmlFor={id} className={LABEL}>{label}</label>
      <select id={id} className={SELECT} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function CheckField({ label, checked, onChange, hint }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string;
}) {
  return (
    <label className="flex items-start gap-2 text-sm pointer-coarse:min-h-11">
      <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 pointer-coarse:h-5 pointer-coarse:w-5" checked={checked}
        onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

/** Mga halagang hindi nababago dito (hal. semester at course) */
export function FixedInfo({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      {items.map((i) => (
        <div key={i.label} className="contents">
          <dt className="text-muted-foreground">{i.label}</dt>
          <dd className="min-w-0 break-words">{i.value || "None"}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---- Columns ---------------------------------------------------------------------

export interface ColumnGroup {
  legend?: string;
  columns: { key: string; label: string }[];
  /** Mga napiling column sa ayos ng papel */
  selected: string[];
  /** Hindi maaalis */
  required?: string[];
  /** Laging una at hindi nalilipat (hal. Company sa HTE) */
  pinned?: string[];
  /** Personal na datos (Data Privacy Act) */
  personal?: string[];
  onChange: (selected: string[]) => void;
}

function ColumnGroupControl({ g }: { g: ColumnGroup }) {
  const byKey = new Map(g.columns.map((c) => [c.key, c]));
  const selected = g.selected.filter((k) => byKey.has(k));
  const hidden = g.columns.filter((c) => !selected.includes(c.key));
  const required = g.required ?? [];
  const pinned = g.pinned ?? [];
  const personal = g.personal ?? [];
  const movable = selected.filter((k) => !pinned.includes(k));

  const move = (key: string, dir: -1 | 1) => {
    const i = movable.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= movable.length) return;
    const next = [...movable];
    [next[i], next[j]] = [next[j], next[i]];
    g.onChange([...selected.filter((k) => pinned.includes(k)), ...next]);
  };
  const tag = (key: string) => personal.includes(key) && (
    <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1 text-[10px] font-medium uppercase text-amber-800 dark:text-amber-300">
      Personal
    </span>
  );

  return (
    <fieldset className="min-w-0">
      {g.legend && <legend className={LABEL}>{g.legend}</legend>}
      <ul className="mt-1 flex flex-col">
        {selected.map((key) => {
          const col = byKey.get(key)!;
          const at = movable.indexOf(key);
          return (
            <li key={key} className="flex items-center gap-1 py-0.5">
              <label className="flex min-w-0 flex-1 items-center gap-2 text-sm pointer-coarse:min-h-11">
                <input type="checkbox" className="h-4 w-4 pointer-coarse:h-5 pointer-coarse:w-5" checked
                  disabled={required.includes(key) || selected.length === 1}
                  onChange={() => g.onChange(selected.filter((k) => k !== key))} />
                <span className="min-w-0 truncate">{col.label}</span>
                {tag(key)}
              </label>
              {at >= 0 && (
                <>
                  <Button type="button" variant="ghost" size="icon-sm" className="pointer-coarse:size-11" aria-label={`Move ${col.label} up`}
                    disabled={at === 0} onClick={() => move(key, -1)}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" className="pointer-coarse:size-11" aria-label={`Move ${col.label} down`}
                    disabled={at === movable.length - 1} onClick={() => move(key, 1)}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </li>
          );
        })}
        {hidden.map((col) => (
          <li key={col.key} className="py-0.5">
            <label className="flex items-center gap-2 text-sm text-muted-foreground pointer-coarse:min-h-11">
              <input type="checkbox" className="h-4 w-4 pointer-coarse:h-5 pointer-coarse:w-5" checked={false}
                onChange={() => g.onChange(pinned.includes(col.key) ? [col.key, ...selected] : [...selected, col.key])} />
              <span className="min-w-0 truncate">{col.label}</span>
              {tag(col.key)}
            </label>
          </li>
        ))}
      </ul>
      {g.columns.some((c) => personal.includes(c.key)) && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>Columns marked Personal are personal data under the Data Privacy Act (RA 10173). Include them only when this report needs them.</span>
        </p>
      )}
    </fieldset>
  );
}

export function ColumnsControl({ groups }: { groups: ColumnGroup[] }) {
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g, i) => <ColumnGroupControl key={g.legend ?? i} g={g} />)}
      <p className="text-xs text-muted-foreground">Checked columns print in this order. Use the arrows to reorder.</p>
    </div>
  );
}

// ---- Page ------------------------------------------------------------------------

export function PageControl({ settings, onChange }: { settings: PageSettings; onChange: (s: PageSettings) => void }) {
  return <PageSettingsPanel settings={settings} onChange={onChange} allowOrientation compact />;
}

// ---- Signatories -------------------------------------------------------------------

const ALIGN_LABEL = { left: "Left", center: "Center", right: "Right" } as const;

export function SignatoriesControl({ items, onAdd, onEdit, onDelete, onManage, builtIn }: {
  items: ManualSignatory[];
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onManage: () => void;
  /** Annual at HTE: "Also show the built-in section" */
  builtIn?: { checked: boolean; onChange: (v: boolean) => void };
}) {
  return (
    <div className="flex flex-col gap-3">
      {builtIn && (
        <CheckField
          label="Also show the built-in section"
          checked={builtIn.checked}
          onChange={builtIn.onChange}
          hint="When off, your signatories replace Prepared by / Noted / Certified True and Correct."
        />
      )}
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No signatories yet.{builtIn ? " The built-in section is shown." : " Nothing prints at the bottom."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((s) => (
            <li key={s.id} className="flex items-start gap-2 rounded-lg border p-2 text-sm">
              <div className="min-w-0 flex-1">
                {s.label.trim() && <p className="text-xs text-muted-foreground">{s.label}</p>}
                <p className="truncate font-medium uppercase">{s.name || "(no name)"}</p>
                <p className="truncate text-xs text-muted-foreground">{[s.position, ALIGN_LABEL[s.align]].filter(Boolean).join(" · ")}</p>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" className="pointer-coarse:size-11" aria-label={`Edit ${s.name || "signatory"}`}
                onClick={() => onEdit(s.id)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" className="text-destructive pointer-coarse:size-11"
                aria-label={`Delete ${s.name || "signatory"}`} onClick={() => onDelete(s.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" className="pointer-coarse:h-11" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" /> Add signatory
        </Button>
        <Button type="button" variant="outline" size="sm" className="pointer-coarse:h-11" onClick={onManage}>
          <Users className="h-3.5 w-3.5" /> Manage signatories
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Saved on this device only.</p>
    </div>
  );
}

// ---- Advanced ------------------------------------------------------------------------

export function AdvancedControl({ display, onChange, show }: {
  display: DisplaySettings;
  onChange: (d: DisplaySettings) => void;
  /** Mga option na may saysay sa report na ito */
  show: { rowNumbers?: boolean; striped?: boolean; dateFormat?: boolean; blank?: boolean };
}) {
  return (
    <div className="flex flex-col gap-3">
      {show.rowNumbers && (
        <CheckField label="Row numbering" checked={display.rowNumbers} onChange={(v) => onChange({ ...display, rowNumbers: v })} />
      )}
      {show.striped && (
        <CheckField label="Row striping" checked={display.striped} onChange={(v) => onChange({ ...display, striped: v })}
          hint="Shades every other row, also when printed." />
      )}
      {show.dateFormat && (
        <SelectField
          label="Date format"
          value={display.dateFormat}
          options={(Object.keys(DATE_FORMAT_LABEL) as DateFormat[]).map((k) => ({ value: k, label: DATE_FORMAT_LABEL[k] }))}
          onChange={(v) => onChange({ ...display, dateFormat: v as DateFormat })}
        />
      )}
      {show.blank && (
        <SelectField
          label="Blank cells"
          value={display.blank}
          options={(Object.keys(BLANK_LABEL) as BlankDisplay[]).map((k) => ({ value: k, label: BLANK_LABEL[k] }))}
          onChange={(v) => onChange({ ...display, blank: v as BlankDisplay })}
        />
      )}
    </div>
  );
}
