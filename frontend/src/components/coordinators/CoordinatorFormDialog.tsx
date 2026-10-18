import { useState, type FormEvent } from "react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import type { Coordinator, CoordinatorType } from "@/types/coordinator";
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

interface CoordinatorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordinator: Coordinator | null; // null = add, may laman = edit
  programs: Program[];
  onSaved: (message: string) => void;
}

export function CoordinatorFormDialog({
  open,
  onOpenChange,
  coordinator,
  programs,
  onSaved,
}: CoordinatorFormDialogProps) {
  const [fullname, setFullname] = useState(coordinator?.fullname ?? "");
  const [email, setEmail] = useState(coordinator?.email ?? "");
  const [employeeNumber, setEmployeeNumber] = useState(
    coordinator?.employeeNumber ?? "",
  );
  const [titles, setTitles] = useState(coordinator?.professionalTitles ?? "");
  const [programId, setProgramId] = useState(
    coordinator ? String(coordinator.programId) : "",
  );
  const [type, setType] = useState<CoordinatorType>(
    coordinator?.type ?? "STAFF",
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const programOptions = programs.filter(
    (p) => !p.isArchived || p.id === coordinator?.programId,
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!fullname.trim() || !email.trim() || !employeeNumber.trim()) {
      setError("Please fill in name, email, and employee number.");
      return;
    }
    if (!programId) {
      setError("Please select a program.");
      return;
    }
    if (!coordinator && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      fullname: fullname.trim(),
      email: email.trim(),
      employeeNumber: employeeNumber.trim(),
      professionalTitles: titles.trim(),
      programId: Number(programId),
      type,
      ...(coordinator ? {} : { password }),
    };

    try {
      if (coordinator) {
        const res = await api.put<Coordinator>(
          `/coordinators/${coordinator.id}`,
          payload,
        );
        onSaved(`${res.data.fullname} was updated.`);
      } else {
        const res = await api.post<Coordinator>("/coordinators", payload);
        onSaved(`${res.data.fullname} was added.`);
      }
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save coordinator."));
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
              {coordinator ? "Edit Coordinator" : "Add Coordinator"}
            </DialogTitle>
            <DialogDescription>
              {coordinator
                ? "Update the coordinator's details. Use Reset password to change their password."
                : "Create a coordinator account. Share the password with them securely."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="coord-fullname">Full name</Label>
            <Input
              id="coord-fullname"
              maxLength={100}
              value={fullname}
              onChange={(e) => setFullname(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="coord-email">Email</Label>
            <Input
              id="coord-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="coord-employee">Employee number</Label>
              <Input
                id="coord-employee"
                maxLength={50}
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="coord-titles">Professional titles</Label>
              <Input
                id="coord-titles"
                maxLength={255}
                placeholder="e.g. LPT, MIT"
                value={titles}
                onChange={(e) => setTitles(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 [&>div]:w-full">
            <Label htmlFor="coord-program">Program</Label>
            <NativeSelect
              id="coord-program"
              className="w-full"
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
            >
              <NativeSelectOption value="">Select a program</NativeSelectOption>
              {programOptions.map((p) => (
                <NativeSelectOption key={p.id} value={String(p.id)}>
                  {p.collegeAbbreviation} · {p.abbreviation} — {p.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Coordinator type</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["STAFF", "ADMIN"] as CoordinatorType[]).map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={type === value ? "default" : "outline"}
                  onClick={() => setType(value)}
                >
                  {value === "ADMIN" ? "Admin" : "Staff"}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Admin coordinators can see the Reports and Archives tabs.
            </p>
          </div>

          {!coordinator && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="coord-password">Initial password</Label>
              <Input
                id="coord-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                At least 8 characters.
              </p>
            </div>
          )}

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
                : coordinator
                  ? "Save changes"
                  : "Add coordinator"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
