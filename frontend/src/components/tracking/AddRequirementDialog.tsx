import { useState, type FormEvent } from "react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import type { RequirementType, TrackingRequirement } from "@/types/tracking";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TYPE_LABELS: Record<RequirementType, string> = {
  initial: "Initial",
  pre: "Pre-deployment",
  post: "Post-deployment",
};

interface AddRequirementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semesterId: number;
  semesterName: string;
  type: RequirementType;
  onAdded: (requirement: TrackingRequirement) => void;
}

export function AddRequirementDialog({
  open,
  onOpenChange,
  semesterId,
  semesterName,
  type,
  onAdded,
}: AddRequirementDialogProps) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await api.post<TrackingRequirement>(
        "/coordinator/requirements",
        {
          semesterId,
          type,
          title: title.trim(),
          instructions: instructions.trim(),
          dueDate: dueDate || null,
        },
      );
      onAdded(res.data);
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add the requirement."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add requirement</DialogTitle>
            <DialogDescription>
              This will be added for all of your students in {semesterName}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Type</span>
            <Badge variant="secondary">{TYPE_LABELS[type]}</Badge>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="requirement-title">Title</Label>
            <Input
              id="requirement-title"
              maxLength={255}
              placeholder="e.g. Barangay Clearance"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="requirement-due">
              Due date <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="requirement-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="requirement-instructions">
              Instructions{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="requirement-instructions"
              rows={4}
              maxLength={5000}
              placeholder="Tell students what to submit and how."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
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
              {saving ? "Adding..." : "Add requirement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
