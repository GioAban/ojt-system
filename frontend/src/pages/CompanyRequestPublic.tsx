import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, X } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { PHONE_PATTERN } from "@/lib/company";
import { Field } from "@/components/companies/parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

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

interface Dept {
  name: string;
  slots: string;
}

const MAX_DEPARTMENTS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatDue(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium">{value}</dd>
    </div>
  );
}

function PortalDetails({ info }: { info: Info }) {
  const join = (a?: string, b?: string) => [a, b && a ? `(${b})` : b].filter(Boolean).join(" ");
  const college = join(info.college, info.collegeAbbreviation);
  const program = join(info.program, info.programAbbreviation);
  if (!college && !program && !info.semester && !info.coordinator) return null;
  return (
    <dl className="mb-5 flex flex-col gap-1 rounded-lg bg-muted/60 p-3 text-sm">
      <Row label="College" value={college} />
      <Row label="Program" value={program} />
      <Row label="Semester" value={info.semester} />
      <Row label="Coordinator" value={info.coordinator} />
    </dl>
  );
}

/** Pampublikong page para sa company: walang account, may Data Privacy Notice at kailangang pumayag */
export default function CompanyRequestPublic() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [phase, setPhase] = useState<Phase>("checking");
  const [info, setInfo] = useState<Info | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [companyName, setCompanyName] = useState("");
  const [natureId, setNatureId] = useState("");
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState("");
  const [companyContactNumber, setCompanyContactNumber] = useState("");
  const [contactFullname, setContactFullname] = useState("");
  const [contactPosition, setContactPosition] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [departments, setDepartments] = useState<Dept[]>([{ name: "", slots: "1" }]);
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot: dapat laging walang laman

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) {
      setPhase("invalid");
      return;
    }
    let cancelled = false;
    setPhase("checking");
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

  function setDept(i: number, patch: Partial<Dept>) {
    setDepartments((list) => list.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!companyName.trim()) e.companyName = "Enter the company name.";
    if (!natureId) e.natureId = "Select the nature of the company.";
    if (!address.trim()) e.address = "Enter the company address.";
    if (!PHONE_PATTERN.test(companyContactNumber.trim())) e.companyContactNumber = "Enter a valid contact number.";
    if (!contactFullname.trim()) e.contactFullname = "Enter the contact person's name.";
    if (contactEmail.trim() && !EMAIL_RE.test(contactEmail.trim())) e.contactEmail = "Enter a valid email or leave it blank.";
    if (!PHONE_PATTERN.test(contactNumber.trim())) e.contactNumber = "Enter a valid contact number.";
    if (departments.some((d) => !d.name.trim())) e.departments = "Enter the name of each department or unit.";
    else if (departments.some((d) => !/^\d+$/.test(d.slots) || Number(d.slots) < 1 || Number(d.slots) > 99)) {
      e.departments = "Slots must be a number from 1 to 99.";
    }
    if (!consent) e.consent = "You need to agree to the Data Privacy Notice to continue.";
    return e;
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setFormError("");
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSaving(true);
    try {
      await api.post("/public/company-requests/submit", {
        token,
        companyName,
        natureId: Number(natureId),
        address,
        location,
        companyContactNumber,
        contactFullname,
        contactPosition,
        contactEmail,
        contactNumber,
        departments: departments.map((d) => ({ name: d.name, slots: Number(d.slots) })),
        consent,
        website,
      });
      setPhase("done");
    } catch (err) {
      setFormError(getErrorMessage(err, "Couldn't send your request. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-start justify-center bg-muted/30 px-4 py-6 sm:items-center sm:p-4">
      <div className="w-full max-w-xl rounded-xl border bg-card p-5 shadow-sm sm:p-6">
        {phase === "checking" && <p className="text-center text-sm text-muted-foreground">Checking the link...</p>}

        {info && (phase === "open" || phase === "closed" || phase === "expired" || phase === "done") && (
          <>
            <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
              OJT System · Host Training Establishment request
            </p>
            <PortalDetails info={info} />
          </>
        )}

        {phase === "error" && (
          <div className="text-center">
            <h1 className="mb-2 text-lg font-semibold">Can't reach the server</h1>
            <p className="mb-4 text-sm text-muted-foreground">
              The link may be fine, but the page couldn't load. Check your connection and try again.
            </p>
            <Button className="w-full" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
          </div>
        )}

        {(phase === "invalid" || phase === "closed" || phase === "expired") && (
          <div className="text-center">
            <h1 className="mb-2 text-lg font-semibold">
              {phase === "closed" ? "This form is closed" : phase === "expired" ? "This form has ended" : "Link not valid"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {phase === "invalid"
                ? "This link isn't valid. Please ask the OJT coordinator for the correct link."
                : "Please contact the OJT coordinator."}
            </p>
          </div>
        )}

        {phase === "done" && (
          <div className="text-center">
            <h1 className="mb-2 text-lg font-semibold">Request sent. Thank you!</h1>
            <p className="text-sm text-muted-foreground">
              The OJT coordinator will review your details and contact you using the contact information you provided.
              You can close this page.
            </p>
          </div>
        )}

        {phase === "open" && info && (
          <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
            <div>
              <h1 className="text-lg font-semibold">Be a Host Training Establishment</h1>
              <p className="text-sm text-muted-foreground">
                Fill in your company's details so our students can be placed with you for on-the-job training. The
                coordinator will review your request.
                {info.dueDate && <> Open until {formatDue(info.dueDate)}.</>}
              </p>
            </div>

            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold">Company</h2>
              <Field label="Company name" htmlFor="companyName" required error={errors.companyName}>
                <Input id="companyName" value={companyName} maxLength={255} onChange={(e) => setCompanyName(e.target.value)} />
              </Field>
              <Field label="Nature of the company" htmlFor="nature" required error={errors.natureId}>
                <NativeSelect id="nature" value={natureId} onChange={(e) => setNatureId(e.target.value)}>
                  <NativeSelectOption value="">Select...</NativeSelectOption>
                  {(info.natures ?? []).map((n) => (
                    <NativeSelectOption key={n.id} value={String(n.id)}>{n.name}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Address" htmlFor="address" required error={errors.address}>
                <Input id="address" value={address} maxLength={255} onChange={(e) => setAddress(e.target.value)} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="City / Province" htmlFor="location">
                  <Input id="location" value={location} maxLength={255} onChange={(e) => setLocation(e.target.value)} />
                </Field>
                <Field label="Company contact number" htmlFor="companyContact" required error={errors.companyContactNumber}>
                  <Input id="companyContact" inputMode="tel" value={companyContactNumber} maxLength={20} onChange={(e) => setCompanyContactNumber(e.target.value)} />
                </Field>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold">Contact person</h2>
              <p className="-mt-2 text-xs text-muted-foreground">
                The person who will supervise or coordinate with our students.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Full name" htmlFor="contactName" required error={errors.contactFullname}>
                  <Input id="contactName" value={contactFullname} maxLength={255} onChange={(e) => setContactFullname(e.target.value)} />
                </Field>
                <Field label="Position" htmlFor="contactPosition">
                  <Input id="contactPosition" value={contactPosition} maxLength={255} onChange={(e) => setContactPosition(e.target.value)} />
                </Field>
                <Field label="Email" htmlFor="contactEmail" error={errors.contactEmail}>
                  <Input id="contactEmail" type="email" value={contactEmail} maxLength={255} onChange={(e) => setContactEmail(e.target.value)} />
                </Field>
                <Field label="Mobile / contact number" htmlFor="contactNumber" required error={errors.contactNumber}>
                  <Input id="contactNumber" inputMode="tel" value={contactNumber} maxLength={20} onChange={(e) => setContactNumber(e.target.value)} />
                </Field>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold">Departments or units that can accept trainees</h2>
              {departments.map((d, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Input
                    aria-label={`Department ${i + 1} name`}
                    placeholder="e.g. IT Department"
                    value={d.name}
                    maxLength={255}
                    onChange={(e) => setDept(i, { name: e.target.value })}
                    className="min-w-0 flex-1"
                  />
                  <Input
                    aria-label={`Department ${i + 1} slots`}
                    inputMode="numeric"
                    value={d.slots}
                    onChange={(e) => setDept(i, { slots: e.target.value })}
                    className="w-16 shrink-0 sm:w-20"
                    title="Number of trainees"
                  />
                  {departments.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove department" onClick={() => setDepartments((l) => l.filter((_, idx) => idx !== i))}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <p className="text-xs text-muted-foreground">The number beside each name is how many trainees it can accept.</p>
              {errors.departments && <p className="text-xs text-destructive">{errors.departments}</p>}
              {departments.length < MAX_DEPARTMENTS && (
                <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setDepartments((l) => [...l, { name: "", slots: "1" }])}>
                  <Plus className="h-4 w-4" /> Add another department
                </Button>
              )}
            </section>

            {/* Honeypot: nakatago sa tao; ang bot lang ang pumupuno */}
            <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                Website
                <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </label>
            </div>

            <section className="rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
              <h2 className="mb-1 text-sm font-semibold text-foreground">Data Privacy Notice</h2>
              <p className="mb-2">
                In compliance with the Data Privacy Act of 2012 (RA 10173), the information you enter here (company
                details and the contact person's name, position, email and phone number) is collected only to evaluate and
                record your company as a Host Training Establishment for the OJT / practicum program
                {info.program ? ` of ${info.program}` : ""}, and to coordinate with you about it.
              </p>
              <p className="mb-2">
                It is seen only by the OJT coordinator and authorized personnel of the university, and by students who
                are placed with your company. It is not sold or shared with outside parties, and is kept only as long
                as needed for the program and for our records. You may ask the coordinator to correct or remove your
                information at any time.
              </p>
              <p>
                If you give details of another person (the contact person), you confirm that they know and agree that
                you are sharing them.
              </p>
              <p className="mt-2">
                <a href="/privacy" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
                  Read the full Privacy Notice
                </a>
              </p>
            </section>

            <div className="flex flex-col gap-1">
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 shrink-0 pointer-coarse:size-5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>
                  I have read the Data Privacy Notice and I agree to the collection and use of this information for this
                  purpose. <span className="text-destructive">*</span>
                </span>
              </label>
              {errors.consent && <p className="text-xs text-destructive">{errors.consent}</p>}
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <Button type="submit" disabled={saving}>{saving ? "Sending..." : "Send request"}</Button>
          </form>
        )}
      </div>
    </main>
  );
}
