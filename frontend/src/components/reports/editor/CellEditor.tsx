import { useState } from "react";
import { FileText, RotateCcw, Users } from "lucide-react";
import { formatLongDate } from "@/lib/hteReport";
import {
  companyOfDepartment, companyOptions, defaultDepartment, departmentOptions, isPending, toIsoDate, validateOverride, valueOf,
  type CellSpec, type FieldOption, type FieldSpec, type NameSpec, type OverrideSpec, type PeriodSpec,
} from "@/lib/reportFields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/combobox";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { PendingMap, ReportSource } from "@/types/reports";

interface CellEditorProps {
  spec: CellSpec | null;
  pending: PendingMap;
  source: ReportSource;
  problems: Record<string, string>;
  /** Pagbabago sa tunay na record (naghihintay); null = ibalik sa nasa system */
  onSaveField: (spec: FieldSpec, value: string | null) => void;
  /** Edit sa report lang; null = Reset to system value */
  onSaveOverride: (spec: OverrideSpec, value: string | null) => void;
  onClose: () => void;
}

/**
 * Ang input ng isang cell sa Edit mode: dropdown, kalendaryo, numero o teksto, na may parehong tuntunin ng
 * normal na form. Ang nakakabit sa record ay naghihintay hanggang patayin ang Edit mode; ang iba ay sa report lang.
 */
export function CellEditor(props: CellEditorProps) {
  const { spec } = props;
  return (
    <Dialog open={spec !== null} onOpenChange={(open) => { if (!open) props.onClose(); }}>
      {spec?.type === "field" && <FieldBody key={spec.key} {...props} spec={spec} />}
      {spec?.type === "override" && <OverrideBody key={spec.key} {...props} spec={spec} />}
      {spec?.type === "period" && <PeriodBody key={spec.key} {...props} spec={spec} />}
      {spec?.type === "name" && <NameBody key={spec.key} {...props} spec={spec} />}
    </Dialog>
  );
}

// ---- Mga input ------------------------------------------------------------------

