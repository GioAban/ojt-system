import { useState, type FormEvent } from "react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { addDays } from "@/lib/dates";
import type { WeeklyColumn } from "@/types/trackingSections";
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

interface AddWeekDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semesterId: number;
  semesterName: string;
  onAdded: (column: WeeklyColumn) => void;
}

export function AddWeekDialog({
  open,
  onOpenChange,
  semesterId,
  semesterName,
  onAdded,
}: AddWeekDialogProps) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function handleFromChange(value: string) {
    setDateFrom(value);
    // Mungkahi: Lunes hanggang Sabado
    if (value && (!dateTo || dateTo < value)) {
      setDateTo(addDays(value, 5));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!dateFrom || !dateTo) {
      setError("Please enter the start and end dates.");
      return;
    }
    if (dateTo < dateFrom) {
      setError("The end date can't be before the start date.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await api.post<WeeklyColumn>(
        "/coordinator/tracking/weekly/periods",
        {
          semesterId,
          dateFrom,
          dateTo,
          dueDate: dueDate || null,
        },
      );
      onAdded(res.data);
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add the week."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add week</DialogTitle>
            <DialogDescription>
              Adds a weekly report period for all of your students in{" "}
              {semesterName}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="week-from">From</Label>
              <Input
                id="week-from"
                type="date"
                value={dateFrom}
                onChange={(e) => handleFromChange(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="week-to">To</Label>
              <Input
                id="week-to"
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="week-due">
              Due date <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="week-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

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
              {saving ? "Adding..." : "Add week"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
