import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, LinkIcon, ShieldCheck } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { GENDERS, YEARS, validEmail, validNumber } from "@/lib/students";
import { tidyInitial, tidyName } from "@/lib/names";
import { cn } from "@/lib/utils";
import { CollegeLogo } from "@/components/colleges/CollegeLogo";
import { Button } from "@/components/ui/button";
import { CheckEmailPanel } from "@/components/join/CheckEmailPanel";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

type Phase = "checking" | "open" | "closed" | "expired" | "invalid" | "error" | "done";

interface Info {
  status: "open" | "closed" | "expired" | "invalid";
  dueDate?: string;
  college?: string;
  collegeAbbreviation?: string;
  collegeLogo?: string;
  program?: string;
  programAbbreviation?: string;
  course?: string;
  semester?: string;
  coordinator?: string;
}

interface Form {
  studentNumber: string;
  lastname: string;
  firstname: string;
  middleInitial: string;
  year: string;
  gender: string;
  email: string;
  password: string;
  confirmPassword: string;
  privacyAccepted: boolean;
  /** Honeypot: nakatago sa tao; kapag may laman, bot ito */
  website: string;
}

type Errors = Partial<Record<keyof Form, string>>;

const EMPTY: Form = {
  studentNumber: "",
  lastname: "",
  firstname: "",
  middleInitial: "",
  year: "",
  gender: "",
  email: "",
  password: "",
  confirmPassword: "",
  privacyAccepted: false,
  website: "",
};

