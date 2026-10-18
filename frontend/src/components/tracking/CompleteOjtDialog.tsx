import { useState, type FormEvent } from "react";
import { Undo2 } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { formatLongDate, todayIso } from "@/lib/dates";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CompleteOjtDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: number;
  studentName: string;
  initialDate: string | null;
  isEdit: boolean;
  onCompleted: (result: { status: string; completedDate: string }) => void;
  onReverted: () => void;
}

export function CompleteOjtDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  initialDate,
  isEdit,
  onCompleted,
  onReverted,
}: CompleteOjtDialogProps) {
  const [date, setDate] = useState(
    initialDate ? initialDate.slice(0, 10) : todayIso(),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const [reverting, setReverting] = useState(false);

  const busy = saving || reverting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!date) {
      setError("Please enter the completion date.");
      return;
    }
    if (date > todayIso()) {
      setError("The completion date can't be in the future.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await api.patch<{ status: string; completedDate: string }>(
        `/coordinator/students/${studentId}/complete`,
        { completedDate: date },
      );
      onCompleted(res.data);
      notify.success(
        isEdit
          ? `Completion date of ${studentName} changed to ${formatLongDate(res.data.completedDate)}.`
          : `${studentName} was marked as completed on ${formatLongDate(res.data.completedDate)}.`,
      );
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save the completion date."));
    } finally {
      setSaving(false);
    }
  }

  async function handleRevert() {
    setReverting(true);
    setError("");

    try {
      await api.delete(`/coordinator/students/${studentId}/complete`);
      onReverted();
      notify.success(`${studentName} was returned to Deployed.`);
      onOpenChange(false);
    } catch (err) {
      setError(
        getErrorMessage(err, "Failed to return the student to Deployed."),
      );
      setConfirmRevert(false);
    } finally {
      setReverting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit completion date" : "Mark OJT as completed"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? `Update the date ${studentName} finished the OJT, or return the student to Deployed.`
                : `Select the date ${studentName} finished the OJT. Their status will change to Completed.`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ojt-completed-date">Date completed</Label>
            <Input
              id="ojt-completed-date"
              type="date"
              max={todayIso()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={confirmRevert}
              autoFocus
            />
            {!isEdit && (
              <p className="text-xs text-muted-foreground">
                This also closes the student's current company placement record.
              </p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {confirmRevert ? (
            <div className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <p className="text-sm">
                Return {studentName} to{" "}
                <span className="font-medium">Deployed</span>? The completion
                date, hired date, job relation, and employability will be
                cleared. The company placement stays active.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={reverting}
                  onClick={() => setConfirmRevert(false)}
                >
                  Keep as completed
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={reverting}
                  onClick={() => void handleRevert()}
                >
                  {reverting ? "Reverting..." : "Yes, return to Deployed"}
                </Button>
              </div>
            </div>
          ) : (
            <DialogFooter className="sm:justify-between">
              {isEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => setConfirmRevert(true)}
                >
                  <Undo2 className="h-4 w-4" />
                  Revert to Deployed
                </Button>
              ) : (
                <span />
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {saving
                    ? "Saving..."
                    : isEdit
                      ? "Save date"
                      : "Mark as completed"}
                </Button>
              </div>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
