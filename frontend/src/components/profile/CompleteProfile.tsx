import { useState, type FormEvent, type ReactNode } from "react";
import { UserRoundCheck } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { validOptionalPhone } from "@/lib/students";
import { CONTACT_HINT, CONTACT_MAX } from "@/lib/company";
import type { StudentProfile } from "@/types/studentProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSafeLogout } from "@/hooks/useSafeLogout";
import { LogoutDialog } from "@/components/offline/LogoutDialog";

interface Form {
  contact: string;
  birthday: string;
  address: string;
  parent: string;
  guardian: string;
}

type Errors = Partial<Record<keyof Form, string>>;

/** yyyy-MM-dd ngayon (oras ng browser), pinakamataas na petsa ng birthday */
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Parehong pagsusuri ng Students page; ang server pa rin ang huling nagpapasya */
function validate(f: Form): Errors {
  const e: Errors = {};
  if (!f.contact.trim()) e.contact = "Contact number is required.";
  else {
    const phone = validOptionalPhone(f.contact);
    if (phone) e.contact = phone;
  }
  if (!f.birthday) e.birthday = "Birthday is required.";
  else if (f.birthday < "1950-01-01" || f.birthday > todayIso()) e.birthday = "Birthday is out of range.";
  if (!f.address.trim()) e.address = "Address is required.";
  if (!f.parent.trim()) e.parent = "Parent's name is required.";
  return e;
}

function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: keyof Form;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`cp-${id}`} className="text-sm font-medium">
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden="true"> *</span>
        ) : (
          <span className="font-normal text-muted-foreground"> (optional)</span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`cp-${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/**
 * Isang beses na "Complete your profile" ng student na nag-register sa link.
 * Hinaharangan nito ang app hanggang ma-save. Student lang; hindi ito ipinapakita sa staff.
 */
export function CompleteProfile({ profile, onDone }: { profile: StudentProfile; onDone: () => void }) {
  // Binubura ang datos ng user sa device; nagtatanong muna kapag may hindi pa naipapadala
  const logout = useSafeLogout();
  const d = profile.details;
  const [form, setForm] = useState<Form>({
    contact: d?.contact ?? "",
    birthday: d?.birthday ? d.birthday.slice(0, 10) : "",
    address: d?.address ?? "",
    parent: d?.parent ?? "",
    guardian: d?.guardian ?? "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(key: keyof Form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function focusFirst(found: Errors) {
    const first = Object.keys(found)[0];
    if (first) document.getElementById(`cp-${first}`)?.focus();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirst(found);
      return;
    }
    setSaving(true);
    try {
      await api.put("/student/profile/complete", form);
      onDone();
    } catch (err) {
      // Nananatili ang tinype; ipinapakita lang ang mali
      const fields = getFieldErrors(err) as Errors;
      setErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err, "Couldn't save your profile. Please try again."));
      focusFirst(fields);
    } finally {
      setSaving(false);
    }
  }

  const describe = (k: keyof Form) => (errors[k] ? { "aria-invalid": true, "aria-describedby": `cp-${k}-error` } : {});
  const name = `${profile.firstname}${d?.middleInitial ? ` ${d.middleInitial}.` : ""} ${profile.lastname}`;
  const summary: [string, string | null | undefined][] = [
    ["Student ID", profile.studentNumber],
    ["Course", d?.course],
    ["Year", d?.year],
    ["Email", profile.email],
  ];

  return (
    <main className="min-h-dvh bg-muted/30">
      <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-6 sm:pb-10 sm:pt-10">
        <form noValidate onSubmit={submit} className="flex flex-col gap-5 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <UserRoundCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Complete your profile</h1>
              <p className="text-sm text-muted-foreground">
                Welcome, {profile.firstname}! Your coordinator verified your account. Fill this in once to start using the
                system. Fields with <span className="text-destructive">*</span> are required.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-muted/50 p-3 text-sm">
            <p className="font-semibold">{name}</p>
            <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {summary.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="truncate font-medium">{value || "—"}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">Something wrong here? Ask your coordinator to fix it.</p>
          </div>

          <Field id="contact" label="Contact number" required hint={`Example: 0917 123 4567. ${CONTACT_HINT}`} error={errors.contact}>
            <Input
              id="cp-contact"
              autoComplete="tel"
              maxLength={CONTACT_MAX}
              value={form.contact}
              onChange={(e) => set("contact", e.target.value)}
              {...describe("contact")}
            />
          </Field>

          <Field id="birthday" label="Birthday" required error={errors.birthday}>
            <Input
              id="cp-birthday"
              type="date"
              min="1950-01-01"
              max={todayIso()}
              autoComplete="bday"
              value={form.birthday}
              onChange={(e) => set("birthday", e.target.value)}
              {...describe("birthday")}
            />
          </Field>

          <Field id="address" label="Address" required hint="House no., street, barangay, town/city, province" error={errors.address}>
            <Textarea
              id="cp-address"
              rows={2}
              maxLength={255}
              autoComplete="street-address"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              {...describe("address")}
            />
          </Field>

          <Field id="parent" label="Parent's name" required error={errors.parent}>
            <Input
              id="cp-parent"
              maxLength={255}
              autoCapitalize="words"
              value={form.parent}
              onChange={(e) => set("parent", e.target.value)}
              {...describe("parent")}
            />
          </Field>

          <Field id="guardian" label="Guardian's name" hint="If someone other than your parent takes care of you." error={errors.guardian}>
            <Input
              id="cp-guardian"
              maxLength={255}
              autoCapitalize="words"
              value={form.guardian}
              onChange={(e) => set("guardian", e.target.value)}
              {...describe("guardian")}
            />
          </Field>

          {formError && (
            <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </p>
          )}

          <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 p-4 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
            <div className="mx-auto max-w-lg">
              <Button type="submit" size="lg" disabled={saving} className="w-full">
                {saving ? "Saving..." : "Save and continue"}
              </Button>
            </div>
          </div>

          <button type="button" onClick={logout.request} className="text-center text-sm text-muted-foreground underline underline-offset-2">
            Log out
          </button>
        </form>
        <LogoutDialog pending={logout.pending} busy={logout.busy} onConfirm={logout.confirm} onCancel={logout.cancel} />
      </div>
    </main>
  );
}
