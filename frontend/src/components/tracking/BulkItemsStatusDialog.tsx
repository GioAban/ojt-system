import { useState } from "react";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { TrackingStatus } from "@/types/tracking";
import type { ReviewRating } from "@/types/review";
import {
  RATING_LABEL,
  RATING_ORDER,
  STATUS_CONFIG,
  STATUS_ORDER,
} from "@/components/tracking/statusConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Item {
  id: number;
  label: string;
}

interface Props {
  onOpenChange: (open: boolean) => void;
  /** Bilang ng napiling student */
  count: number;
  /** "week" o "month" */
  noun: string;
  items: Item[];
  /** Paalala sa ibaba, hal. na ang Checked sa DTR ay nangangailangan ng hours */
  hint?: string;
  /** weekly: Checked ay may kasamang evaluation. dtr: Checked ay may kasamang hours. */
  kind?: "weekly" | "dtr";
  onSubmit: (
    itemIds: number[],
    status: TrackingStatus,
    extra: { rating?: ReviewRating; hours?: number },
  ) => Promise<void>;
}

/** Ang laman ng Checked: evaluation (weekly) o hours (DTR) */
interface Extra {
  rating: ReviewRating | null;
  hours: string;
}

/** Piliin ang mga linggo o buwan at ang status na ilalapat sa lahat ng napiling student */
export function BulkItemsStatusDialog({ onOpenChange, count, noun, items, hint, kind, onSubmit }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<TrackingStatus>("CHECKED");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [extra, setExtra] = useState<Extra>({ rating: null, hours: "" });

  const allSelected = items.length > 0 && selected.size === items.length;
  const students = `${count} student${count === 1 ? "" : "s"}`;

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (selected.size === 0) {
      setError(`Select at least one ${noun}.`);
      return;
    }
    const payload: { rating?: ReviewRating; hours?: number } = {};
    if (status === "CHECKED" && kind === "weekly" && extra.rating) payload.rating = extra.rating;
    if (status === "CHECKED" && kind === "dtr" && extra.hours.trim() !== "") {
      const n = Number(extra.hours);
      if (!Number.isFinite(n) || n < 0 || n > 744) {
        setError("Hours must be between 0 and 744.");
        return;
      }
      payload.hours = n;
    }

    setSaving(true);
    setError("");
    try {
      await onSubmit(
        items.filter((i) => selected.has(i.id)).map((i) => i.id),
        status,
        payload,
      );
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "The bulk action failed."));
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !saving && onOpenChange(open)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set status</DialogTitle>
          <DialogDescription>
            Applies to {students} you selected. Files and comments are not removed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">{noun === "week" ? "Weeks" : "Months"}</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))}
              >
                {allSelected ? "Clear" : "Select all"}
              </Button>
            </div>
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border p-2">
              {items.map((item) => (
                <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => toggle(item.id)}
                    className="h-4 w-4 accent-primary"
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-1.5">
            <h3 className="text-sm font-medium">Status</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {STATUS_ORDER.map((option) => {
                const config = STATUS_CONFIG[option];
                const active = status === option;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setStatus(option)}
                    className={cn(
                      "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? config.chipClass : "text-muted-foreground hover:bg-muted",
                      active && "ring-2 ring-offset-1 ring-offset-background",
                    )}
                  >
                    <config.Icon className="h-4 w-4" />
                    {config.label}
                  </button>
                );
              })}
            </div>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          </section>

          {status === "CHECKED" && kind === "weekly" && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-sm font-medium">Evaluation</h3>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={extra.rating === null ? "default" : "outline"}
                  onClick={() => setExtra((e) => ({ ...e, rating: null }))}
                >
                  Keep each student's
                </Button>
                {[...RATING_ORDER].reverse().map((option) => (
                  <Button
                    key={option}
                    type="button"
                    size="sm"
                    variant={extra.rating === option ? "default" : "outline"}
                    onClick={() => setExtra((e) => ({ ...e, rating: option }))}
                  >
                    {RATING_LABEL[option]}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                A report can only be Checked with an evaluation. Reports that have none are skipped unless you pick one
                here, which is then applied to all of them.
              </p>
            </section>
          )}

          {status === "CHECKED" && kind === "dtr" && (
            <section className="flex flex-col gap-1.5">
              <label htmlFor="bulk-checked-hours" className="text-sm font-medium">
                Hours rendered
              </label>
              <Input
                id="bulk-checked-hours"
                inputMode="decimal"
                placeholder="Leave blank to use each student's hours"
                value={extra.hours}
                onChange={(e) => setExtra((x) => ({ ...x, hours: e.target.value.replace(/[^\d.]/g, "") }))}
              />
              <p className="text-xs text-muted-foreground">
                A DTR can only be Checked with hours. DTRs that have none are skipped unless you enter hours here,
                which are then applied to all of them.
              </p>
            </section>
          )}

          {status !== "CHECKED" && kind === "weekly" && (
            <p className="text-xs text-muted-foreground">
              Only Checked reports keep an evaluation. Any evaluation on the selected reports will be cleared.
            </p>
          )}

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={() => void submit()}>
            {saving ? "Applying..." : `Set ${STATUS_CONFIG[status].label}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
