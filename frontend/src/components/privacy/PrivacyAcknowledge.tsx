import { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { usePrivacyInfo } from "@/lib/privacy";
import { Button } from "@/components/ui/button";

/**
 * Isang beses na pagkilala ng student sa Privacy Notice (inuulit kapag nagbago ang bersyon).
 * Para sa student lang; hindi ito ipinapakita sa staff.
 */
export function PrivacyAcknowledge({ onDone }: { onDone: () => void }) {
  const info = usePrivacyInfo();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function accept() {
    setSaving(true);
    setError("");
    try {
      await api.post("/student/privacy/acknowledge");
      onDone();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <div className="flex w-full max-w-lg flex-col gap-5 rounded-2xl border bg-card p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
          <div>
            <h1 className="text-lg font-semibold">Before you continue</h1>
            <p className="text-sm text-muted-foreground">Privacy Notice</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            This system keeps your profile, course, company, DTRs, weekly
            reports, evaluations and uploaded files.
          </p>
          <p>
            We use them only to monitor and evaluate your OJT and to make
            reports for the college and CHED. Only you, your coordinator, your
            program head and system administrators can see them.
          </p>
          <p>
            You can ask to see, correct or (where allowed) delete your data.
            Contact the Data Protection Officer at{" "}
            <span className="break-all font-medium text-foreground">{info.dpoEmail}</span>.
          </p>
          <p>
            <Link to="/privacy" className="text-primary underline underline-offset-2">
              Read the full Privacy Notice
            </Link>
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button onClick={() => void accept()} disabled={saving} className="w-full sm:w-auto sm:self-end">
          {saving ? "Saving..." : "I have read and understand"}
        </Button>
      </div>
    </div>
  );
}
