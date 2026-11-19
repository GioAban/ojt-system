import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Info, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { notify } from "@/lib/notify";
import {
  CONTACT_HINT, CONTACT_MAX, EMPTY_SUPERVISOR, contactError, hasSupervisor, validateSupervisor, validateSupervisorRequired,
  type SupervisorErrors, type SupervisorValue,
} from "@/lib/company";
import { cn } from "@/lib/utils";
import { Field } from "@/components/companies/parts";
import { SupervisorFields } from "@/components/companies/SupervisorFields";
import type { CheckResult, MatchCompany } from "@/types/companyApplications";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pwedeng may naka-prefill na company (galing sa listahan) */
  presetCompany?: { id: number; name: string } | null;
  onSent: () => void;
}

const EMPTY = { companyName: "", address: "", contactNumber: "", location: "", departmentName: "" };

/** Mga field ng supervisor sa error ng server */
const SUP_FIELDS: Record<keyof SupervisorValue, string> = {
  name: "supervisorName", position: "supervisorPosition", contact: "supervisorContactNumber", email: "supervisorEmail",
};

/**
 * Hiling ng student na bagong company (o bagong department sa dati nang company). Parehong ayos ng company form:
 * mga section, kailangan ang immediate supervisor sa bagong company, mga error sa ilalim ng bawat field.
 */