function SelectInput({ id, value, options, invalid, onChange }: {
  id: string; value: string; options: FieldOption[]; invalid: boolean; onChange: (v: string) => void;
}) {
  return (
    <NativeSelect id={id} className="w-full" aria-invalid={invalid} value={value} onChange={(e) => onChange(e.target.value)}>
      {!options.some((o) => o.value === value) && <NativeSelectOption value={value}>{value || "Choose"}</NativeSelectOption>}
      {options.map((o) => (
        <NativeSelectOption key={o.value} value={o.value} disabled={o.disabled}>
          {o.hint ? `${o.label} (${o.hint})` : o.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

function DateInput({ id, value, invalid, onChange, clearable = true, max }: {
  id: string; value: string; invalid: boolean; onChange: (v: string) => void; clearable?: boolean; max?: string;
}) {
  return (
    <div className="flex gap-2">
      <Input
        id={id}
        type="date"
        min="2000-01-01"
        max={max ?? "2100-12-31"}
        className="min-w-0 flex-1"
        aria-invalid={invalid}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {clearable && (
        <Button type="button" variant="outline" className="pointer-coarse:h-11" onClick={() => onChange("")} disabled={!value}>
          Clear
        </Button>
      )}
    </div>
  );
}

const SAVED_NOTE = "Nothing is written to the database until you choose Save changes to database and confirm.";

function Affects({ spec }: { spec: FieldSpec }) {
  if (spec.target === "student" || spec.affects === undefined) return null;
  return (
    <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Users className="h-3.5 w-3.5 shrink-0" />
      Affects {spec.affects} {spec.affects === 1 ? "student" : "students"}.
    </p>
  );
}

// ---- Record -----------------------------------------------------------------------

function FieldBody({ spec, pending, source, problems, onSaveField, onClose }: CellEditorProps & { spec: FieldSpec }) {
  const [value, setValue] = useState(() => valueOf(spec, pending));
  const [company, setCompany] = useState<number | null>(() => companyOfDepartment(source, valueOf(spec, pending)));
  const [tried, setTried] = useState(false);

  // Company na walang napiling department: sabihin nang malinaw kung ano ang kulang
  const error = spec.kind === "assignment" && company !== null && !value ? "Choose a department." : spec.validate(value, pending);
  const showError = (tried || value !== valueOf(spec, pending)) && error;
  const changed = isPending(spec, pending);
  const id = `cell-${spec.key.replace(/[^\w-]/g, "-")}`;
  const problem = problems[spec.key];

  function done() {
    setTried(true);
    if (error) return;
    onSaveField(spec, value);
    onClose();
  }

  const input = (() => {
    switch (spec.kind) {
      case "assignment": {
        const companies = companyOptions(source, spec.live);
        const departments = company === null ? [] : departmentOptions(source, company, spec.live);
        return (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-company`}>Company</Label>
              <SearchableSelect
                id={`${id}-company`}
                options={companies}
                value={company === null ? null : String(company)}
                placeholder="Search your companies"
                emptyText="No company matches."
                invalid={Boolean(showError) && company === null}
                onChange={(v) => {
                  const next = v === null ? null : Number(v);
                  setCompany(next);
                  setValue(next === null ? "" : (defaultDepartment(source, next) ?? ""));
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-department`}>
                Department <span className="font-normal text-muted-foreground">(N/A when the company has none)</span>
              </Label>
              <SearchableSelect
                id={`${id}-department`}
                options={departments}
                value={value || null}
                placeholder={company === null ? "Choose a company first" : "Search departments"}
                emptyText="This company has no department you can use."
                disabled={company === null}
                invalid={Boolean(showError) && company !== null}
                onChange={(v) => setValue(v ?? "")}
              />
            </div>
          </div>
        );
      }
      case "select":
        return (
          <div className="flex flex-col gap-2">
            <Label htmlFor={id}>{spec.label}</Label>
            <SelectInput id={id} value={value} options={spec.options ?? []} invalid={Boolean(showError)} onChange={setValue} />
          </div>
        );
      case "date":
        return (
          <div className="flex flex-col gap-2">
            <Label htmlFor={id}>{spec.label}</Label>
            <DateInput id={id} value={value} invalid={Boolean(showError)} onChange={setValue} />
          </div>
        );
      default:
        return (
          <div className="flex flex-col gap-2">
            <Label htmlFor={id}>{spec.label}</Label>
            <Input
              id={id}
              type={spec.inputType ?? "text"}
              inputMode={spec.inputType === "tel" ? "tel" : spec.inputType === "email" ? "email" : undefined}
              maxLength={spec.maxLength ?? 255}
              aria-invalid={Boolean(showError)}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); done(); } }}
              autoFocus
            />
          </div>
        );
    }
  })();

  return (
    <DialogContent size="lg">
      <DialogHeader>
        <DialogTitle>{spec.label}</DialogTitle>
        <DialogDescription className="break-words">{spec.who}</DialogDescription>
      </DialogHeader>

      <DialogBody className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">
          In the system now: <span className="font-medium text-foreground">{spec.show(spec.live) || "(blank)"}</span>
        </p>
        {input}
        {showError && <p className="text-sm text-destructive">{error}</p>}
        {problem && (
          <Alert variant="destructive">
            <AlertDescription>{problem}</AlertDescription>
          </Alert>
        )}
        {spec.note && <p className="text-xs text-muted-foreground">{spec.note}</p>}
        <Affects spec={spec} />
        <p className="text-xs text-muted-foreground">{SAVED_NOTE}</p>
      </DialogBody>

      <DialogFooter>
        {changed && (
          <Button type="button" variant="ghost" className="sm:mr-auto" onClick={() => { onSaveField(spec, null); onClose(); }}>
            <RotateCcw className="h-4 w-4" /> Undo change
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="button" onClick={done} disabled={Boolean(error) && tried}>Done</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ---- Report lang ---------------------------------------------------------------------

function OverrideBody({ spec, onSaveOverride, onClose }: CellEditorProps & { spec: OverrideSpec }) {
  // Ang petsa ay nakaimbak bilang "August 1, 2025" sa papel; sa kalendaryo ay YYYY-MM-DD
  const [value, setValue] = useState(() => (spec.input === "date" ? toIsoDate(spec.value) : spec.value));
  const [tried, setTried] = useState(false);
  const error = validateOverride(spec, value);
  const edited = spec.system !== null && spec.value !== spec.system;
  const id = `cell-${spec.key.replace(/[^\w-]/g, "-")}`;

  function done() {
    setTried(true);
    if (error) return;
    const stored = spec.input === "date" ? formatLongDate(value) : spec.input === "number" ? value.trim() : value;
    onSaveOverride(spec, spec.system !== null && stored === spec.system ? null : stored);
    onClose();
  }

  const input = (() => {
    switch (spec.input) {
      case "select":
        return <SelectInput id={id} value={value} options={spec.options ?? []} invalid={tried && Boolean(error)} onChange={setValue} />;
      case "date":
        return <DateInput id={id} value={value} invalid={tried && Boolean(error)} onChange={setValue} />;
      case "number":
        return (
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            min={spec.min}
            max={spec.max}
            step="any"
            aria-invalid={tried && Boolean(error)}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); done(); } }}
            autoFocus
          />
        );
      default:
        return (
          <Input
            id={id}
            aria-invalid={tried && Boolean(error)}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); done(); } }}
            autoFocus
          />
        );
    }
  })();

  return (
    <DialogContent size="lg">
      <DialogHeader>
        <DialogTitle>{spec.label}</DialogTitle>
        <DialogDescription className="break-words">{spec.who || "This report only"}</DialogDescription>
      </DialogHeader>

      <DialogBody className="flex flex-col gap-4">
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertDescription>
            This changes this report only, including print, PDF and Excel. {spec.reason}
          </AlertDescription>
        </Alert>
        {spec.system !== null && (
          <p className="text-xs text-muted-foreground">
            System value: <span className="font-medium text-foreground">{spec.system || "(blank)"}</span>
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor={id}>{spec.label}</Label>
          {input}
        </div>
        {tried && error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">Saved automatically with this report.</p>
      </DialogBody>

      <DialogFooter>
        {edited && (
          <Button type="button" variant="ghost" className="sm:mr-auto" onClick={() => { onSaveOverride(spec, null); onClose(); }}>
            <RotateCcw className="h-4 w-4" /> Reset to system value
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="button" onClick={done}>Done</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ---- Panahon ng training (HTE) -----------------------------------------------------

function PeriodBody({ spec, pending, problems, onSaveField, onClose }: CellEditorProps & { spec: PeriodSpec }) {
  const [start, setStart] = useState(() => valueOf(spec.start, pending));
  const [end, setEnd] = useState(() => (spec.end ? valueOf(spec.end, pending) : ""));
  const [tried, setTried] = useState(false);

  const startError = spec.start.validate(start, pending);
  // Ang katapusan ay hindi dapat mas maaga sa bagong simula
  const endError = spec.end
    ? (spec.end.validate(end, pending) ?? (start && end && end < start ? "The end can't be earlier than the start." : null))
    : null;
  const changed = isPending(spec.start, pending) || (spec.end !== null && isPending(spec.end, pending));
  const problem = [spec.start.key, spec.end?.key].map((k) => (k ? problems[k] : undefined)).find(Boolean);

  function done() {
    setTried(true);
    if (startError || endError) return;
    onSaveField(spec.start, start);
    if (spec.end) onSaveField(spec.end, end);
    onClose();
  }

  return (
    <DialogContent size="lg">
      <DialogHeader>
        <DialogTitle>{spec.label}</DialogTitle>
        <DialogDescription className="break-words">{spec.who}</DialogDescription>
      </DialogHeader>

      <DialogBody className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">
          In the system now: <span className="font-medium text-foreground">{spec.show(spec.start.live, spec.end?.live ?? "") || "(blank)"}</span>
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="period-start">Start of training</Label>
            <DateInput id="period-start" value={start} invalid={tried && Boolean(startError)} onChange={setStart} />
            {spec.start.note && <p className="text-xs text-muted-foreground">{spec.start.note}</p>}
            {tried && startError && <p className="text-sm text-destructive">{startError}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="period-end">End of training</Label>
            {spec.end ? (
              <>
                <DateInput id="period-end" value={end} invalid={tried && Boolean(endError)} onChange={setEnd} clearable={false}
                  max={new Date().toISOString().slice(0, 10)} />
                {tried && endError && <p className="text-sm text-destructive">{endError}</p>}
              </>
            ) : (
              <>
                <Input id="period-end" disabled value="" placeholder="Not completed yet" />
                <p className="text-xs text-muted-foreground">{spec.endNote}</p>
              </>
            )}
          </div>
        </div>
        {problem && (
          <Alert variant="destructive">
            <AlertDescription>{problem}</AlertDescription>
          </Alert>
        )}
        <p className="text-xs text-muted-foreground">{SAVED_NOTE}</p>
      </DialogBody>

      <DialogFooter>
        {changed && (
          <Button
            type="button"
            variant="ghost"
            className="sm:mr-auto"
            onClick={() => { onSaveField(spec.start, null); if (spec.end) onSaveField(spec.end, null); onClose(); }}
          >
            <RotateCcw className="h-4 w-4" /> Undo change
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="button" onClick={done}>Done</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ---- Pangalan ng student (tatlong field) ---------------------------------------------

function NameBody({ spec, pending, problems, onSaveField, onClose }: CellEditorProps & { spec: NameSpec }) {
  const parts = [spec.last, spec.first, spec.middle];
  const [values, setValues] = useState(() => parts.map((p) => valueOf(p, pending)));
  const [tried, setTried] = useState(false);
  const errors = parts.map((p, i) => p.validate(values[i], pending));
  const changed = parts.some((p) => isPending(p, pending));
  const problem = parts.map((p) => problems[p.key]).find(Boolean);

  function done() {
    setTried(true);
    if (errors.some(Boolean)) return;
    parts.forEach((p, i) => onSaveField(p, values[i]));
    onClose();
  }

  return (
    <DialogContent size="lg">
      <DialogHeader>
        <DialogTitle>{spec.label}</DialogTitle>
        <DialogDescription className="break-words">{spec.who}</DialogDescription>
      </DialogHeader>

      <DialogBody className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">
          In the system now: <span className="font-medium text-foreground">{spec.show(spec.last.live, spec.first.live, spec.middle.live)}</span>
        </p>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_6rem]">
          {parts.map((p, i) => (
            <div key={p.key} className="flex min-w-0 flex-col gap-2">
              <Label htmlFor={`name-${i}`}>{p.label}</Label>
              <Input
                id={`name-${i}`}
                maxLength={p.maxLength ?? 100}
                aria-invalid={tried && Boolean(errors[i])}
                value={values[i]}
                onChange={(e) => setValues((cur) => cur.map((v, k) => (k === i ? e.target.value : v)))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); done(); } }}
                autoFocus={i === 0}
              />
              {tried && errors[i] && <p className="text-sm text-destructive">{errors[i]}</p>}
            </div>
          ))}
        </div>
        {problem && (
          <Alert variant="destructive">
            <AlertDescription>{problem}</AlertDescription>
          </Alert>
        )}
        <p className="text-xs text-muted-foreground">Same rules as editing the student on the Students page.</p>
        <p className="text-xs text-muted-foreground">{SAVED_NOTE}</p>
      </DialogBody>

      <DialogFooter>
        {changed && (
          <Button type="button" variant="ghost" className="sm:mr-auto" onClick={() => { parts.forEach((p) => onSaveField(p, null)); onClose(); }}>
            <RotateCcw className="h-4 w-4" /> Undo change
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="button" onClick={done}>Done</Button>
      </DialogFooter>
    </DialogContent>
  );
}
