import { useState, type FormEvent } from "react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import type { College } from "@/types/college";
import type { Program } from "@/types/program";
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

interface ProgramFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program: Program | null; // null = add, may laman = edit
  colleges: College[];
  onSaved: (message: string) => void;
}

export function ProgramFormDialog({
  open,
  onOpenChange,
  program,
  colleges,
  onSaved,
}: ProgramFormDialogProps) {
  const [collegeId, setCollegeId] = useState(
    program ? String(program.collegeId) : "",
  );
  const [name, setName] = useState(program?.name ?? "");
  const [abbreviation, setAbbreviation] = useState(program?.abbreviation ?? "");
  const [programHead, setProgramHead] = useState(program?.programHead ?? "");
  const [hours, setHours] = useState(
    program ? String(program.trainingDuration) : "300",
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Active colleges lang, maliban sa kasalukuyang college ng program na ine-edit
  const collegeOptions = colleges.filter(
    (c) => !c.isArchived || c.id === program?.collegeId,
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const hoursNumber = Number(hours);

    if (!collegeId) {
      setError("Please select a college.");
      return;
    }
    if (!name.trim() || !abbreviation.trim() || !programHead.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    if (
      !hours ||
      Number.isNaN(hoursNumber) ||
      hoursNumber <= 0 ||
      hoursNumber > 5000
    ) {
      setError("Training hours must be between 1 and 5000.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      collegeId: Number(collegeId),
      name: name.trim(),
      abbreviation: abbreviation.trim(),
      programHead: programHead.trim(),
      trainingDuration: hoursNumber,
    };

    try {
      if (program) {
        const res = await api.put<Program>(`/programs/${program.id}`, payload);
        onSaved(`${res.data.abbreviation} was updated.`);
      } else {
        const res = await api.post<Program>("/programs", payload);
        onSaved(`${res.data.abbreviation} was added.`);
      }
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save program."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {program ? "Edit Program" : "Add Program"}
            </DialogTitle>
            <DialogDescription>
              Training hours apply to newly added students. Existing students
              keep their current hours.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 [&>div]:w-full">
            <Label htmlFor="program-college">College</Label>
            <NativeSelect
              id="program-college"
              className="w-full"
              value={collegeId}
              onChange={(e) => setCollegeId(e.target.value)}
            >
              <NativeSelectOption value="">Select a college</NativeSelectOption>
              {collegeOptions.map((c) => (
                <NativeSelectOption key={c.id} value={String(c.id)}>
                  {c.abbreviation} — {c.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="program-name">Program name</Label>
            <Input
              id="program-name"
              maxLength={255}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="program-abbreviation">Abbreviation</Label>
              <Input
                id="program-abbreviation"
                maxLength={20}
                value={abbreviation}
                onChange={(e) => setAbbreviation(e.target.value.toUpperCase())}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="program-hours">Training hours</Label>
              <Input
                id="program-hours"
                inputMode="decimal"
                value={hours}
                onChange={(e) =>
                  setHours(e.target.value.replace(/[^\d.]/g, ""))
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="program-head">Program head</Label>
            <Input
              id="program-head"
              maxLength={45}
              value={programHead}
              onChange={(e) => setProgramHead(e.target.value)}
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
              {saving ? "Saving..." : program ? "Save changes" : "Add program"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