export function RequestCompanyDialog({ open, onOpenChange, presetCompany, onSent }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState(EMPTY);
  const [existing, setExisting] = useState<{ id: number; name: string } | null>(null);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [different, setDifferent] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasDepartments, setHasDepartments] = useState(false);
  // Bagong company: ang immediate supervisor (kailangan). Dati nang company: supervisor ng department (opsyonal).
  const [supervisor, setSupervisor] = useState<SupervisorValue>(EMPTY_SUPERVISOR);
  const [permission, setPermission] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setSupervisor(EMPTY_SUPERVISOR);
    setPermission(false);
    setHasDepartments(false);
    setErrors({});
    setCheck(null);
    setDifferent(false);
    setExisting(presetCompany ?? null);
  }, [open, presetCompany]);

  const newCompany = existing === null;
  const needsDepartmentName = !newCompany || hasDepartments;

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    clear(key);
  }
  const clear = (...keys: string[]) =>
    setErrors((prev) => {
      if (!keys.some((k) => k in prev)) return prev;
      const next = { ...prev };
      keys.forEach((k) => delete next[k]);
      return next;
    });

  // Tingnan kung may kapareho na bago magpadala (naghihintay ng saglit habang nagta-type)
  useEffect(() => {
    if (!open) return;
    const name = existing ? existing.name : form.companyName.trim();
    if (name.length < 3) {
      setCheck(null);
      return;
    }
    const id = window.setTimeout(() => {
      api
        .post<CheckResult>("/student/company/check", {
          companyName: name,
          departmentName: needsDepartmentName ? form.departmentName.trim() : "N/A",
        })
        .then((res) => setCheck(res.data))
        .catch(() => setCheck(null));
    }, 400);
    return () => window.clearTimeout(id);
  }, [open, existing, form.companyName, form.departmentName, needsDepartmentName]);

  const matches: MatchCompany[] = existing
    ? (check?.matches ?? []).filter((m) => m.companyId === existing.id)
    : (check?.matches ?? []);
  const sameDept = matches.some((m) => m.sameDepartment);
  const similarCompany = !existing && matches.length > 0;
  const blocked = sameDept || (similarCompany && !different);
  // Bagong company: laging may supervisor kaya laging kailangan ang pahintulot; dati nang company: kapag may inilagay
  const askPermission = newCompany || hasSupervisor(supervisor);

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (newCompany) {
      if (!form.companyName.trim()) e.companyName = "Enter the company name.";
      if (!form.address.trim()) e.address = "Enter the company address.";
      const contactProblem = contactError(form.contactNumber, true, "Enter the company contact number.");
      if (contactProblem) e.contactNumber = contactProblem;
    }
    if (needsDepartmentName && !form.departmentName.trim()) e.departmentName = "Enter the department name.";
    const sup: SupervisorErrors = newCompany ? validateSupervisorRequired(supervisor) : validateSupervisor(supervisor);
    (Object.keys(SUP_FIELDS) as (keyof SupervisorValue)[]).forEach((k) => {
      if (sup[k]) e[SUP_FIELDS[k]] = sup[k] as string;
    });
    if (askPermission && !permission) e.supervisorPermission = "Confirm that you have the supervisor's permission to share these contact details.";
    return e;
  }

  function focusFirstError() {
    window.requestAnimationFrame(() => {
      const el = bodyRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.focus({ preventScroll: true });
    });
  }

  async function submit() {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstError();
      return;
    }
    setSending(true);
    try {
      await api.post("/student/company/requests", {
        existingCompanyId: existing?.id ?? null,
        ...form,
        departmentName: needsDepartmentName ? form.departmentName.trim() : "",
        hasDepartments: newCompany ? hasDepartments : true,
        supervisorFullname: supervisor.name.trim(),
        supervisorPosition: supervisor.position.trim(),
        supervisorEmail: supervisor.email.trim(),
        supervisorContactNumber: supervisor.contact.trim(),
        supervisorPermission: askPermission ? permission : false,
        confirmDifferent: different,
      });
      notify.success("Request sent. Your coordinator will review it.");
      onOpenChange(false);
      onSent();
    } catch (err) {
      const fields = getFieldErrors(err);
      if (Object.keys(fields).length > 0) {
        setErrors(fields);
        focusFirstError();
      } else {
        notify.error(getErrorMessage(err, "Couldn't send your request."));
      }
    } finally {
      setSending(false);
    }
  }

  const supErrors: SupervisorErrors = {
    name: errors.supervisorName, position: errors.supervisorPosition,
    contact: errors.supervisorContactNumber, email: errors.supervisorEmail,
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!sending) onOpenChange(o); }}>
      <DialogContent size="2xl">
        <DialogHeader>
          <DialogTitle>Request a company or department</DialogTitle>
          <DialogDescription>
            Can't find it in the list? Send the details to your coordinator. They'll review it before it shows up for
            everyone. Fields marked <span className="text-destructive">*</span> are required.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-6" ref={bodyRef}>
          {/* ---- Company details ---- */}
          <section className="flex flex-col gap-4">
            <h3 className="text-base font-semibold">Company details</h3>
            {existing ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <span>Company: <strong>{existing.name}</strong></span>
                {!presetCompany && (
                  <button type="button" className="text-xs text-primary underline pointer-coarse:min-h-11" onClick={() => setExisting(null)}>
                    Change
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Company name" htmlFor="req-name" required error={errors.companyName} className="sm:col-span-2">
                  <Input id="req-name" value={form.companyName} maxLength={255} aria-invalid={Boolean(errors.companyName)}
                    onChange={(e) => set("companyName", e.target.value)} />
                </Field>
                <Field label="Address" htmlFor="req-address" required error={errors.address} className="sm:col-span-2">
                  <Input id="req-address" value={form.address} maxLength={255} aria-invalid={Boolean(errors.address)}
                    onChange={(e) => set("address", e.target.value)} />
                </Field>
                <Field label="Company contact number" htmlFor="req-contact" required error={errors.contactNumber} hint={CONTACT_HINT}>
                  <Input id="req-contact" value={form.contactNumber} maxLength={CONTACT_MAX} aria-invalid={Boolean(errors.contactNumber)}
                    onChange={(e) => set("contactNumber", e.target.value)} />
                </Field>
                <Field label="Location or landmark" htmlFor="req-location">
                  <Input id="req-location" value={form.location} maxLength={255} onChange={(e) => set("location", e.target.value)} />
                </Field>
              </div>
            )}
          </section>

          {/* ---- Department ---- */}
          <section className="flex flex-col gap-4 border-t pt-5">
            <h3 className="text-base font-semibold">Department</h3>
            {newCompany && (
              <div className="flex flex-col gap-2">
                <p id="req-has-dept" className="text-sm font-medium">Does this company have departments?</p>
                <div role="radiogroup" aria-labelledby="req-has-dept" className="inline-flex w-full overflow-hidden rounded-lg border sm:w-auto">
                  {[{ v: false, label: "No" }, { v: true, label: "Yes" }].map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      role="radio"
                      aria-checked={hasDepartments === o.v}
                      onClick={() => { setHasDepartments(o.v); clear("departmentName"); }}
                      className={cn(
                        "min-h-10 flex-1 px-6 text-sm font-medium transition-colors pointer-coarse:min-h-12 sm:flex-none",
                        hasDepartments === o.v ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {needsDepartmentName ? (
              <Field label={newCompany ? "Your department" : "Department you're requesting"} htmlFor="req-dept" required
                error={errors.departmentName} className="sm:max-w-md">
                <Input id="req-dept" value={form.departmentName} maxLength={255} placeholder="e.g. MIS Office"
                  aria-invalid={Boolean(errors.departmentName)} onChange={(e) => set("departmentName", e.target.value)} />
              </Field>
            ) : (
              <p className="inline-flex items-start gap-2 text-sm text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0" /> You'll be placed under N/A.
              </p>
            )}
          </section>

          {/* ---- Supervisor ---- */}
          <section className="flex flex-col gap-4 border-t pt-5">
            <SupervisorFields
              idPrefix="req-sup"
              title={newCompany ? "Immediate supervisor" : "Department supervisor (optional)"}
              description={newCompany
                ? "Used for students whose department has no supervisor."
                : "Who will supervise you in this department, if you know. If you enter a name, also enter the position."}
              value={supervisor}
              errors={supErrors}
              required={newCompany}
              bare
              onChange={(key, v) => {
                setSupervisor((prev) => ({ ...prev, [key]: v }));
                clear(SUP_FIELDS[key], ...(key === "name" || key === "position" ? ["supervisorName", "supervisorPosition"] : []));
              }}
            />
            {askPermission && (
              <div className="flex flex-col gap-1">
                <label className={cn(
                  "flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm",
                  errors.supervisorPermission && "border-destructive",
                )}>
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 pointer-coarse:size-5"
                    checked={permission}
                    aria-invalid={Boolean(errors.supervisorPermission)}
                    onChange={(e) => { setPermission(e.target.checked); clear("supervisorPermission"); }}
                  />
                  <span>
                    I have the supervisor&apos;s permission to share these contact details. <span className="text-destructive">*</span>
                  </span>
                </label>
                {errors.supervisorPermission && <p className="text-xs text-destructive">{errors.supervisorPermission}</p>}
              </div>
            )}
          </section>

          {matches.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {sameDept
                  ? "This department already exists."
                  : existing
                    ? "Check the existing departments first."
                    : "A company with a similar name is already there."}
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {matches.map((m) => (
                  <li key={m.companyId} className="rounded-md bg-background/60 p-2">
                    <p className="font-medium">
                      {m.name}
                      {!m.listed && <span className="ml-2 text-xs font-normal">(waiting for review)</span>}
                    </p>
                    <p className="text-xs opacity-80">{m.address}</p>
                    {m.departments.length > 0 && (
                      <p className="mt-1 text-xs">
                        Departments:{" "}
                        {m.departments.map((d) => (d.status === "pending" ? `${d.name} (pending)` : d.name)).join(", ")}
                      </p>
                    )}
                    {!existing && (
                      <button
                        type="button"
                        className="mt-1 text-xs font-medium underline pointer-coarse:min-h-11"
                        onClick={() => setExisting({ id: m.companyId, name: m.name })}
                      >
                        It's this company — request a department here
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {sameDept && (
                <p className="mt-2 text-xs">Pick it from the Companies list and apply, or wait for the coordinator if it's still pending.</p>
              )}
              {similarCompany && !sameDept && (
                <label className="mt-2 flex items-start gap-2 text-xs pointer-coarse:min-h-11">
                  <input type="checkbox" className="mt-0.5" checked={different} onChange={(e) => setDifferent(e.target.checked)} />
                  <span>This is a different company. I checked the list above.</span>
                </label>
              )}
            </div>
          )}

          {Object.keys(errors).length > 0 && (
            <Alert variant="destructive"><AlertDescription>Please fix the fields marked in red.</AlertDescription></Alert>
          )}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={sending} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={blocked || sending} onClick={() => void submit()}>
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
            {sending ? "Sending..." : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
