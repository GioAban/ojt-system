import { useEffect, useState } from "react";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import type { TrackingStatus } from "@/types/tracking";
import type { CellDetail, CellResult, ReviewKind, ReviewRating } from "@/types/review";
import {
  RATING_LABEL,
  RATING_ORDER,
  STATUS_CONFIG,
  STATUS_ORDER,
} from "@/components/tracking/statusConfig";
import { PrivateComments } from "@/components/requirements/PrivateComments";
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
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  kind: ReviewKind;
  studentId: number;
  itemId: number;
  studentName: string;
  itemLabel: string;
  initialStatus: TrackingStatus;
  /** Mensahe sa itaas, hal. kulang ang hours */
  hint?: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (result: CellResult) => void;
}

const KIND_TITLE: Record<ReviewKind, string> = {
  weekly: "Weekly report",
  dtr: "Daily time record",
  requirement: "Requirement",
};

/** "View work": tingnan ang na-upload na file ng student, itakda ang status, hours, o evaluation */
export function ReviewDialog({
  kind,
  studentId,
  itemId,
  studentName,
  itemLabel,
  initialStatus,
  hint,
  onOpenChange,
  onSaved,
}: Props) {
  const [detail, setDetail] = useState<CellDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [status, setStatus] = useState<TrackingStatus>(initialStatus);
  const [hours, setHours] = useState("");
  const [rating, setRating] = useState<ReviewRating | "NONE">("NONE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(hint ?? "");
  const [opening, setOpening] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<CellDetail>("/coordinator/review/cell", { params: { kind, studentId, itemId } })
      .then((res) => {
        if (cancelled) return;
        setDetail(res.data);
        setStatus(res.data.status);
        setHours(res.data.hours === null ? "" : String(res.data.hours));
        setRating(res.data.rating ?? "NONE");
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getErrorMessage(err, "Couldn't load the submission."));
      });
    return () => {
      cancelled = true;
    };
  }, [kind, studentId, itemId]);

  async function openFile(index: number) {
    setOpening(index);
    // Binubuksan agad ang tab para hindi ito harangin ng browser pagkatapos ng request
    const tab = window.open("about:blank", "_blank");
    try {
      const res = await api.get<{ url: string }>("/coordinator/review/file-url", {
        params: { kind, studentId, itemId, index },
      });
      if (tab) tab.location.href = res.data.url;
      else window.location.href = res.data.url;
    } catch (err) {
      tab?.close();
      notify.error(getErrorMessage(err, "Couldn't open the file."));
    } finally {
      setOpening(null);
    }
  }

  async function save() {
    setError("");

    let hoursValue: number | null = null;
    if (kind === "dtr") {
      if (hours.trim() !== "") {
        const n = Number(hours);
        if (!Number.isFinite(n) || n < 0 || n > 744) {
          setError("Hours must be between 0 and 744.");
          return;
        }
        hoursValue = n;
      }
      if (status === "CHECKED" && hoursValue === null) {
        setError("Enter the hours rendered before marking this as Checked.");
        return;
      }
    }
    if (kind === "weekly" && status === "CHECKED" && rating === "NONE") {
      setError("Select an evaluation before marking this as Checked.");
      return;
    }

    setSaving(true);
    try {
      const res = await api.patch<CellResult>("/coordinator/review/cell", {
        kind,
        studentId,
        itemId,
        status,
        hours: kind === "dtr" ? hoursValue : null,
        clearHours: kind === "dtr" && hoursValue === null,
        rating: kind === "weekly" ? (status === "CHECKED" ? rating : "NONE") : null,
      });
      notify.success(`${studentName}: ${itemLabel} is now ${STATUS_CONFIG[res.data.cell.status].label}.`);
      onSaved(res.data);
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save the changes."));
    } finally {
      setSaving(false);
    }
  }

  const loading = detail === null && !loadError;
  // Status kapag inalis ang evaluation o hours
  const fallbackStatus: TrackingStatus =
    initialStatus === "INVALID" ? "INVALID" : detail && detail.files.length > 0 ? "FOR_CHECKING" : "ASSIGNED";

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{KIND_TITLE[kind]}: {itemLabel}</DialogTitle>
          <DialogDescription>{studentName}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <section aria-label="Submitted file" className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Submitted file</h3>
            {loading && <Skeleton className="h-10 w-full" />}
            {loadError && <p className="text-sm text-destructive">{loadError}</p>}
            {detail && detail.files.length === 0 && (
              <p className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
                No scanned copy has been uploaded yet.
              </p>
            )}
            {detail?.files.map((name, index) => (
              <div key={`${name}-${index}`} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm" title={name}>{name}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={opening !== null}
                  onClick={() => void openFile(index)}
                >
                  {opening === index ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ExternalLink className="h-3.5 w-3.5" />
                  )}
                  Open
                </Button>
              </div>
            ))}
          </section>

          {kind === "dtr" && (
            <section className="flex flex-col gap-1.5">
              <label htmlFor="review-hours" className="text-sm font-medium">Hours rendered</label>
              <Input
                id="review-hours"
                type="number"
                inputMode="decimal"
                min={0}
                max={744}
                step="0.5"
                value={hours}
                onChange={(e) => {
                  const value = e.target.value;
                  setHours(value);
                  setError("");
                  // Ang oras ay kasama ng status: may hours = Checked, wala = hindi pa Checked
                  if (value.trim() !== "") setStatus("CHECKED");
                  else if (status === "CHECKED") setStatus(fallbackStatus);
                }}
                className="w-40"
              />
              <p className="text-xs text-muted-foreground">
                Entering hours marks the DTR as Checked, and they count toward the student's total only then. You can
                correct the hours the student entered, or set another status to keep them without approving.
              </p>
            </section>
          )}

          {kind === "weekly" && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-sm font-medium">Supervisor's evaluation</h3>
              <div className="flex flex-wrap gap-1.5">
                {[...RATING_ORDER, "NONE" as const].map((option) => (
                  <Button
                    key={option}
                    type="button"
                    size="sm"
                    variant={rating === option ? "default" : "outline"}
                    onClick={() => {
                      setRating(option);
                      setError("");
                      // Ang evaluation ay kasama ng status: may evaluation = Checked
                      if (option !== "NONE") setStatus("CHECKED");
                      else if (status === "CHECKED") setStatus(fallbackStatus);
                    }}
                  >
                    {option === "NONE" ? "None" : RATING_LABEL[option]}
                  </Button>
                ))}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-1.5">
            <h3 className="text-sm font-medium">Status</h3>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
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
                      if (kind === "weekly" && option !== "CHECKED") setRating("NONE");
                      if (option === "CHECKED") {
                        if (kind === "weekly" && rating === "NONE") {
                          setError("Select an evaluation to mark this as Checked.");
                        }
                        if (kind === "dtr" && hours.trim() === "") {
                          setError("Enter the hours rendered to mark this as Checked.");
                        }
                      }
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
          </section>

          {error && (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          )}

          <PrivateComments
            key={`${kind}-${itemId}-${studentId}`}
            path={
              kind === "requirement"
                ? `/coordinator/requirements/${itemId}/submissions/${studentId}/comments`
                : `/coordinator/requirements/${kind}/${itemId}/submissions/${studentId}/comments`
            }
            studentName={studentName}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={saving || loading} onClick={() => void save()}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
