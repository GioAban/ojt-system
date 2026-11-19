import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, Eye, EyeOff, KeyRound, Link2Off, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { hideUrlToken, readUrlToken } from "@/lib/urlToken";
import { cn } from "@/lib/utils";
import { AuthShell, StatusBlock } from "@/components/auth/AuthShell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Phase = "checking" | "valid" | "expired" | "used" | "invalid" | "error" | "done";

/** Pagpili ng bagong password mula sa link sa email. Ginagamit lang ang link kapag pinindot ang Save. */
export default function ResetPassword() {
  const [token] = useState(readUrlToken);
  const [phase, setPhase] = useState<Phase>(token ? "checking" : "invalid");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    hideUrlToken();
    if (!token || started.current) return;
    started.current = true;
    api
      .post<{ state: Phase }>("/auth/password/check", { token })
      .then((res) => setPhase(res.data.state))
      .catch(() => setPhase("error"));
  }, [token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (new TextEncoder().encode(password).length > 72) return setError("Password is too long (max 72 characters).");
    if (confirm !== password) return setError("Passwords don't match.");
    setSaving(true);
    setError("");
    try {
      await api.post("/auth/password/reset", { token, password, confirmPassword: confirm });
      // Ang mga lumang login (pati sa device na ito) ay tinatanggihan na ng server
      setPhase("done");
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 410) {
        setPhase("expired");
      } else {
        setError(getErrorMessage(err, "Couldn't change your password. Try again."));
      }
    } finally {
      setSaving(false);
    }
  }

  const requestNew = (
    <Link to="/forgot-password" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
      Get a new link
    </Link>
  );

  return (
    <AuthShell label="Reset password" footer={<Link to="/login" className="text-primary underline underline-offset-2">Back to login</Link>}>
      {phase === "checking" && (
        <StatusBlock icon={<Loader2 className="h-7 w-7 animate-spin" />} title="Checking your link...">
          <p>This only takes a moment.</p>
        </StatusBlock>
      )}

      {phase === "error" && (
        <StatusBlock icon={<Link2Off className="h-7 w-7" />} tone="warning" title="Can't reach the server">
          <p>Check your connection, then open the link from your email again.</p>
        </StatusBlock>
      )}

      {(phase === "expired" || phase === "used") && (
        <StatusBlock icon={<Clock className="h-7 w-7" />} tone="warning"
          title={phase === "expired" ? "This link has expired" : "This link was already used"}>
          <p>Reset links work once and expire after 1 hour. Request a new one to continue.</p>
          {requestNew}
        </StatusBlock>
      )}

      {phase === "invalid" && (
        <StatusBlock icon={<Link2Off className="h-7 w-7" />} tone="danger" title="This link isn't valid">
          <p>It may be incomplete. Open the newest link from your email, or request a new one.</p>
          {requestNew}
        </StatusBlock>
      )}

      {phase === "done" && (
        <StatusBlock icon={<CheckCircle2 className="h-7 w-7" />} tone="success" title="Password changed">
          <p>You can now log in with your new password. You were logged out on your other devices.</p>
          <Link to="/login" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
            Log in
          </Link>
        </StatusBlock>
      )}

      {phase === "valid" && (
        <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2.5 text-primary">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Choose a new password</h1>
              <p className="text-sm text-muted-foreground">At least 8 characters. Don't use your Student ID.</p>
            </div>
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">New password</span>
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                autoComplete="new-password"
                autoFocus
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                className="pr-10"
                aria-invalid={Boolean(error)}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground pointer-coarse:p-2.5"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Confirm new password</span>
            <Input
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError(""); }}
              aria-invalid={Boolean(error)}
            />
          </label>
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Save new password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
