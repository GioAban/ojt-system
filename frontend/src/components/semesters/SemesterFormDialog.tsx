import { useState, type FormEvent } from "react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import type { Semester } from "@/types/semester";
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

const TERMS = ["1st Semester", "2nd Semester", "Midyear"] as const;
type Term = (typeof TERMS)[number];

function parseSemester(name: string | undefined) {
  const match = name?.match(
    /^(1st Semester|2nd Semester|Midyear) (\d{4})-(\d{4})$/,
  );
  return match ? { term: match[1] as Term, year: match[2] } : null;
}

interface SemesterFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semester: Semester | null; // null = add, may laman = edit
  onSaved: (message: string) => void;
}

export function SemesterFormDialog({
  open,
  onOpenChange,
  semester,
  onSaved,
}: SemesterFormDialogProps) {
  const parsed = parseSemester(semester?.semester);

  const [term, setTerm] = useState<Term>(parsed?.term ?? "1st Semester");
  const [year, setYear] = useState(
    parsed?.year ?? String(new Date().getFullYear()),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const yearNumber = Number(year);
  const yearValid =
    /^\d{4}$/.test(year) && yearNumber >= 2000 && yearNumber <= 2100;
  const preview = yearValid ? `${term} ${yearNumber}-${yearNumber + 1}` : "—";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!yearValid) {
      setError("Enter a valid start year (2000–2100).");
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (semester) {
        await api.put(`/semesters/${semester.id}`, { semester: preview });
        onSaved(`Semester updated to ${preview}.`);
      } else {
        await api.post("/semesters", { semester: preview });
        onSaved(`${preview} was added.`);
      }
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save semester."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {semester ? "Edit Semester" : "Add Semester"}
            </DialogTitle>
            <DialogDescription>
              Choose the term and the year the school year starts.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label>Term</Label>
            <div className="grid grid-cols-3 gap-2">
              {TERMS.map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={term === value ? "default" : "outline"}
                  onClick={() => setTerm(value)}
                >
                  {value}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="semester-year">Start year</Label>
            <Input
              id="semester-year"
              inputMode="numeric"
              maxLength={4}
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
            />
          </div>

          <div className="rounded-md border bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground">Will be saved as</p>
            <p className="text-sm font-medium">{preview}</p>
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
              {saving
                ? "Saving..."
                : semester
                  ? "Save changes"
                  : "Add semester"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
