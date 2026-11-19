import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Loader2, MailCheck } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useCooldown } from "@/hooks/useCooldown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  /**
   * Ang dati mong login logic. Mag-throw ng error kapag mali ang login;
   * ikaw ang bahala sa pag-save ng token at pag-redirect kapag tama.
   * identifier = email o Student ID. shared = "This is a shared computer" (walang itatabi sa device).
   */
  onSubmit: (identifier: string, password: string, shared: boolean) => Promise<void>;
  /** Maikling paalala sa itaas (hal. nag-expire ang login habang may hindi pa naipapadala) */
  notice?: string;
}

/** Minimalist na login card: Email o Student ID + password */
export function LoginForm({ onSubmit, notice }: Props) {
  const [identifier, setIdentifier] = useState("");
  const [shared, setShared] = useState(false);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Galing sa server (RegistrationService.VERIFY_EMAIL_FIRST)
  const needsVerification = error.startsWith("Please verify your email first");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError("Enter your email or Student ID and your password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onSubmit(identifier.trim(), password, shared);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : getErrorMessage(err, "Wrong email, Student ID, or password."),
      );
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Use your email or your Student ID.
      </p>

      {notice && (
        <p role="status" className="mt-4 flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {notice}
        </p>
      )}

      <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Email or Student ID</span>
          <Input
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              setError("");
            }}
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            placeholder="you@gmail.com or 2021-00123"
            aria-invalid={Boolean(error)}
          />
        </label>

        <div className="flex flex-col gap-1.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="login-password" className="font-medium">Password</label>
            <Link
              to="/forgot-password"
              className="rounded text-xs text-primary underline-offset-2 hover:underline pointer-coarse:py-1"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="login-password"
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              autoComplete="current-password"
              className="pr-10"
              aria-invalid={Boolean(error)}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground pointer-coarse:p-2.5"
            >
              {show ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={shared}
            onChange={(e) => setShared(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary pointer-coarse:h-5 pointer-coarse:w-5"
          />
          <span>
            <span className="font-medium">This is a shared computer</span>
            <span className="block text-xs text-muted-foreground">
              Nothing is saved on this device, and offline mode won't work this session. Your drafts are removed when
              you log out.
            </span>
          </span>
        </label>

        {error && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        {needsVerification && <ResendVerification identifier={identifier.trim()} />}

        <Button type="submit" size="lg" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      <div className="mt-6 border-t pt-5 text-sm">
        <p className="font-medium">Don't have an account?</p>
        <p className="mt-0.5 text-muted-foreground">
          Ask your OJT coordinator for the registration link or QR code.
        </p>
      </div>
    </div>
  );
}

/** Lumalabas kapag sinabi ng login na hindi pa na-verify ang email */
function ResendVerification({ identifier }: { identifier: string }) {
  const isEmail = identifier.includes("@");
  const [email, setEmail] = useState(isEmail ? identifier : "");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState("");
  const cooldown = useCooldown();

  async function resend() {
    const value = email.trim();
    if (!value.includes("@")) {
      setDone("Enter the email you registered with.");
      return;
    }
    setSending(true);
    try {
      const res = await api.post<{ cooldown?: number }>("/enroll/resend", { email: value });
      cooldown.start(res.data.cooldown ?? 60);
      setDone("We sent a new link if your registration is still waiting. Check your inbox and Spam folder.");
    } catch (err) {
      setDone(getErrorMessage(err, "Couldn't send the link. Try again."));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3 text-sm">
      {!isEmail && (
        <Input
          type="email"
          inputMode="email"
          autoCapitalize="none"
          placeholder="The email you registered with"
          aria-label="Email for the verification link"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      )}
      <Button type="button" variant="outline" disabled={sending || cooldown.left > 0} onClick={() => void resend()}>
        <MailCheck className="h-4 w-4" />
        {sending ? "Sending..." : cooldown.left > 0 ? `Resend in ${cooldown.left}s` : "Resend verification email"}
      </Button>
      {done && <p className="text-xs text-muted-foreground">{done}</p>}
    </div>
  );
}
