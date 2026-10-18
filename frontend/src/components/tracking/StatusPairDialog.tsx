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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export interface PairValues {
  status: TrackingStatus;
  /** weekly lang: "NONE" = walang evaluation */
  rating: ReviewRating | "NONE";
  /** DTR lang */
  hours: number | null;
}

interface Props {
  kind: "weekly" | "dtr";
  studentName: string;
  itemLabel: string;
  initialStatus: TrackingStatus;
  initialRating: ReviewRating | null;
  initialHours: number | null;
  /** May na-upload na file ang student (para sa status kapag inalis ang evaluation o hours) */
  hasFile: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: PairValues) => Promise<void>;
}

/**
 * Ang status ay laging may kasamang evaluation (weekly) o hours (DTR). Ang modal na ito ay lumalabas kapag
 * isa lang sa dalawa ang binago, para mailagay ang kapares nito.
 */
export function StatusPairDialog({
  kind,
  studentName,
  itemLabel,
  initialStatus,
  initialRating,
  initialHours,
  hasFile,
  onOpenChange,
  onSubmit,
}: Props) {
  const weekly = kind === "weekly";
  const [status, setStatus] = useState<TrackingStatus>(initialStatus);
  const [rating, setRating] = useState<ReviewRating | "NONE">(initialRating ?? "NONE");
  const [hours, setHours] = useState(initialHours === null ? "" : String(initialHours));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fallback: TrackingStatus = hasFile ? "FOR_CHECKING" : "ASSIGNED";

  async function submit() {
    setError("");

    let hoursValue: number | null = null;
    if (!weekly && hours.trim() !== "") {
      const n = Number(hours);
      if (!Number.isFinite(n) || n < 0 || n > 744) {
        setError("Hours must be between 0 and 744.");
        return;
      }
      hoursValue = n;
    }
    if (status === "CHECKED") {
      if (weekly && rating === "NONE") {
        setError("Select an evaluation to mark this as Checked.");
        return;
      }
      if (!weekly && hoursValue === null) {
        setError("Enter the hours rendered to mark this as Checked.");
        return;
      }
    }

    setSaving(true);
    try {
      await onSubmit({
        status,
        rating: weekly ? (status === "CHECKED" ? rating : "NONE") : "NONE",
        hours: weekly ? null : hoursValue,
      });
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save the changes."));
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !saving && onOpenChange(open)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{weekly ? "Status and evaluation" : "Status and hours"}</DialogTitle>
          <DialogDescription>
            {studentName} · {itemLabel}
            <br />
            {weekly
              ? "A weekly report is Checked together with its evaluation."
              : "A DTR is Checked together with the hours rendered."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {weekly ? (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-sm font-medium">Evaluation</h3>
              <div className="grid grid-cols-2 gap-1.5">
                {[...RATING_ORDER].reverse().map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={rating === option ? "default" : "outline"}
                    onClick={() => {
                      setRating(option);
                      setStatus("CHECKED");
                      setError("");
                    }}
                  >
                    {RATING_LABEL[option]}
                  </Button>
                ))}
              </div>
              {rating !== "NONE" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => {
                    setRating("NONE");
                    if (status === "CHECKED") setStatus(fallback);
                    setError("");
                  }}
                >
                  Clear evaluation
                </Button>
              )}
            </section>
          ) : (
            <section className="flex flex-col gap-1.5">
              <label htmlFor="pair-hours" className="text-sm font-medium">
                Hours rendered
              </label>
              <Input
                id="pair-hours"
                autoFocus
                inputMode="decimal"
                className="w-40"
                value={hours}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\d.]/g, "");
                  setHours(value);
                  setError("");
                  if (value === "" && status === "CHECKED") setStatus(fallback);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Counted toward the student's total only when the status is Checked.
              </p>
            </section>
          )}

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
                    onClick={() => {
                      setStatus(option);
                      setError("");
                      if (weekly && option !== "CHECKED") setRating("NONE");
                    }}
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
            {weekly && status !== "CHECKED" && (
              <p className="text-xs text-muted-foreground">
                Only Checked reports keep an evaluation.
              </p>
            )}
          </section>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={() => void submit()}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
