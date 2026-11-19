import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock, Hourglass, Link2Off, Loader2, MailCheck, RotateCw } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { hideUrlToken, readUrlToken } from "@/lib/urlToken";
import { cn } from "@/lib/utils";
import { useCooldown } from "@/hooks/useCooldown";
import { AuthShell, StatusBlock } from "@/components/auth/AuthShell";
import { Button, buttonVariants } from "@/components/ui/button";

type Result =
  | "created"
  | "awaiting_approval"
  | "taken"
  | "already_verified"
  | "replaced"
  | "expired"
  | "invalid";

interface VerifyResponse {
  result: Result;
  firstName: string;
  college: string;
}

type Phase = "verifying" | "error" | Result;

/** Ang page ng link sa email: vine-verify agad pagbukas (isang beses lang ang tawag kahit StrictMode) */
export default function VerifyEmail() {
  const [token] = useState(readUrlToken);
  const [phase, setPhase] = useState<Phase>(token ? "verifying" : "invalid");
  const [data, setData] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState("");
  const started = useRef(false);

  const run = useCallback(() => {
    setPhase("verifying");
    api
      .post<VerifyResponse>("/enroll/verify", { token })
      .then((res) => {
        setData(res.data);
        setPhase(res.data.result);
      })
      .catch((err) => {
        setError(getErrorMessage(err, "We couldn't reach the server. Check your connection and try again."));
        setPhase("error");
      });
  }, [token]);

  useEffect(() => {
    hideUrlToken();
    if (!token || started.current) return;
    started.current = true;
    run();
  }, [token, run]);

  const name = data?.firstName ? `, ${data.firstName}` : "";
  const login = (
    <Link to="/login" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
      Log in
    </Link>
  );

  return (
    <AuthShell label="Email verification">
      {phase === "verifying" && (
        <StatusBlock icon={<Loader2 className="h-7 w-7 animate-spin" />} title="Verifying your email...">
          <p>This only takes a moment.</p>
        </StatusBlock>
      )}

      {phase === "error" && (
        <StatusBlock icon={<AlertTriangle className="h-7 w-7" />} tone="warning" title="Something went wrong">
          <p>{error}</p>
          <Button size="lg" className="w-full" onClick={run}>
            Try again
          </Button>
        </StatusBlock>
      )}

      {phase === "created" && (
        <StatusBlock icon={<CheckCircle2 className="h-7 w-7" />} tone="success" title="Your account is verified">
          <p>
            Welcome{name}! You can log in now with your <span className="font-medium text-foreground">email or Student ID</span>{" "}
            and the password you made.
          </p>
          <p className="text-xs">On your first login, you'll be asked to complete your profile.</p>
          {login}
        </StatusBlock>
      )}

      {phase === "already_verified" && (
        <StatusBlock icon={<CheckCircle2 className="h-7 w-7" />} tone="success" title="Already verified">
          <p>Your email is already verified. You can log in.</p>
          {login}
        </StatusBlock>
      )}

      {phase === "awaiting_approval" && (
        <StatusBlock icon={<Hourglass className="h-7 w-7" />} title="Email verified">
          <p>
            Thanks{name}! Your coordinator will now check your details and approve your account. We'll email you when
            it's ready.
          </p>
          <p className="text-xs">You can close this page.</p>
        </StatusBlock>
      )}

      {phase === "taken" && (
        <StatusBlock icon={<MailCheck className="h-7 w-7" />} tone="warning" title="Email verified, but...">
          <p>
            This Student ID or email is already registered, so we couldn't create your account yet. Your coordinator will
            check your registration. If this is a mistake, please contact them.
          </p>
        </StatusBlock>
      )}

      {(phase === "expired" || phase === "replaced") && (
        <ResendFromLink
          token={token}
          title={phase === "expired" ? "This link has expired" : "This link was replaced"}
          text={
            phase === "expired"
              ? "Verification links work for 24 hours. Get a new one below."
              : "We sent you a newer link. Open the most recent email from us, or get a new link below."
          }
        />
      )}

      {phase === "invalid" && (
        <StatusBlock icon={<Link2Off className="h-7 w-7" />} tone="danger" title="This link isn't valid">
          <p>
            It may be incomplete, or the registration was removed because it wasn't verified within 7 days. Register
            again using your coordinator's link or QR code.
          </p>
          <Link to="/login" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "w-full")}>
            Go to login
          </Link>
        </StatusBlock>
      )}
    </AuthShell>
  );
}

function ResendFromLink({ token, title, text }: { token: string; title: string; text: string }) {
  const cooldown = useCooldown();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function resend() {
    setSending(true);
    setError("");
    try {
      const res = await api.post<{ cooldown?: number }>("/enroll/verify/resend", { token });
      cooldown.start(res.data.cooldown ?? 60);
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't send a new link. Try again."));
    } finally {
      setSending(false);
    }
  }

  return (
    <StatusBlock icon={<Clock className="h-7 w-7" />} tone="warning" title={title}>
      <p>{text}</p>
      {sent && (
        <p className="rounded-lg bg-muted/60 p-3 text-foreground">
          If your registration is still waiting, we sent a new link to your email. Check your inbox and Spam folder.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-destructive">
          {error}
        </p>
      )}
      <Button size="lg" className="w-full" disabled={sending || cooldown.left > 0} onClick={() => void resend()}>
        <RotateCw className={cn("h-4 w-4", sending && "animate-spin")} />
        {sending ? "Sending..." : cooldown.left > 0 ? `Send again in ${cooldown.left}s` : "Send a new link"}
      </Button>
    </StatusBlock>
  );
}
