import { useState, type FormEvent } from "react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import type { DtrColumn } from "@/types/trackingSections";
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

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface AddMonthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semesterId: number;
  semesterName: string;
  existingMonths: string[];
  onAdded: (column: DtrColumn) => void;
}

export function AddMonthDialog({
  open,
  onOpenChange,
  semesterId,
  semesterName,
  existingMonths,
  onAdded,
}: AddMonthDialogProps) {
  const [month, setMonth] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!month) {
      setError("Please select a month.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await api.post<DtrColumn>(
        "/coordinator/tracking/dtr/months",
        {
          semesterId,
          month,
          dueDate: dueDate || null,
        },
      );
      onAdded(res.data);
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add the month."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add month</DialogTitle>
            <DialogDescription>
              Adds a DTR month for all of your students in {semesterName}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 [&>div]:w-full">
            <Label htmlFor="dtr-month">Month</Label>
            <NativeSelect
              id="dtr-month"
              className="w-full"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              <NativeSelectOption value="">Select a month</NativeSelectOption>
              {MONTHS.map((m) => (
                <NativeSelectOption
                  key={m}
                  value={m}
                  disabled={existingMonths.includes(m)}
                >
                  {m}
                  {existingMonths.includes(m) ? " (already added)" : ""}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="dtr-due">
              Due date <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="dtr-due"
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
              {saving ? "Adding..." : "Add month"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
