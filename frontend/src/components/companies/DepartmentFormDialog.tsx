import { useState, type FormEvent } from "react";
import api from "@/lib/api";
import { EMAIL_PATTERN, PHONE_PATTERN } from "@/lib/company";
import { getErrorMessage } from "@/lib/errors";
import type { DepartmentItem } from "@/types/company";
import { Field } from "@/components/companies/parts";
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

interface DepartmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: number;
  companyName: string;
  department: DepartmentItem | null; // null = add
  onSaved: (message: string) => void;
}

export function DepartmentFormDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  department,
  onSaved,
}: DepartmentFormDialogProps) {
  const [name, setName] = useState(department?.name ?? "");
  const [slots, setSlots] = useState(
    department ? String(department.slots) : "1",
  );
  const [supervisor, setSupervisor] = useState(
    department?.supervisorFullname ?? "",
  );
  const [position, setPosition] = useState(
    department?.supervisorPosition ?? "",
  );
  const [contact, setContact] = useState(
    department?.supervisorContactNumber ?? "",
  );
  const [email, setEmail] = useState(department?.supervisorEmail ?? "");
  const [moaStart, setMoaStart] = useState(
    (department?.moaStart ?? "").slice(0, 10),
  );
  const [moaEnd, setMoaEnd] = useState(
    (department?.moaExpiration ?? "").slice(0, 10),
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const placed = department?.filled ?? 0;

  function clear(key: string) {
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validate() {
    const next: Record<string, string> = {};
    const slotCount = Number(slots);

    if (
      !slots.trim() ||
      !Number.isInteger(slotCount) ||
      slotCount < 1 ||
      slotCount > 500
    ) {
      next.slots = "Enter a number from 1 to 500.";
    } else if (slotCount < placed) {
      next.slots = `${placed} student(s) are already placed here, so slots can't be lower than that.`;
    }

    if (!supervisor.trim()) next.supervisor = "Enter the supervisor's name.";
    if (contact.trim() && !PHONE_PATTERN.test(contact.trim())) {
      next.contact =
        "Use digits, spaces, +, -, or parentheses (7 to 20 characters).";
    }
    if (email.trim() && !EMAIL_PATTERN.test(email.trim()))
      next.email = "Enter a valid email address.";
    if (moaStart && moaEnd && moaEnd < moaStart)
      next.moaEnd = "The MOA can't end before it starts.";

    return next;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);

    const payload = {
      // Hindi lahat ng company ay may department, kaya N/A ang itatabi kapag walang pangalan
      name: name.trim() || "N/A",
      slots: Number(slots),
      supervisorFullname: supervisor.trim(),
      supervisorPosition: position.trim(),
      supervisorContactNumber: contact.trim(),
      supervisorEmail: email.trim(),
      // Ang idinagdag o ine-edit ng coordinator ay approved; ang pending ay nasa Requests tab
      status: "APPROVED",
      moaStart: moaStart || null,
      moaExpiration: moaEnd || null,
    };

    try {
      if (department) {
        await api.put(
          `/coordinator/companies/departments/${department.id}`,
          payload,
        );
        onSaved(`${payload.name} was updated.`);
      } else {
        await api.post(
          `/coordinator/companies/${companyId}/departments`,
          payload,
        );
        onSaved(`${payload.name} was added to ${companyName}.`);
      }
      onOpenChange(false);
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to save the department."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5"
          noValidate
        >
          <DialogHeader>
            <DialogTitle>
              {department ? "Edit department" : "Add department"}
            </DialogTitle>
            <DialogDescription>
              {department
                ? `A department of ${companyName}.`
                : `A new department under ${companyName}, where students can be placed.`}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Department name (optional)"
              htmlFor="dep-name"
              error={errors.name}
              className="sm:col-span-2"
            >
              <Input
                id="dep-name"
                maxLength={255}
                placeholder="e.g. MIS Office (leave blank if none, saved as N/A)"
                aria-invalid={Boolean(errors.name)}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clear("name");
                }}
                autoFocus
              />
            </Field>

            <Field
              label="Slots"
              htmlFor="dep-slots"
              required
              error={errors.slots}
              hint={placed > 0 ? `${placed} placed` : "Students it can take"}
            >
              <Input
                id="dep-slots"
                inputMode="numeric"
                aria-invalid={Boolean(errors.slots)}
                value={slots}
                onChange={(e) => {
                  setSlots(e.target.value.replace(/\D/g, ""));
                  clear("slots");
                }}
              />
            </Field>
          </div>

          <section className="flex flex-col gap-4 border-t pt-5">
            <div>
              <h3 className="text-sm font-medium">Supervisor</h3>
              <p className="text-xs text-muted-foreground">
                Who supervises the students in this department.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Full name"
                htmlFor="dep-sup"
                required
                error={errors.supervisor}
              >
                <Input
                  id="dep-sup"
                  maxLength={255}
                  aria-invalid={Boolean(errors.supervisor)}
                  value={supervisor}
                  onChange={(e) => {
                    setSupervisor(e.target.value);
                    clear("supervisor");
                  }}
                />
              </Field>

              <Field label="Position" htmlFor="dep-pos">
                <Input
                  id="dep-pos"
                  maxLength={255}
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                />
              </Field>

              <Field
                label="Contact number"
                htmlFor="dep-contact"
                error={errors.contact}
              >
                <Input
                  id="dep-contact"
                  inputMode="tel"
                  aria-invalid={Boolean(errors.contact)}
                  value={contact}
                  onChange={(e) => {
                    setContact(e.target.value);
                    clear("contact");
                  }}
                />
              </Field>

              <Field label="Email" htmlFor="dep-email" error={errors.email}>
                <Input
                  id="dep-email"
                  type="email"
                  aria-invalid={Boolean(errors.email)}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clear("email");
                  }}
                />
              </Field>
            </div>
          </section>

          <section className="flex flex-col gap-4 border-t pt-5">
            <div>
              <h3 className="text-sm font-medium">Memorandum of Agreement</h3>
              <p className="text-xs text-muted-foreground">
                The period the agreement is valid.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="MOA start" htmlFor="dep-moa-start">
                <Input
                  id="dep-moa-start"
                  type="date"
                  value={moaStart}
                  onChange={(e) => setMoaStart(e.target.value)}
                />
              </Field>

              <Field
                label="MOA expiration"
                htmlFor="dep-moa-end"
                error={errors.moaEnd}
              >
                <Input
                  id="dep-moa-end"
                  type="date"
                  min={moaStart || undefined}
                  value={moaEnd}
                  onChange={(e) => {
                    setMoaEnd(e.target.value);
                    clear("moaEnd");
                  }}
                />
              </Field>
            </div>
          </section>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

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
                : department
                  ? "Save changes"
                  : "Add department"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
