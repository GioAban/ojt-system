import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { KeyRound, Loader2, MailCheck, RotateCw } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useCooldown } from "@/hooks/useCooldown";
import { AuthShell, StatusBlock } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Forgot password: laging parehong sagot, may account man o wala ang email */
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const cooldown = useCooldown();

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter the email you use for the OJT System.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await api.post<{ cooldown?: number }>("/auth/password/forgot", { email: value });
      cooldown.start(res.data.cooldown ?? 60);
      setSentTo(value);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't send the link. Check your connection and try again."));
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthShell label="Reset password" footer={<Link to="/login" className="text-primary underline underline-offset-2">Back to login</Link>}>
      {sentTo ? (
        <StatusBlock icon={<MailCheck className="h-7 w-7" />} title="Check your email">
          <p>
            If <span className="break-all font-medium text-foreground">{sentTo}</span> has an account, we sent a link to
            reset the password.
          </p>
          <ul className="rounded-lg bg-muted/50 px-4 py-3 text-left text-xs">
            <li>• The link works once and expires in 1 hour.</li>
            <li>• Can't find it? Check your Spam or Promotions folder.</li>
            <li>• No email on your account? Ask your coordinator to reset your password.</li>
          </ul>
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-destructive">
              {error}
            </p>
          )}
          <Button size="lg" variant="outline" className="w-full" disabled={sending || cooldown.left > 0}
            onClick={() => void send()}>
            <RotateCw className={cn("h-4 w-4", sending && "animate-spin")} />
            {sending ? "Sending..." : cooldown.left > 0 ? `Send again in ${cooldown.left}s` : "Send again"}
          </Button>
          <button type="button" className="py-1 text-sm text-primary underline underline-offset-2"
            onClick={() => { setSentTo(""); setError(""); }}>
            Use a different email
          </button>
        </StatusBlock>
      ) : (
        <form noValidate onSubmit={(e) => void send(e)} className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2.5 text-primary">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Forgot your password?</h1>
              <p className="text-sm text-muted-foreground">Enter your email and we'll send you a link to choose a new one.</p>
            </div>
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Email</span>
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoFocus
              value={email}
              placeholder="you@gmail.com"
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "forgot-error" : undefined}
            />
          </label>
          {error && (
            <p id="forgot-error" role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={sending}>
            {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</> : "Send reset link"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Signed up with only your Student ID and no email? Your coordinator can reset your password.
          </p>
        </form>
      )}
    </AuthShell>
  );
}
