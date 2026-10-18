import { useState, type FormEvent } from "react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import type { College } from "@/types/college";
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

interface CollegeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  college: College | null; // null = add, may laman = edit
  onSaved: (message: string) => void;
}

export function CollegeFormDialog({
  open,
  onOpenChange,
  college,
  onSaved,
}: CollegeFormDialogProps) {
  const [name, setName] = useState(college?.name ?? "");
  const [abbreviation, setAbbreviation] = useState(college?.abbreviation ?? "");
  const [dean, setDean] = useState(college?.dean ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!name.trim() || !abbreviation.trim() || !dean.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      name: name.trim(),
      abbreviation: abbreviation.trim(),
      dean: dean.trim(),
    };

    try {
      if (college) {
        const res = await api.put<College>(`/colleges/${college.id}`, payload);
        onSaved(`${res.data.abbreviation} was updated.`);
      } else {
        const res = await api.post<College>("/colleges", payload);
        onSaved(`${res.data.abbreviation} was added.`);
      }
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save college."));
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
              {college ? "Edit College" : "Add College"}
            </DialogTitle>
            <DialogDescription>
              Enter the college details. The abbreviation must be unique.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="college-name">College name</Label>
            <Input
              id="college-name"
              maxLength={255}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="college-abbreviation">Abbreviation</Label>
            <Input
              id="college-abbreviation"
              maxLength={20}
              value={abbreviation}
              onChange={(e) => setAbbreviation(e.target.value.toUpperCase())}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="college-dean">Dean</Label>
            <Input
              id="college-dean"
              maxLength={45}
              value={dean}
              onChange={(e) => setDean(e.target.value)}
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
              {saving ? "Saving..." : college ? "Save changes" : "Add college"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
