import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Link2Off, Loader2, Plus, ShieldCheck } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { CONTACT_HINT, CONTACT_MAX, NATURE_OTHER_LABEL, NATURE_OTHER_MAX, contactError, isOtherNature, natureOtherError } from "@/lib/company";
import { cn } from "@/lib/utils";
import { emptyLinkDepartment, linkDepartmentPayload, type LinkDepartmentForm } from "@/types/companyRequest";
import { Field } from "@/components/companies/parts";
import { LinkDepartmentFields } from "@/components/companies/LinkDepartmentFields";
import { SkillsInput } from "@/components/skills/SkillsInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

type Phase = "checking" | "open" | "closed" | "expired" | "invalid" | "error" | "done";

interface Info {
  status: "open" | "closed" | "expired" | "invalid";
  dueDate?: string;
  college?: string;
  collegeAbbreviation?: string;
  program?: string;
  programAbbreviation?: string;
  semester?: string;
  coordinator?: string;
  privacyVersion?: string;
  natures?: { id: number; name: string }[];
}

const MAX_DEPARTMENTS = 15;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatDue(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function PortalDetails({ info }: { info: Info }) {
  const join = (a?: string, b?: string) => [a, b && a ? `(${b})` : b].filter(Boolean).join(" ");
  const college = join(info.college, info.collegeAbbreviation);
  const program = join(info.program, info.programAbbreviation);
  if (!college && !program && !info.semester && !info.coordinator) return null;
  return (
    <div className="rounded-xl border bg-muted/40 p-3 text-sm">
      {college && <p className="font-semibold leading-snug">{college}</p>}
      {program && <p className="leading-snug text-muted-foreground">{program}</p>}
      <p className="mt-1 text-xs text-muted-foreground">
        {[info.semester, info.coordinator && `OJT coordinator: ${info.coordinator}`].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t pt-5 first-of-type:border-t-0 first-of-type:pt-0">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Pampublikong page para sa company: walang account, may Data Privacy Notice at kailangang pumayag */
export default function CompanyRequestPublic() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [phase, setPhase] = useState<Phase>(token ? "checking" : "invalid");
  const [info, setInfo] = useState<Info | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [companyName, setCompanyName] = useState("");
  const [natureId, setNatureId] = useState("");
  const [natureOther, setNatureOther] = useState("");
  const otherNature = isOtherNature(info?.natures ?? [], natureId);
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState("");
  const [companyContactNumber, setCompanyContactNumber] = useState("");
  const [description, setDescription] = useState("");
  const [contactFullname, setContactFullname] = useState("");
  const [contactPosition, setContactPosition] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [hasDepartments, setHasDepartments] = useState(false);
  const [naDept, setNaDept] = useState<LinkDepartmentForm>(emptyLinkDepartment());
  const [departments, setDepartments] = useState<LinkDepartmentForm[]>([emptyLinkDepartment()]);
  const [skills, setSkills] = useState<string[]>([]);
  const [supervisorPermission, setSupervisorPermission] = useState(false);
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .get<Info>("/public/company-requests/info", { params: { token } })
      .then((res) => {
        if (cancelled) return;
        setInfo(res.data);
        setPhase(res.data.status);
      })
      .catch(() => !cancelled && setPhase("error"));
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  function clear(...keys: string[]) {
    setErrors((e) => {
      if (!keys.some((k) => e[k])) return e;
      const next = { ...e };
      keys.forEach((k) => delete next[k]);
      return next;
    });
  }

  /** Inaalis ang lahat ng error ng mga department (nagbabago ang index kapag may inalis) */
  function clearDepartmentErrors() {
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith("departments"))));
  }

  function patchDept(i: number, patch: Partial<LinkDepartmentForm>) {
    setDepartments((list) => list.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
    clear(...Object.keys(patch).map((k) => `departments[${i}].${k === "supervisorFullname" ? "supervisorName" : k}`));
  }

  function removeDept(i: number) {
    setDepartments((list) => list.filter((_, idx) => idx !== i));
    clearDepartmentErrors();
  }

  function addDept() {
    setDepartments((list) => [...list, emptyLinkDepartment()]);
    clear("departments");
  }

  /** Mabilis na pagsusuri sa phone; ang server pa rin ang huling nagpapasya */
  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!companyName.trim()) e.companyName = "Enter the company name.";
    if (!natureId) e.natureId = "Select the nature of the company.";
    const otherProblem = natureOtherError(otherNature, natureOther);
    if (otherProblem) e.natureOther = otherProblem;
    if (!address.trim()) e.address = "Enter the company address.";
    const companyContactProblem = contactError(companyContactNumber, true, "Enter the company contact number.");
    if (companyContactProblem) e.companyContactNumber = companyContactProblem;
    if (!contactFullname.trim()) e.contactName = "Enter the immediate supervisor's name.";
    if (!contactPosition.trim()) e.contactPosition = "Enter the immediate supervisor's position.";
    const contactProblem = contactError(contactNumber, true, "Enter the immediate supervisor's contact number.");
    if (contactProblem) e.contactContactNumber = contactProblem;
    if (!contactEmail.trim()) e.contactEmail = "Enter the immediate supervisor's email.";
    else if (!EMAIL_RE.test(contactEmail.trim())) e.contactEmail = "Enter a valid email address.";

    const rows = hasDepartments ? departments : [naDept];
    if (hasDepartments && rows.length === 0) e.departments = "Add at least one department, or choose No.";
    rows.forEach((d, i) => {
      const at = `departments[${i}].`;
      if (hasDepartments && !d.name.trim()) e[at + "name"] = "Enter the department name.";
      const n = Number(d.slots);
      if (!d.slots || n < 1 || n > 500) e[at + "slots"] = "Slots must be a number from 1 to 500.";
      const name = d.supervisorFullname.trim();
      const pos = d.supervisorPosition.trim();
      if (name && !pos) e[at + "supervisorPosition"] = "Enter the supervisor's position.";
      if (!name && pos) e[at + "supervisorName"] = "Enter the supervisor's name.";
      const supContactProblem = hasDepartments ? contactError(d.supervisorContactNumber) : null;
      if (supContactProblem) e[at + "supervisorContactNumber"] = supContactProblem;
      if (d.supervisorEmail.trim() && !EMAIL_RE.test(d.supervisorEmail.trim())) e[at + "supervisorEmail"] = "Enter a valid email address.";
    });
    if (!supervisorPermission) e.supervisorPermission = "Confirm that you have the supervisor's permission to share these contact details.";
    if (!consent) e.consent = "You need to agree to the Data Privacy Notice to continue.";
    return e;
  }

  function focusFirstError() {
    window.requestAnimationFrame(() => {
      const el = formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']");
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus({ preventScroll: true });
    });
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setFormError("");
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstError();
      return;
    }

    const rows = hasDepartments ? departments : [naDept];
    // Walang MOA o file mula sa company; ang coordinator ang nagtatala ng MOA
    const data = {
      token,
      companyName, natureId: Number(natureId), address, location, companyContactNumber, description,
      contactFullname, contactPosition, contactNumber, contactEmail,
      idType: "", idNumber: "",
      hasDepartments,
      departments: rows.map((d) => ({ ...linkDepartmentPayload(d), moaStart: null, moaExpiration: null })),
      skills,
      consent, supervisorPermission, website,
      natureOther: otherNature ? natureOther.trim() : null,
    };
    setSaving(true);
    try {
      await api.post("/public/company-requests/submit", data);
      setPhase("done");
      window.scrollTo({ top: 0 });
    } catch (err) {
      const fields = getFieldErrors(err);
      if (Object.keys(fields).length > 0) {
        setErrors(fields);
        focusFirstError();
      } else {
        setFormError(getErrorMessage(err, "Couldn't send your request. Please try again."));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-dvh bg-muted/30">
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6 sm:pb-10 sm:pt-10">
        <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
          OJT System · Host Training Establishment request
        </p>

        <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          {phase === "checking" && <p className="py-8 text-center text-sm text-muted-foreground">Checking the link...</p>}

          {phase === "error" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <h1 className="text-lg font-semibold">Can&apos;t reach the server</h1>
              <p className="text-sm text-muted-foreground">
                The link may be fine, but the page couldn&apos;t load. Check your connection and try again.
              </p>
              <Button className="w-full sm:w-auto" onClick={() => { setPhase("checking"); setAttempt((n) => n + 1); }}>
                Try again
              </Button>
            </div>
          )}

          {(phase === "invalid" || phase === "closed" || phase === "expired") && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="rounded-full bg-muted p-3 text-muted-foreground"><Link2Off className="h-6 w-6" /></div>
              <h1 className="text-lg font-semibold">
                {phase === "closed" ? "This form is closed" : phase === "expired" ? "This form has ended" : "Link not valid"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {phase === "invalid"
                  ? "This link isn't valid. Please ask the OJT coordinator for the correct link."
                  : phase === "expired" && info?.dueDate
                    ? `The last day was ${formatDue(info.dueDate)}. Please contact the OJT coordinator.`
                    : "Please contact the OJT coordinator."}
              </p>
            </div>
          )}

          {phase === "done" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="rounded-full bg-primary/10 p-3 text-primary"><CheckCircle2 className="h-7 w-7" /></div>
              <h1 className="text-lg font-semibold">Thank you. The coordinator will review your request.</h1>
              <p className="max-w-md text-sm text-muted-foreground">
                We&apos;ll contact your immediate supervisor using the details you gave if anything needs to be checked. You can
                close this page.
              </p>
            </div>
          )}

          {phase === "open" && info && (
            <form ref={formRef} onSubmit={submit} className="flex flex-col gap-5" noValidate>
              <PortalDetails info={info} />
              <div>
                <h1 className="text-xl font-semibold">Be a Host Training Establishment</h1>
                <p className="text-sm text-muted-foreground">
                  Fill in your company&apos;s details so our students can be placed with you for on-the-job training. Fields
                  with <span className="text-destructive">*</span> are required.
                  {info.dueDate && <> Open until {formatDue(info.dueDate)}.</>}
                </p>
              </div>

              <Section title="Company">
                <Field label="Company name" htmlFor="companyName" required error={errors.companyName}>
                  <Input id="companyName" value={companyName} maxLength={255} autoComplete="organization"
                    aria-invalid={Boolean(errors.companyName)} onChange={(e) => { setCompanyName(e.target.value); clear("companyName"); }} />
                </Field>
                <Field label="Nature of the company" htmlFor="nature" required error={errors.natureId}>
                  <NativeSelect id="nature" value={natureId} className="w-full" aria-invalid={Boolean(errors.natureId)}
                    onChange={(e) => { setNatureId(e.target.value); clear("natureId", "natureOther"); }}>
                    <NativeSelectOption value="">Select...</NativeSelectOption>
                    {(info.natures ?? []).map((n) => (
                      <NativeSelectOption key={n.id} value={String(n.id)}>{n.name}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                {otherNature && (
                  <Field label={NATURE_OTHER_LABEL} htmlFor="natureOther" required error={errors.natureOther}>
                    <Input id="natureOther" value={natureOther} maxLength={NATURE_OTHER_MAX} placeholder="e.g. Hospitality"
                      aria-invalid={Boolean(errors.natureOther)}
                      onChange={(e) => { setNatureOther(e.target.value); clear("natureOther"); }} />
                  </Field>
                )}
                <Field label="Address" htmlFor="address" required error={errors.address}>
                  <Input id="address" value={address} maxLength={255} autoComplete="street-address"
                    aria-invalid={Boolean(errors.address)} onChange={(e) => { setAddress(e.target.value); clear("address"); }} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="City / Province" htmlFor="location" error={errors.location}>
                    <Input id="location" value={location} maxLength={255} onChange={(e) => setLocation(e.target.value)} />
                  </Field>
                  <Field label="Company contact number" htmlFor="companyContact" required error={errors.companyContactNumber}
                    hint={CONTACT_HINT}>
                    <Input id="companyContact" value={companyContactNumber} maxLength={CONTACT_MAX} autoComplete="tel"
                      aria-invalid={Boolean(errors.companyContactNumber)}
                      onChange={(e) => { setCompanyContactNumber(e.target.value); clear("companyContactNumber"); }} />
                  </Field>
                </div>
                <Field label="About the company" htmlFor="description" error={errors.description}
                  hint="What the company does, and what trainees will work on.">
                  <Textarea id="description" rows={3} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} />
                </Field>
              </Section>

              <Section title="Immediate supervisor" hint="The person our coordinator will talk to. All fields are required.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Full name" htmlFor="contactName" required error={errors.contactName}>
                    <Input id="contactName" value={contactFullname} maxLength={255} aria-invalid={Boolean(errors.contactName)}
                      onChange={(e) => { setContactFullname(e.target.value); clear("contactName"); }} />
                  </Field>
                  <Field label="Position" htmlFor="contactPosition" required error={errors.contactPosition}>
                    <Input id="contactPosition" value={contactPosition} maxLength={255} aria-invalid={Boolean(errors.contactPosition)}
                      onChange={(e) => { setContactPosition(e.target.value); clear("contactPosition"); }} />
                  </Field>
                  <Field label="Contact number" htmlFor="contactNumber" required error={errors.contactContactNumber}
                    hint={CONTACT_HINT}>
                    <Input id="contactNumber" value={contactNumber} maxLength={CONTACT_MAX}
                      aria-invalid={Boolean(errors.contactContactNumber)}
                      onChange={(e) => { setContactNumber(e.target.value); clear("contactContactNumber"); }} />
                  </Field>
                  <Field label="Email" htmlFor="contactEmail" required error={errors.contactEmail}>
                    <Input id="contactEmail" type="email" inputMode="email" value={contactEmail} maxLength={255}
                      aria-invalid={Boolean(errors.contactEmail)}
                      onChange={(e) => { setContactEmail(e.target.value); clear("contactEmail"); }} />
                  </Field>
                </div>
                <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  Supervisor names, positions, phone numbers and emails are used only to coordinate the OJT. Only share
                  them with the person&apos;s permission. We don&apos;t ask for photos or files, and no account is created.
                </p>
              </Section>

              <Section title="Departments">
                <p id="has-dept" className="text-sm">Does this company have departments?</p>
                <div role="radiogroup" aria-labelledby="has-dept" className="inline-flex w-full overflow-hidden rounded-lg border sm:w-auto">
                  {[{ v: false, label: "No" }, { v: true, label: "Yes" }].map((o) => (
                    <button key={o.label} type="button" role="radio" aria-checked={hasDepartments === o.v}
                      onClick={() => { setHasDepartments(o.v); clearDepartmentErrors(); }}
                      className={cn("min-h-10 flex-1 px-6 text-sm font-medium transition-colors pointer-coarse:min-h-12 sm:flex-none",
                        hasDepartments === o.v ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}>
                      {o.label}
                    </button>
                  ))}
                </div>

                {!hasDepartments ? (
                  <>
                    <p className="text-xs text-muted-foreground">Trainees will be listed under N/A.</p>
                    <LinkDepartmentFields index={0} na value={naDept} errors={errors}
                      onChange={(patch) => { setNaDept((d) => ({ ...d, ...patch })); clearDepartmentErrors(); }} />
                  </>
                ) : (
                  <>
                    {departments.map((d, i) => (
                      <LinkDepartmentFields key={i} index={i} na={false} value={d} errors={errors}
                        onChange={(patch) => patchDept(i, patch)}
                        onRemove={departments.length > 1 ? () => removeDept(i) : undefined} />
                    ))}
                    {departments.length < MAX_DEPARTMENTS && (
                      <Button type="button" variant="outline" className="self-start pointer-coarse:h-11" onClick={addDept}>
                        <Plus className="h-4 w-4" /> Add department
                      </Button>
                    )}
                  </>
                )}
                {errors.departments && <p className="text-xs text-destructive" role="alert">{errors.departments}</p>}
              </Section>

              <Section title="Skills needed" hint="Optional. What your trainees should know, like Excel or Customer service.">
                <div data-error={errors.skills ? "" : undefined}>
                  <SkillsInput id="skills" value={skills} onChange={(next) => { setSkills(next); clear("skills"); }}
                    searchUrl="" invalid={Boolean(errors.skills)} />
                </div>
                {errors.skills && <p className="text-xs text-destructive">{errors.skills}</p>}
              </Section>

              {/* Honeypot: nakatago sa tao; ang bot lang ang pumupuno */}
              <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label>
                  Website
                  <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                </label>
              </div>

              <section className="rounded-xl border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                <h2 className="mb-1 text-sm font-semibold text-foreground">Data Privacy Notice</h2>
                <p className="mb-2">
                  In compliance with the Data Privacy Act of 2012 (RA 10173), the information you enter here (company details,
                  and the names, positions, emails and phone numbers of the immediate supervisor and any department
                  supervisors) is collected only to evaluate and record your company as a Host Training
                  Establishment for the OJT / practicum program{info.program ? ` of ${info.program}` : ""}, and to coordinate
                  with you about it.
                </p>
                <p className="mb-2">
                  It is seen only by the OJT coordinator and authorized personnel of the university, and by students who are
                  placed with your company. Nothing is sold or shared with outside
                  parties, and it is kept only as long as needed for the program and for our records. You may ask the
                  coordinator to correct or remove your information at any time.
                </p>
                <p>
                  If you give details of other people (supervisors), you confirm that they know and agree that you are sharing
                  them.
                </p>
                <p className="mt-2">
                  <a href="/privacy" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
                    Read the full Privacy Notice
                  </a>
                </p>
              </section>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="flex cursor-pointer items-start gap-3 text-sm">
                    <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary" checked={supervisorPermission}
                      aria-invalid={Boolean(errors.supervisorPermission)}
                      onChange={(e) => { setSupervisorPermission(e.target.checked); clear("supervisorPermission"); }} />
                    <span>
                      I have the supervisor&apos;s permission to share these contact details. <span className="text-destructive">*</span>
                    </span>
                  </label>
                  {errors.supervisorPermission && <p className="text-xs text-destructive">{errors.supervisorPermission}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="flex cursor-pointer items-start gap-3 text-sm">
                    <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary" checked={consent}
                      aria-invalid={Boolean(errors.consent)} onChange={(e) => { setConsent(e.target.checked); clear("consent"); }} />
                    <span>
                      I have read the Data Privacy Notice and I agree to the collection and use of this information for this
                      purpose. <span className="text-destructive">*</span>
                    </span>
                  </label>
                  {errors.consent && <p className="text-xs text-destructive">{errors.consent}</p>}
                </div>
              </div>

              {formError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{formError}</p>}

              {/* Nakadikit sa ibaba sa phone */}
              <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 p-4 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
                <div className="mx-auto max-w-2xl">
                  <Button type="submit" size="lg" disabled={saving} className="w-full">
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {saving ? "Sending..." : "Send request"}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
