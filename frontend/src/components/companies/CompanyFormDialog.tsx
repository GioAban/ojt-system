import { useRef, useState, type FormEvent } from "react";
import { ChevronDown, Info, Loader2, Plus, Trash2 } from "lucide-react";
import api from "@/lib/api";
import {
  CONTACT_HINT, CONTACT_MAX, NATURE_OTHER_LABEL, NATURE_OTHER_MAX, cleanSupervisorText, contactError,
  isOtherNature, natureOtherError, validateSupervisor, validateSupervisorRequired,
  type SupervisorErrors, type SupervisorValue,
} from "@/lib/company";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { CompanyItem, DepartmentItem, NatureItem } from "@/types/company";
import { Field } from "@/components/companies/parts";
import { SupervisorFields } from "@/components/companies/SupervisorFields";
import { SkillsInput } from "@/components/skills/SkillsInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
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

/** Isang department sa form; id = null kapag bago pa */
interface DeptRow {
  key: string;
  id: number | null;
  name: string;
  slots: string;
  /** Ilang student ang nakalagay na (hindi maaalis kapag may laman) */
  filled: number;
  supervisorOpen: boolean;
  supervisor: SupervisorValue;
}

const isPlaceholder = (name: string | null) => !name || !name.trim() || name.trim().toUpperCase() === "N/A";
const isRealDepartment = (d: DepartmentItem) => !d.archived && !isPlaceholder(d.name) && d.status === "APPROVED";
const newKey = () => Math.random().toString(36).slice(2, 10);
const SLOTS_ERROR = "Slots must be a number from 1 to 500.";
const validSlots = (v: string) => /^\d+$/.test(v.trim()) && Number(v) >= 1 && Number(v) <= 500;

function rowFrom(d: DepartmentItem): DeptRow {
  return {
    key: newKey(), id: d.id, name: d.name ?? "", slots: String(d.slots || 1), filled: d.filled, supervisorOpen: false,
    supervisor: {
      name: cleanSupervisorText(d.supervisorFullname),
      position: cleanSupervisorText(d.supervisorPosition),
      contact: cleanSupervisorText(d.supervisorContactNumber),
      email: cleanSupervisorText(d.supervisorEmail),
    },
  };
}

const blankRow = (): DeptRow => ({
  key: newKey(), id: null, name: "", slots: "1", filled: 0, supervisorOpen: false,
  supervisor: { name: "", position: "", contact: "", email: "" },
});

/** Mga field ng supervisor sa error ng server: supervisorName -> name, atbp. */
const SUP_FIELDS: Record<keyof SupervisorValue, string> = {
  name: "Name", position: "Position", contact: "ContactNumber", email: "Email",
};
const supErrorsAt = (errors: Record<string, string>, prefix: string): SupervisorErrors => ({
  name: errors[`${prefix}Name`],
  position: errors[`${prefix}Position`],
  contact: errors[`${prefix}ContactNumber`],
  email: errors[`${prefix}Email`],
});

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-base font-semibold">{title}</h3>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Pagdagdag at pag-edit ng company (host training establishment): mga detalye, ang immediate supervisor
 * (kailangan), at ang mga department (Wala = N/A; Mayroon = listahan, bawat isa may opsyonal na supervisor).
 */
