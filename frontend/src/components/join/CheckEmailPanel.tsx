import { useState } from "react";
import { Link } from "react-router-dom";
import { MailCheck, RotateCw } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useCooldown } from "@/hooks/useCooldown";
import { Button, buttonVariants } from "@/components/ui/button";

interface Props {
  email: string;
  firstName: string;
  /** Bumalik sa form para ayusin ang email (nananatili ang ibang detalye) */
  onFixEmail: () => void;
}

/** Pagkatapos mag-register: "Check your email" na may Resend (may cooldown) */
export function CheckEmailPanel({ email, firstName, onFixEmail }: Props) {
  // Kapapadala lang ng unang link
  const cooldown = useCooldown(60);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function resend() {
    setSending(true);
    setError("");
    setNote("");
    try {
      const res = await api.post<{ cooldown?: number }>("/enroll/resend", { email });
      cooldown.start(res.data.cooldown ?? 60);
      setNote("If your registration is still waiting, we sent a new link. Only the newest link works.");
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't send the link. Check your connection and try again."));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center" role="status" aria-live="polite">
      <div className="rounded-full bg-primary/10 p-3 text-primary">
        <MailCheck className="h-7 w-7" />
      </div>
      <h1 className="text-lg font-semibold">Check your email</h1>
      <p className="text-sm text-muted-foreground">
        Thanks{firstName ? `, ${firstName}` : ""}! We sent a link to
        <span className="mt-1 block break-all font-medium text-foreground">{email}</span>
      </p>
      <p className="text-sm text-muted-foreground">Open it to verify your email and finish creating your account.</p>

      <ul className="w-full rounded-lg bg-muted/50 px-4 py-3 text-left text-xs text-muted-foreground">
        <li>• Can't find it? Check your Spam or Promotions folder.</li>
        <li>• The link works once and expires in 24 hours.</li>
        <li>• Registrations that aren't verified are removed after 7 days.</li>
      </ul>

      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {error && (
        <p role="alert" className="w-full rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        type="button"
        size="lg"
        variant="outline"
        className="w-full"
        disabled={sending || cooldown.left > 0}
        onClick={() => void resend()}
      >
        <RotateCw className={cn("h-4 w-4", sending && "animate-spin")} />
        {sending ? "Sending..." : cooldown.left > 0 ? `Resend link in ${cooldown.left}s` : "Resend link"}
      </Button>
      <Link to="/login" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
        Go to login
      </Link>
      <button
        type="button"
        onClick={onFixEmail}
        className="py-1 text-sm text-primary underline underline-offset-2"
      >
        Wrong email? Fix it and register again
      </button>
    </div>
  );
}
