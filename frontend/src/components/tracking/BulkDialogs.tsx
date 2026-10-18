import { useState, type FormEvent, type ReactNode } from "react";
import { formatPeriod } from "@/lib/dates";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { TrackingStatus } from "@/types/tracking";
import type {
  DtrColumn,
  WeeklyColumn,
  WeeklyRating,
} from "@/types/trackingSections";
import { SelectBox } from "@/components/tracking/SelectBox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const who = (count: number) =>
  count === 1 ? "1 selected student" : `${count} selected students`;

interface ShellProps {
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  submitLabel: string;
  validate?: () => string | null;
  onSubmit: () => Promise<void>;
  children: ReactNode;
}

function Shell({
  onOpenChange,
  title,
  description,
  submitLabel,
  validate,
  onSubmit,
  children,
}: ShellProps) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const problem = validate?.() ?? null;
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSubmit();
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "The bulk action failed."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {children}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Applying..." : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ChecklistItem {
  id: number;
  label: string;
}

function ItemChecklist({
  items,
  selected,
  noun,
  onChange,
}: {
  items: ChecklistItem[];
  selected: number[];
  noun: string;
  onChange: (ids: number[]) => void;
}) {
  const all = items.length > 0 && selected.length === items.length;

  return (
    <div className="flex flex-col gap-2">
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <SelectBox
          checked={all}
          indeterminate={selected.length > 0 && !all}
          label={`All ${noun}`}
          onChange={(checked) =>
            onChange(checked ? items.map((i) => i.id) : [])
          }
        />
        All {noun}
        <span className="font-normal text-muted-foreground">
          ({items.length})
        </span>
      </label>

      <div className="max-h-48 overflow-y-auto rounded-md border">
        {items.map((item) => (
          <label
            key={item.id}
            className="flex cursor-pointer items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted"
          >
            <SelectBox
              checked={selected.includes(item.id)}
              label={item.label}
              onChange={(checked) =>
                onChange(
                  checked
                    ? [...selected, item.id]
                    : selected.filter((x) => x !== item.id),
                )
              }
            />
            <span className="truncate">{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function OptionButtons<T extends string>({
  value,
  options,
  columns,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  columns: string;
  onChange: (value: T) => void;
}) {
  return (
    <div className={cn("grid gap-2", columns)}>
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={value === option.value ? "default" : "outline"}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

const STATUS_OPTIONS: { value: TrackingStatus; label: string }[] = [
  { value: "ASSIGNED", label: "Assigned" },
  { value: "FOR_CHECKING", label: "For checking" },
  { value: "CHECKED", label: "Checked" },
  { value: "INVALID", label: "Invalid" },
];

interface BulkStatusDialogProps {
  onOpenChange: (open: boolean) => void;
  count: number;
  requirements: { id: number; title: string }[];
  onSubmit: (requirementIds: number[], status: TrackingStatus) => Promise<void>;
}

export function BulkStatusDialog({
  onOpenChange,
  count,
  requirements,
  onSubmit,
}: BulkStatusDialogProps) {
  const [ids, setIds] = useState(() => requirements.map((r) => r.id));
  const [status, setStatus] = useState<TrackingStatus>("CHECKED");

  return (
    <Shell
      onOpenChange={onOpenChange}
      title="Set status"
      description={`Applies to ${who(count)}.`}
      submitLabel="Apply"
      validate={() =>
        ids.length === 0 ? "Select at least one requirement." : null
      }
      onSubmit={() => onSubmit(ids, status)}
    >
      <div className="flex flex-col gap-2">
        <Label>Requirements</Label>
        <ItemChecklist
          items={requirements.map((r) => ({ id: r.id, label: r.title }))}
          selected={ids}
          noun="requirements"
          onChange={setIds}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Status</Label>
        <OptionButtons
          value={status}
          options={STATUS_OPTIONS}
          columns="grid-cols-2"
          onChange={setStatus}
        />
        {status === "ASSIGNED" && (
          <p className="text-xs text-muted-foreground">
            This resets the status. Submitted files and comments are kept.
          </p>
        )}
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------

const RATING_OPTIONS: { value: WeeklyRating; label: string }[] = [
  { value: "EXCELLENT", label: "Excellent" },
  { value: "VERY_GOOD", label: "Very Good" },
  { value: "GOOD", label: "Good" },
  { value: "POOR", label: "Poor" },
  { value: "NONE", label: "No evaluation (clear)" },
];

interface BulkRatingDialogProps {
  onOpenChange: (open: boolean) => void;
  count: number;
  weeks: WeeklyColumn[];
  onSubmit: (reportIds: number[], rating: WeeklyRating) => Promise<void>;
}

export function BulkRatingDialog({
  onOpenChange,
  count,
  weeks,
  onSubmit,
}: BulkRatingDialogProps) {
  const [ids, setIds] = useState(() => weeks.map((w) => w.id));
  const [rating, setRating] = useState<WeeklyRating>("EXCELLENT");

  return (
    <Shell
      onOpenChange={onOpenChange}
      title="Set evaluation"
      description={`The supervisor's evaluation for ${who(count)}.`}
      submitLabel="Apply"
      validate={() => (ids.length === 0 ? "Select at least one week." : null)}
      onSubmit={() => onSubmit(ids, rating)}
    >
      <div className="flex flex-col gap-2">
        <Label>Weeks</Label>
        <ItemChecklist
          items={weeks.map((w) => ({
            id: w.id,
            label: formatPeriod(w.dateFrom, w.dateTo),
          }))}
          selected={ids}
          noun="weeks"
          onChange={setIds}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Evaluation</Label>
        <OptionButtons
          value={rating}
          options={RATING_OPTIONS}
          columns="grid-cols-2 sm:grid-cols-3"
          onChange={setRating}
        />
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------

interface BulkHoursDialogProps {
  onOpenChange: (open: boolean) => void;
  count: number;
  months: DtrColumn[];
  onSubmit: (dtrId: number, hours: number | null) => Promise<void>;
}

export function BulkHoursDialog({
  onOpenChange,
  count,
  months,
  onSubmit,
}: BulkHoursDialogProps) {
  const [dtrId, setDtrId] = useState(months[0] ? String(months[0].id) : "");
  const [hours, setHours] = useState("");

  const trimmed = hours.trim();
  const parsed = trimmed === "" ? null : Number(trimmed);

  return (
    <Shell
      onOpenChange={onOpenChange}
      title="Set hours"
      description={`Hours rendered for the month, for ${who(count)}.`}
      submitLabel={parsed === null ? "Clear hours" : "Apply"}
      validate={() => {
        if (!dtrId) return "Select a month.";
        if (
          parsed !== null &&
          (Number.isNaN(parsed) || parsed < 0 || parsed > 744)
        ) {
          return "Hours must be a number between 0 and 744.";
        }
        return null;
      }}
      onSubmit={() => onSubmit(Number(dtrId), parsed)}
    >
      <div className="flex flex-col gap-2 [&>div]:w-full">
        <Label htmlFor="bulk-month">Month</Label>
        <NativeSelect
          id="bulk-month"
          className="w-full"
          value={dtrId}
          onChange={(e) => setDtrId(e.target.value)}
        >
          {months.map((m) => (
            <NativeSelectOption key={m.id} value={String(m.id)}>
              {m.month}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="bulk-hours">Hours rendered</Label>
        <Input
          id="bulk-hours"
          inputMode="decimal"
          placeholder="e.g. 120"
          value={hours}
          onChange={(e) => setHours(e.target.value.replace(/[^\d.]/g, ""))}
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          Leave blank to clear the hours of that month.
        </p>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------

interface BulkDateDialogProps {
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  label: string;
  hint?: string;
  initial?: string;
  max?: string;
  allowClear?: boolean;
  submitLabel: string;
  onSubmit: (date: string | null) => Promise<void>;
}

export function BulkDateDialog({
  onOpenChange,
  title,
  description,
  label,
  hint,
  initial = "",
  max,
  allowClear = false,
  submitLabel,
  onSubmit,
}: BulkDateDialogProps) {
  const [date, setDate] = useState(initial);

  return (
    <Shell
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      submitLabel={allowClear && !date ? "Clear date" : submitLabel}
      validate={() => (!allowClear && !date ? "Please choose a date." : null)}
      onSubmit={() => onSubmit(date || null)}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="bulk-date">{label}</Label>
        <Input
          id="bulk-date"
          type="date"
          max={max}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          autoFocus
        />
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </Shell>
  );
}
