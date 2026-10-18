import { useState, type FormEvent } from "react";
import api from "@/lib/api";
import { PHONE_PATTERN } from "@/lib/company";
import { getErrorMessage } from "@/lib/errors";
import type { CompanyItem, NatureItem } from "@/types/company";
import { Field } from "@/components/companies/parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface CompanyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: CompanyItem | null; // null = add
  natures: NatureItem[];
  semesterId: number;
  semesterName: string;
  onSaved: (message: string) => void;
}

export function CompanyFormDialog({
  open,
  onOpenChange,
  company,
  natures,
  semesterId,
  semesterName,
  onSaved,
}: CompanyFormDialogProps) {
  const [name, setName] = useState(company?.name ?? "");
  const [natureId, setNatureId] = useState(
    company?.natureId ? String(company.natureId) : "",
  );
  const [address, setAddress] = useState(company?.address ?? "");
  const [location, setLocation] = useState(company?.location ?? "");
  const [contactNumber, setContactNumber] = useState(
    company?.contactNumber ?? "",
  );
  const [supervisorName, setSupervisorName] = useState(
    company?.supervisorName ?? "",
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

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

    if (!name.trim()) next.name = "Enter the company name.";
    if (!natureId) next.natureId = "Select the nature of the company.";
    if (!address.trim()) next.address = "Enter the company address.";
    if (!contactNumber.trim()) next.contactNumber = "Enter a contact number.";
    else if (!PHONE_PATTERN.test(contactNumber.trim())) {
      next.contactNumber =
        "Use digits, spaces, +, -, or parentheses (7 to 20 characters).";
    }

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
      semesterId,
      name: name.trim(),
      natureId: Number(natureId),
      address: address.trim(),
      location: location.trim(),
      contactNumber: contactNumber.trim(),
      supervisorName: supervisorName.trim(),
    };

    try {
      if (company) {
        await api.put(`/coordinator/companies/${company.id}`, payload);
        onSaved(`${payload.name} was updated.`);
      } else {
        await api.post("/coordinator/companies", payload);
        onSaved(`${payload.name} was added.`);
      }
      onOpenChange(false);
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to save the company."));
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
              {company ? "Edit company" : "Add company"}
            </DialogTitle>
            <DialogDescription>
              {company
                ? "Update the company's details."
                : `A new host training establishment for ${semesterName}. You can add its departments right after.`}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Company name"
              htmlFor="co-name"
              required
              error={errors.name}
              className="sm:col-span-2"
            >
              <Input
                id="co-name"
                maxLength={255}
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
              label="Nature"
              htmlFor="co-nature"
              required
              error={errors.natureId}
            >
              <NativeSelect
                id="co-nature"
                className="w-full"
                aria-invalid={Boolean(errors.natureId)}
                value={natureId}
                onChange={(e) => {
                  setNatureId(e.target.value);
                  clear("natureId");
                }}
              >
                <NativeSelectOption value="">
                  Select the nature
                </NativeSelectOption>
                {natures.map((n) => (
                  <NativeSelectOption key={n.id} value={String(n.id)}>
                    {n.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>

            <Field
              label="Contact number"
              htmlFor="co-contact"
              required
              error={errors.contactNumber}
            >
              <Input
                id="co-contact"
                inputMode="tel"
                aria-invalid={Boolean(errors.contactNumber)}
                value={contactNumber}
                onChange={(e) => {
                  setContactNumber(e.target.value);
                  clear("contactNumber");
                }}
              />
            </Field>

            <Field
              label="Address"
              htmlFor="co-address"
              required
              error={errors.address}
              className="sm:col-span-2"
            >
              <Input
                id="co-address"
                maxLength={255}
                aria-invalid={Boolean(errors.address)}
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  clear("address");
                }}
              />
            </Field>

            <Field
              label="Location or landmark"
              htmlFor="co-location"
              className="sm:col-span-2"
            >
              <Input
                id="co-location"
                maxLength={255}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </Field>

            <Field
              label="Contact person"
              htmlFor="co-sup"
              className="sm:col-span-2"
            >
              <Input
                id="co-sup"
                maxLength={255}
                value={supervisorName}
                onChange={(e) => setSupervisorName(e.target.value)}
              />
            </Field>
          </div>

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
              {saving ? "Saving..." : company ? "Save changes" : "Add company"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
