import { useState } from "react";
import { getErrorMessage } from "@/lib/errors";
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

interface Props {
  onOpenChange: (open: boolean) => void;
  /** Bilang ng napiling student */
  count: number;
  /** Tinatawag kapag may valid na hours. Ang hours ay ilalapat sa lahat ng napiling student. */
  onSubmit: (hours: number) => Promise<void>;
}

/** Humihingi ng isang Hours rendered na ilalapat sa lahat ng napiling student bago i-Checked ang DTR */
export function BulkHoursDialog({ onOpenChange, count, onSubmit }: Props) {
  const [hours, setHours] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const students = `${count} student${count === 1 ? "" : "s"}`;

  async function submit() {
    const n = Number(hours);
    if (hours.trim() === "" || !Number.isFinite(n) || n < 0 || n > 744) {
      setError("Enter the hours rendered (between 0 and 744).");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit(n);
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "The bulk action failed."));
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !saving && onOpenChange(open)}>
      <DialogContent className="sm:max-w-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>Mark as Checked</DialogTitle>
            <DialogDescription>
              The hours you enter are applied to {students} you selected, and they count toward each student's total.
            </DialogDescription>
          </DialogHeader>

          <section className="flex flex-col gap-1.5">
            <label htmlFor="bulk-hours-all" className="text-sm font-medium">
              Hours rendered
            </label>
            <Input
              id="bulk-hours-all"
              autoFocus
              inputMode="decimal"
              value={hours}
              onChange={(e) => {
                setHours(e.target.value.replace(/[^\d.]/g, ""));
                setError("");
              }}
              className="w-40"
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </section>

          <DialogFooter>
            <Button type="button" variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Applying..." : "Set Checked"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
