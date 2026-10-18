import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { DEFAULT_PASSWORD_RULE } from "@/lib/students";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Phase = "checking" | "open" | "closed" | "expired" | "invalid" | "error" | "done";
type Outcome = "submitted" | "pending" | "active";

interface Info {
  status: "open" | "closed" | "expired" | "invalid";
  dueDate?: string;
  college?: string;
  collegeAbbreviation?: string;
  program?: string;
  programAbbreviation?: string;
  semester?: string;
  coordinator?: string;
}

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

/** Saan galing ang portal na ito: college, program, semester at coordinator */
function PortalDetails({ info }: { info: Info }) {
  const college = [info.college, info.collegeAbbreviation && info.college ? `(${info.collegeAbbreviation})` : info.collegeAbbreviation]
    .filter(Boolean)
    .join(" ");
  const program = [info.program, info.programAbbreviation && info.program ? `(${info.programAbbreviation})` : info.programAbbreviation]
    .filter(Boolean)
    .join(" ");
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

/** Pampublikong page ng enrollment link */
export default function Claim() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";

  const [phase, setPhase] = useState<Phase>("checking");
  const [dueDate, setDueDate] = useState("");
  const [info, setInfo] = useState<Info | null>(null);
  const [studentNumber, setStudentNumber] = useState("");
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [outcome, setOutcome] = useState<Outcome>("submitted");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) {
      setPhase("invalid");
      return;
    }
    let cancelled = false;
    setPhase("checking");
    api
      .get<Info>("/enroll/info", { params: { token } })
      .then((res) => {
        if (cancelled) return;
        setInfo(res.data);
        setDueDate(res.data.dueDate ?? "");
        setPhase(res.data.status);
      })
      // Hindi "invalid link" ang error ng server o network; huwag itong ipakitang parang mali ang link
      .catch(() => !cancelled && setPhase("error"));
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await api.post<{ state: Outcome }>("/enroll/claim", { token, studentNumber, email });
      setSentTo(email.trim());
      setOutcome(res.data.state);
      setPhase("done");
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't send the request."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        {phase === "checking" && <p className="text-center text-sm text-muted-foreground">Checking the link...</p>}

        {info && (phase === "open" || phase === "closed" || phase === "expired" || phase === "done") && (
          <>
            <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
              OJT System · Account enrollment
            </p>
            <PortalDetails info={info} />
          </>
        )}

        {phase === "error" && (
          <div className="text-center">
            <h1 className="mb-2 text-lg font-semibold">Can't reach the server</h1>
            <p className="mb-4 text-sm text-muted-foreground">
              Your link may be fine, but the page couldn't load. Check your connection and try again. If it keeps
              happening, tell your coordinator.
            </p>
            <Button className="w-full" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
          </div>
        )}

        {(phase === "invalid" || phase === "closed" || phase === "expired") && (
          <div className="text-center">
            <h1 className="mb-2 text-lg font-semibold">
              {phase === "closed" ? "Enrollment is closed" : phase === "expired" ? "Enrollment has ended" : "Link not valid"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {phase === "invalid"
                ? "This link isn't valid. Ask your coordinator for the correct link."
                : "Please contact your coordinator."}
            </p>
          </div>
        )}

        {phase === "done" && outcome === "submitted" && (
          <div className="text-center">
            <h1 className="mb-2 text-lg font-semibold">Request sent</h1>
            <p className="mb-3 text-sm text-muted-foreground">
              Your coordinator will review your request for <strong>{sentTo}</strong>.
            </p>
            <p className="mb-2 rounded-md bg-muted p-3 text-left text-sm">
              Once accepted, log in with your email and this password:<br />
              <span className="text-muted-foreground">{DEFAULT_PASSWORD_RULE}</span>
            </p>
            <p className="mb-4 text-xs text-muted-foreground">You'll be asked to set your own password after your first login.</p>
            <Button className="w-full" onClick={() => navigate("/login")}>Go to login</Button>
          </div>
        )}

        {phase === "done" && outcome === "pending" && (
          <div className="text-center">
            <h1 className="mb-2 text-lg font-semibold">You already enrolled</h1>
            <p className="mb-4 text-sm text-muted-foreground">
              Your request is waiting for your coordinator. You can log in after it is accepted.
            </p>
            <Button className="w-full" variant="outline" onClick={() => navigate("/login")}>Go to login</Button>
          </div>
        )}

        {phase === "done" && outcome === "active" && (
          <div className="text-center">
            <h1 className="mb-2 text-lg font-semibold">You already have an account</h1>
            <p className="mb-4 text-sm text-muted-foreground">
              Log in with your email. If you forgot your password, ask your coordinator to reset it.
            </p>
            <Button className="w-full" onClick={() => navigate("/login")}>Go to login</Button>
          </div>
        )}

        {phase === "open" && (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <div>
              <h1 className="text-lg font-semibold">Request your account</h1>
              <p className="text-sm text-muted-foreground">
                Enter your Student ID and your email. Your coordinator will review your request and accept it.
                {dueDate && <> Open until {formatDue(dueDate)}.</>}
              </p>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Student ID</span>
              <Input value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} autoFocus autoComplete="off" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Email (Gmail)</span>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@gmail.com" />
              <span className="text-xs text-muted-foreground">Use your own email. This will be your login.</span>
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={saving}>{saving ? "Sending..." : "Send request"}</Button>
          </form>
        )}
      </div>
    </main>
  );
}