function formatDue(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

/** Parehong pagsusuri ng server; ang server pa rin ang huling nagpapasya */
function validate(f: Form): Errors {
  const e: Errors = {};
  const n = validNumber(f.studentNumber);
  if (n) e.studentNumber = n === "Student number is required." ? "Student ID is required." : n;
  if (!f.lastname.trim()) e.lastname = "Last name is required.";
  if (!f.firstname.trim()) e.firstname = "First name is required.";
  if (!f.year) e.year = "Year is required.";
  if (!f.gender) e.gender = "Choose your sex at birth.";
  const m = validEmail(f.email);
  if (m) e.email = m;
  if (f.password.length < 8) e.password = "Password must be at least 8 characters.";
  else if (new TextEncoder().encode(f.password).length > 72) e.password = "Password is too long (max 72 characters).";
  else if (f.password.trim().toLowerCase() === f.studentNumber.trim().toLowerCase())
    e.password = "Don't use your Student ID as your password.";
  if (!e.password && f.confirmPassword !== f.password) e.confirmPassword = "Passwords don't match.";
  if (!f.privacyAccepted) e.privacyAccepted = "Please read and accept the Privacy Notice.";
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
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden="true"> *</span>
        ) : (
          <span className="font-normal text-muted-foreground"> (optional)</span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/** Saan galing ang link: para alam ng student na tama ang pinuntahan niya */
function PortalHeader({ info }: { info: Info }) {
  const program = info.program || info.programAbbreviation;
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-3">
      <CollegeLogo
        path={info.collegeLogo}
        label={info.collegeAbbreviation || info.college || "UCU"}
        className="h-12 w-12"
      />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold leading-snug">{info.college || "Urdaneta City University"}</p>
        {program && (
          <p className="leading-snug text-muted-foreground">
            {info.program}
            {info.program && info.programAbbreviation ? ` (${info.programAbbreviation})` : info.programAbbreviation}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {[info.semester, info.coordinator && `Coordinator: ${info.coordinator}`].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  );
}

function StateCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <div className="rounded-full bg-primary/10 p-3 text-primary">{icon}</div>
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="flex flex-col gap-3 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

/** Pampublikong page ng registration link (walang login) */
export default function Join() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [phase, setPhase] = useState<Phase>(token ? "checking" : "invalid");
  const [info, setInfo] = useState<Info | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .get<Info>("/enroll/info", { params: { token } })
      .then((res) => {
        if (cancelled) return;
        setInfo(res.data);
        setPhase(res.data.status);
      })
      // Hindi "invalid link" ang error ng server o network
      .catch(() => !cancelled && setPhase("error"));
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    // Alisin ang error ng field habang inaayos
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // Ituon sa unang may mali
      const first = Object.keys(found)[0];
      document.getElementById(`join-${first}`)?.focus();
      return;
    }
    setSaving(true);
    try {
      await api.post("/enroll/register", {
        token,
        ...form,
        lastname: tidyName(form.lastname),
        firstname: tidyName(form.firstname),
        middleInitial: tidyInitial(form.middleInitial),
      });
      setPhase("done");
      window.scrollTo({ top: 0 });
    } catch (err) {
      const fields = getFieldErrors(err) as Errors;
      setErrors(fields);
      // Isang beses lang ipapakita ang mensahe: sa field kung may field, kung wala ay sa itaas ng button
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err, "Couldn't send your registration."));
      const first = Object.keys(fields)[0];
      if (first) document.getElementById(`join-${first}`)?.focus();
    } finally {
      setSaving(false);
    }
  }

  const describe = (k: keyof Form) => (errors[k] ? { "aria-invalid": true, "aria-describedby": `join-${k}-error` } : {});

  return (
    <main className="min-h-dvh bg-muted/30">
      <div className="mx-auto w-full max-w-md px-4 pb-28 pt-6 sm:pb-10 sm:pt-10">
        <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
          OJT System · Student registration
        </p>

        <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          {phase === "checking" && <p className="py-8 text-center text-sm text-muted-foreground">Checking the link...</p>}

          {phase === "error" && (
            <StateCard icon={<LinkIcon className="h-6 w-6" />} title="Can't reach the server">
              <p>Your link may be fine, but the page couldn't load. Check your connection and try again.</p>
              <Button
                className="w-full"
                onClick={() => {
                  setPhase("checking");
                  setAttempt((n) => n + 1);
                }}
              >
                Try again
              </Button>
            </StateCard>
          )}

          {phase === "invalid" && (
            <StateCard icon={<LinkIcon className="h-6 w-6" />} title="This link isn't valid">
              <p>It may be incomplete or replaced by a new one. Ask your coordinator for the correct link or QR code.</p>
            </StateCard>
          )}

          {(phase === "closed" || phase === "expired") && info && (
            <div className="flex flex-col gap-4">
              <PortalHeader info={info} />
              <StateCard
                icon={<LinkIcon className="h-6 w-6" />}
                title={phase === "closed" ? "Registration is closed" : "Registration has ended"}
              >
                <p>
                  {phase === "closed"
                    ? "Your coordinator isn't accepting registrations right now."
                    : `The last day to register was ${formatDue(info.dueDate ?? "")}.`}{" "}
                  Please contact your coordinator.
                </p>
              </StateCard>
            </div>
          )}

          {phase === "done" && info && (
            <div className="flex flex-col gap-4">
              <PortalHeader info={info} />
              <CheckEmailPanel
                email={form.email.trim()}
                firstName={tidyName(form.firstname)}
                onFixEmail={() => {
                  setPhase("open");
                  setErrors({});
                  window.setTimeout(() => document.getElementById("join-email")?.focus(), 50);
                }}
              />
            </div>
          )}

          {phase === "open" && info && (
            <form noValidate onSubmit={submit} className="flex flex-col gap-5">
              <PortalHeader info={info} />

              <div>
                <h1 className="text-lg font-semibold">Create your account</h1>
                <p className="text-sm text-muted-foreground">
                  Fields with <span className="text-destructive">*</span> are required. We'll send a link to your email to
                  verify it, so use an email you can open now.
                  {info.dueDate ? ` Open until ${formatDue(info.dueDate)}.` : ""}
                </p>
              </div>

              {/* Honeypot: nakatago sa tao at sa screen reader */}
              <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
                <label htmlFor="join-website">Website</label>
                <input
                  id="join-website"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(e) => set("website", e.target.value)}
                />
              </div>

              <fieldset className="flex flex-col gap-4">
                <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  About you
                </legend>
                <Field id="join-studentNumber" label="Student ID" required error={errors.studentNumber}>
                  <Input
                    id="join-studentNumber"
                    value={form.studentNumber}
                    maxLength={50}
                    autoComplete="off"
                    inputMode="text"
                    placeholder="2021-00123"
                    onChange={(e) => set("studentNumber", e.target.value)}
                    {...describe("studentNumber")}
                  />
                </Field>
                <Field id="join-lastname" label="Last name" required error={errors.lastname}>
                  <Input
                    id="join-lastname"
                    value={form.lastname}
                    maxLength={100}
                    autoComplete="family-name"
                    autoCapitalize="words"
                    onChange={(e) => set("lastname", e.target.value)}
                    onBlur={() => set("lastname", tidyName(form.lastname))}
                    {...describe("lastname")}
                  />
                </Field>
                <div className="grid grid-cols-[1fr_5.5rem] gap-3">
                  <Field id="join-firstname" label="First name" required error={errors.firstname}>
                    <Input
                      id="join-firstname"
                      value={form.firstname}
                      maxLength={100}
                      autoComplete="given-name"
                      autoCapitalize="words"
                      onChange={(e) => set("firstname", e.target.value)}
                      onBlur={() => set("firstname", tidyName(form.firstname))}
                      {...describe("firstname")}
                    />
                  </Field>
                  <Field id="join-middleInitial" label="M.I." error={errors.middleInitial}>
                    <Input
                      id="join-middleInitial"
                      value={form.middleInitial}
                      maxLength={2}
                      autoComplete="off"
                      autoCapitalize="characters"
                      className="text-center"
                      onChange={(e) => set("middleInitial", tidyInitial(e.target.value))}
                      {...describe("middleInitial")}
                    />
                  </Field>
                </div>

                <Field id="join-course" label="Course" required hint="Set by your coordinator's program.">
                  <Input id="join-course" value={info.course ?? ""} readOnly disabled className="font-medium" />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field id="join-year" label="Year" required error={errors.year}>
                    <NativeSelect
                      id="join-year"
                      value={form.year}
                      onChange={(e) => set("year", e.target.value)}
                      className="w-full"
                      {...describe("year")}
                    >
                      <NativeSelectOption value="">Select</NativeSelectOption>
                      {YEARS.map((y) => (
                        <NativeSelectOption key={y} value={y}>
                          {y}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field id="join-gender" label="Sex at birth" required error={errors.gender}>
                    <NativeSelect
                      id="join-gender"
                      value={form.gender}
                      onChange={(e) => set("gender", e.target.value)}
                      className="w-full"
                      {...describe("gender")}
                    >
                      <NativeSelectOption value="">Select</NativeSelectOption>
                      {GENDERS.map((g) => (
                        <NativeSelectOption key={g} value={g}>
                          {g}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                </div>
              </fieldset>

              <fieldset className="flex flex-col gap-4 border-t pt-5">
                <legend className="sr-only">Your login</legend>
                <p className="-mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your login</p>
                <Field
                  id="join-email"
                  label="Email"
                  required
                  hint="You'll log in with this email or your Student ID."
                  error={errors.email}
                >
                  <Input
                    id="join-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={form.email}
                    maxLength={255}
                    placeholder="you@gmail.com"
                    onChange={(e) => set("email", e.target.value)}
                    {...describe("email")}
                  />
                </Field>
                <Field id="join-password" label="Password" required hint="At least 8 characters." error={errors.password}>
                  <div className="relative">
                    <Input
                      id="join-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={form.password}
                      className="pr-11"
                      onChange={(e) => set("password", e.target.value)}
                      {...describe("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                <Field id="join-confirmPassword" label="Confirm password" required error={errors.confirmPassword}>
                  <Input
                    id="join-confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={(e) => set("confirmPassword", e.target.value)}
                    {...describe("confirmPassword")}
                  />
                </Field>
              </fieldset>

              <div
                className={cn(
                  "flex flex-col gap-2 rounded-xl border p-3 text-sm",
                  errors.privacyAccepted ? "border-destructive" : "bg-muted/40",
                )}
              >
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-muted-foreground">
                    We use your details only to manage and evaluate your OJT. Only you, your coordinator, your program
                    head and system administrators can see them.{" "}
                    <Link to="/privacy" target="_blank" className="text-primary underline underline-offset-2">
                      Read the Privacy Notice
                    </Link>
                  </p>
                </div>
                <label htmlFor="join-privacyAccepted" className="flex cursor-pointer items-start gap-3 py-1">
                  <input
                    id="join-privacyAccepted"
                    type="checkbox"
                    checked={form.privacyAccepted}
                    onChange={(e) => set("privacyAccepted", e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
                    {...describe("privacyAccepted")}
                  />
                  <span className="font-medium">
                    I have read the Privacy Notice and agree to the use of my data for my OJT.
                    <span className="text-destructive" aria-hidden="true"> *</span>
                  </span>
                </label>
                {errors.privacyAccepted && (
                  <p id="join-privacyAccepted-error" className="text-xs text-destructive">
                    {errors.privacyAccepted}
                  </p>
                )}
              </div>

              {formError && (
                <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {formError}
                </p>
              )}

              {/* Nakadikit sa ibaba sa phone para laging abot ng hinlalaki */}
              <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 p-4 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
                <div className="mx-auto max-w-md">
                  <Button type="submit" size="lg" disabled={saving} className="w-full">
                    {saving ? "Sending..." : "Register"}
                  </Button>
                </div>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-primary underline underline-offset-2">
                  Log in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