export function CompanyFormDialog({
  open, onOpenChange, company, natures, semesterId, semesterName, onSaved,
}: CompanyFormDialogProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState(company?.name ?? "");
  const [natureId, setNatureId] = useState(company?.natureId ? String(company.natureId) : "");
  const [address, setAddress] = useState(company?.address ?? "");
  const [location, setLocation] = useState(company?.location ?? "");
  const [contactNumber, setContactNumber] = useState(company?.contactNumber ?? "");
  // "Other": kailangan ang paliwanag (nakalagay na kapag ine-edit)
  const [natureOther, setNatureOther] = useState(company?.natureOther ?? "");
  const otherNature = isOtherNature(natures, natureId);
  const [skills, setSkills] = useState<string[]>(company?.skills ?? []);
  // Immediate supervisor: kailangan sa bawat company. Blangko ang lumang "N/A" para makita kung ano ang kulang.
  const [supervisor, setSupervisor] = useState<SupervisorValue>({
    name: cleanSupervisorText(company?.supervisorName),
    position: cleanSupervisorText(company?.supervisorPosition),
    contact: cleanSupervisorText(company?.supervisorContactNumber),
    email: cleanSupervisorText(company?.supervisorEmail),
  });

  // Departments: "Does this company have departments?"
  const departments = company?.departments ?? [];
  const realDepartments = departments.filter(isRealDepartment);
  const placeholder = departments.find((d) => isPlaceholder(d.name) && !d.archived) ?? null;
  const [hasDepartments, setHasDepartments] = useState(realDepartments.length > 0);
  const [rows, setRows] = useState<DeptRow[]>(() =>
    realDepartments.length > 0 ? realDepartments.map(rowFrom) : [blankRow()]);
  const [naSlots, setNaSlots] = useState(String(placeholder?.slots || 1));
  const naFilled = placeholder?.filled ?? 0;

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const clear = (...keys: string[]) =>
    setErrors((prev) => {
      if (!keys.some((k) => k in prev)) return prev;
      const next = { ...prev };
      keys.forEach((k) => delete next[k]);
      return next;
    });

  const setRow = (key: string, change: Partial<DeptRow>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...change } : r)));

  // Mga department na may student pa: hindi pwedeng piliin ang "No" hangga't hindi nailipat
  const withStudents = realDepartments.filter((d) => d.filled > 0);
  const placedText = (list: DepartmentItem[]) => list.map((d) => `${d.name} (${d.filled})`).join(", ");

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Enter the company name.";
    if (!natureId) e.natureId = "Select the nature of the company.";
    if (!address.trim()) e.address = "Enter the company address.";
    const contactProblem = contactError(contactNumber, true);
    if (contactProblem) e.contactNumber = contactProblem;
    const otherProblem = natureOtherError(otherNature, natureOther);
    if (otherProblem) e.natureOther = otherProblem;

    const sup = validateSupervisorRequired(supervisor);
    (Object.keys(SUP_FIELDS) as (keyof SupervisorValue)[]).forEach((k) => {
      if (sup[k]) e[`supervisor${SUP_FIELDS[k]}`] = sup[k] as string;
    });

    if (hasDepartments) {
      if (rows.length === 0) e.departments = "Add at least one department, or choose No.";
      const seen = new Set<string>();
      rows.forEach((r, i) => {
        const at = `departments[${i}].`;
        const n = r.name.trim();
        if (!n) e[`${at}name`] = "Enter the department name.";
        else if (isPlaceholder(n)) e[`${at}name`] = "N/A is used when the company has no departments. Choose No instead.";
        else if (seen.has(n.toLowerCase())) e[`${at}name`] = "This department is already in the list.";
        else seen.add(n.toLowerCase());
        if (!validSlots(r.slots)) e[`${at}slots`] = SLOTS_ERROR;
        else if (Number(r.slots) < r.filled) e[`${at}slots`] = `${r.filled} student(s) are placed here, so slots can't be lower than that.`;
        const ds = validateSupervisor(r.supervisor);
        (Object.keys(SUP_FIELDS) as (keyof SupervisorValue)[]).forEach((k) => {
          if (ds[k]) e[`${at}supervisor${SUP_FIELDS[k]}`] = ds[k] as string;
        });
      });
    } else {
      if (!validSlots(naSlots)) e.naSlots = SLOTS_ERROR;
      else if (Number(naSlots) < naFilled) e.naSlots = `${naFilled} student(s) are placed under N/A, so slots can't be lower than that.`;
      if (withStudents.length > 0) e.hasDepartments = `Reassign the students in ${placedText(withStudents)} first, then choose No.`;
    }
    return e;
  }

  /** Pagkatapos ng nabigong pag-save: i-scroll at i-focus ang unang may error (walang nawawalang laman) */
  function focusFirstError() {
    window.requestAnimationFrame(() => {
      const el = bodyRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-error]');
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.focus({ preventScroll: true });
    });
  }

  /** Binubuksan ang supervisor ng department na may error para makita ito */
  function openRowsWithErrors(found: Record<string, string>) {
    setRows((list) => list.map((r, i) => (Object.keys(found).some((k) => k.startsWith(`departments[${i}].supervisor`))
      ? { ...r, supervisorOpen: true } : r)));
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setFormError("");
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      openRowsWithErrors(found);
      focusFirstError();
      return;
    }

    setSaving(true);
    const payload = {
      semesterId,
      name: name.trim(),
      natureId: Number(natureId),
      natureOther: otherNature ? natureOther.trim() : null,
      address: address.trim(),
      location: location.trim(),
      contactNumber: contactNumber.trim(),
      supervisorName: supervisor.name.trim(),
      supervisorPosition: supervisor.position.trim(),
      supervisorContactNumber: supervisor.contact.trim(),
      supervisorEmail: supervisor.email.trim(),
      // Ibinabalik ang mga hindi ine-edit dito para hindi mabura sa pag-save
      description: company?.description ?? null,
      idType: company?.idType ?? null,
      idNumber: company?.idNumber ?? null,
      skills,
      hasDepartments,
      naSlots: hasDepartments ? null : Number(naSlots),
      departments: hasDepartments
        ? rows.map((r) => ({
            id: r.id,
            name: r.name.trim(),
            slots: Number(r.slots),
            supervisorFullname: r.supervisor.name.trim(),
            supervisorPosition: r.supervisor.position.trim(),
            supervisorContactNumber: r.supervisor.contact.trim(),
            supervisorEmail: r.supervisor.email.trim(),
          }))
        : [],
    };

    try {
      const res = company
        ? await api.put<{ id: number; naStudents: number }>(`/coordinator/companies/${company.id}`, payload)
        : await api.post<{ id: number; naStudents: number }>("/coordinator/companies", payload);
      const stay = res.data?.naStudents ?? 0;
      onSaved(`${payload.name} was ${company ? "updated" : "added"}.`
        + (stay > 0 ? ` ${stay} ${stay === 1 ? "student stays" : "students stay"} on N/A until you reassign them.` : ""));
      onOpenChange(false);
    } catch (err) {
      const fields = getFieldErrors(err);
      if (Object.keys(fields).length > 0) {
        setErrors(fields);
        openRowsWithErrors(fields);
        focusFirstError();
      } else {
        setFormError(getErrorMessage(err, "Failed to save the company."));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent size="3xl">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <DialogHeader>
            <DialogTitle>{company ? "Edit company" : "Add company"}</DialogTitle>
            <DialogDescription>
              {company ? "Update the company's details." : `A new host training establishment for ${semesterName}.`}
              {" "}Fields marked <span className="text-destructive">*</span> are required.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-8" ref={bodyRef}>
            {/* ---- Company details ---- */}
            <section className="flex flex-col gap-4">
              <SectionTitle title="Company details" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Company name" htmlFor="co-name" required error={errors.name} className="sm:col-span-2">
                  <Input id="co-name" maxLength={255} aria-invalid={Boolean(errors.name)} value={name} autoFocus
                    onChange={(e) => { setName(e.target.value); clear("name"); }} />
                </Field>
                <div className="flex flex-col gap-3">
                  <Field label="Nature" htmlFor="co-nature" required error={errors.natureId}>
                    <NativeSelect id="co-nature" className="w-full" aria-invalid={Boolean(errors.natureId)} value={natureId}
                      onChange={(e) => { setNatureId(e.target.value); clear("natureId", "natureOther"); }}>
                      <NativeSelectOption value="">Select the nature</NativeSelectOption>
                      {natures.map((n) => <NativeSelectOption key={n.id} value={String(n.id)}>{n.name}</NativeSelectOption>)}
                    </NativeSelect>
                  </Field>
                  {otherNature && (
                    <Field label={NATURE_OTHER_LABEL} htmlFor="co-nature-other" required error={errors.natureOther}>
                      <Input id="co-nature-other" maxLength={NATURE_OTHER_MAX} aria-invalid={Boolean(errors.natureOther)}
                        value={natureOther} placeholder="e.g. Hospitality"
                        onChange={(e) => { setNatureOther(e.target.value); clear("natureOther"); }} />
                    </Field>
                  )}
                </div>
                <Field label="Contact number" htmlFor="co-contact" required error={errors.contactNumber} hint={CONTACT_HINT}>
                  <Input id="co-contact" maxLength={CONTACT_MAX} aria-invalid={Boolean(errors.contactNumber)} value={contactNumber}
                    onChange={(e) => { setContactNumber(e.target.value); clear("contactNumber"); }} />
                </Field>
                <Field label="Address" htmlFor="co-address" required error={errors.address} className="sm:col-span-2">
                  <Input id="co-address" maxLength={255} aria-invalid={Boolean(errors.address)} value={address}
                    onChange={(e) => { setAddress(e.target.value); clear("address"); }} />
                </Field>
                <Field label="Location or landmark" htmlFor="co-location" error={errors.location} className="sm:col-span-2">
                  <Input id="co-location" maxLength={255} value={location} onChange={(e) => setLocation(e.target.value)} />
                </Field>
                <Field label="Skills needed" htmlFor="co-skills" error={errors.skills} className="sm:col-span-2"
                  hint="Used to suggest this company to students. Press Enter or a comma after each skill.">
                  <div data-error={errors.skills ? "" : undefined}>
                    <SkillsInput id="co-skills" value={skills} invalid={Boolean(errors.skills)}
                      searchUrl="/coordinator/skills/search" placeholder="e.g. Excel, Customer service"
                      onChange={(next) => { setSkills(next); clear("skills"); }} />
                  </div>
                </Field>
              </div>
            </section>

            {/* ---- Immediate supervisor (kailangan) ---- */}
            <section className="flex flex-col gap-4 border-t pt-6">
              <SupervisorFields
                idPrefix="co-sup"
                title="Immediate supervisor"
                description="Used for students whose department has no supervisor."
                value={supervisor}
                errors={supErrorsAt(errors, "supervisor")}
                required
                bare
                onChange={(key, v) => {
                  setSupervisor((prev) => ({ ...prev, [key]: v }));
                  clear(`supervisor${SUP_FIELDS[key]}`);
                }}
              />
            </section>

            {/* ---- Departments ---- */}
            <section className="flex flex-col gap-4 border-t pt-6">
              <SectionTitle title="Departments" />
              <div className="flex flex-col gap-2">
                <p id="co-has-dept-label" className="text-sm font-medium">Does this company have departments?</p>
                <div
                  role="radiogroup"
                  aria-labelledby="co-has-dept-label"
                  className="inline-flex w-full overflow-hidden rounded-lg border sm:w-auto"
                  data-error={errors.hasDepartments ? "" : undefined}
                  tabIndex={errors.hasDepartments ? -1 : undefined}
                >
                  {[{ v: false, label: "No" }, { v: true, label: "Yes" }].map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      role="radio"
                      aria-checked={hasDepartments === o.v}
                      onClick={() => {
                        setHasDepartments(o.v);
                        clear("hasDepartments", "departments", "naSlots");
                        if (o.v && rows.length === 0) setRows([blankRow()]);
                      }}
                      className={cn(
                        "min-h-10 flex-1 px-6 text-sm font-medium transition-colors pointer-coarse:min-h-12 sm:flex-none",
                        hasDepartments === o.v ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {errors.hasDepartments && <p className="text-sm text-destructive">{errors.hasDepartments}</p>}
              </div>

              {!hasDepartments ? (
                <div className="flex flex-col gap-4">
                  <p className="inline-flex items-start gap-2 text-sm text-muted-foreground">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" /> Students will be placed under N/A.
                  </p>
                  {withStudents.length > 0 && !errors.hasDepartments && (
                    <Alert>
                      <AlertDescription>Reassign the students in {placedText(withStudents)} before choosing No.</AlertDescription>
                    </Alert>
                  )}
                  <Field label="Slots" htmlFor="co-na-slots" required error={errors.naSlots}
                    hint={naFilled > 0 ? `${naFilled} placed under N/A` : "How many students this company can take (1 to 500)"}
                    className="sm:max-w-xs">
                    <Input id="co-na-slots" inputMode="numeric" aria-invalid={Boolean(errors.naSlots)} value={naSlots}
                      onChange={(e) => { setNaSlots(e.target.value.replace(/\D/g, "")); clear("naSlots"); }} />
                  </Field>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {naFilled > 0 && (
                    <Alert>
                      <AlertDescription>
                        {naFilled} {naFilled === 1 ? "student is" : "students are"} placed under N/A. They stay on N/A until you reassign them.
                      </AlertDescription>
                    </Alert>
                  )}
                  {rows.map((r, i) => {
                    const at = `departments[${i}].`;
                    const supErr = supErrorsAt(errors, `${at}supervisor`);
                    const supHasError = Object.values(supErr).some(Boolean);
                    return (
                      <fieldset key={r.key} className="flex flex-col gap-3 rounded-lg border p-3 sm:p-4">
                        <legend className="px-1 text-xs font-medium text-muted-foreground">Department {i + 1}</legend>
                        <div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-start">
                          <Field label="Department name" htmlFor={`dep-${r.key}-name`} required error={errors[`${at}name`]}>
                            <Input id={`dep-${r.key}-name`} maxLength={255} aria-invalid={Boolean(errors[`${at}name`])} value={r.name}
                              placeholder="e.g. MIS Office"
                              onChange={(e) => { setRow(r.key, { name: e.target.value }); clear(`${at}name`); }} />
                          </Field>
                          <Field label="Slots" htmlFor={`dep-${r.key}-slots`} required error={errors[`${at}slots`]}
                            hint={r.filled > 0 ? `${r.filled} placed` : undefined}>
                            <Input id={`dep-${r.key}-slots`} inputMode="numeric" aria-invalid={Boolean(errors[`${at}slots`])} value={r.slots}
                              onChange={(e) => { setRow(r.key, { slots: e.target.value.replace(/\D/g, "") }); clear(`${at}slots`); }} />
                          </Field>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive sm:mt-6 pointer-coarse:size-11"
                            aria-label={`Remove department ${i + 1}`}
                            title={r.filled > 0 ? `${r.filled} student(s) are placed here. Reassign them first.` : "Remove this department"}
                            disabled={r.filled > 0 || rows.length === 1}
                            onClick={() => { setRows((list) => list.filter((x) => x.key !== r.key)); setErrors({}); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <button
                          type="button"
                          aria-expanded={r.supervisorOpen}
                          onClick={() => setRow(r.key, { supervisorOpen: !r.supervisorOpen })}
                          className={cn(
                            "inline-flex items-center gap-1.5 self-start text-sm text-primary hover:underline pointer-coarse:min-h-11",
                            supHasError && "text-destructive",
                          )}
                        >
                          <ChevronDown className={cn("h-4 w-4 transition-transform", r.supervisorOpen && "rotate-180")} />
                          Department supervisor (optional)
                          {r.supervisor.name.trim() && !r.supervisorOpen && <span className="text-muted-foreground">· {r.supervisor.name}</span>}
                        </button>
                        {r.supervisorOpen && (
                          <SupervisorFields
                            idPrefix={`dep-${r.key}-sup`}
                            title="Department supervisor"
                            description="Leave it blank to use the company's immediate supervisor. If you enter a name, also enter the position."
                            value={r.supervisor}
                            errors={supErr}
                            bare
                            onChange={(key, v) => {
                              setRow(r.key, { supervisor: { ...r.supervisor, [key]: v } });
                              clear(`${at}supervisor${SUP_FIELDS[key]}`, ...(key === "name" || key === "position"
                                ? [`${at}supervisorName`, `${at}supervisorPosition`] : []));
                            }}
                          />
                        )}
                      </fieldset>
                    );
                  })}
                  {errors.departments && <p className="text-sm text-destructive" data-error="" tabIndex={-1}>{errors.departments}</p>}
                  <Button type="button" variant="outline" className="self-start pointer-coarse:h-11"
                    onClick={() => { setRows((list) => [...list, blankRow()]); clear("departments"); }}>
                    <Plus className="h-4 w-4" /> Add department
                  </Button>
                </div>
              )}
            </section>

            {formError && (
              <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving..." : company ? "Save changes" : "Add company"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
