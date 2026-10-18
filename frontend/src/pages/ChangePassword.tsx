import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { markPasswordOk } from "@/lib/studentSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Ipinipilit sa student pagkatapos mag-login gamit ang temporary password */
export default function ChangePassword() {
  const navigate = useNavigate();
  const loggedIn = Boolean(localStorage.getItem("token"));
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (next.length < 8) return setError("New password must be at least 8 characters.");
    if (next !== confirm) return setError("The new passwords don't match.");
    if (next === current) return setError("Choose a password different from the temporary one.");

    setSaving(true);
    try {
      await api.post("/student/change-password", { currentPassword: current, newPassword: next });
      notify.success("Password changed.");
      markPasswordOk();
      navigate("/student/home", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't change the password."));
    } finally {
      setSaving(false);
    }
  }

  if (!loggedIn) return <Navigate to="/login" replace />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <form onSubmit={submit} noValidate className="flex w-full max-w-sm flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold">Set your own password</h1>
          <p className="text-sm text-muted-foreground">
            You logged in with a temporary password. Choose a new one before you continue.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Temporary password</span>
          <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">New password</span>
          <Input type="password" autoComplete="new-password" maxLength={72} value={next} onChange={(e) => setNext(e.target.value)} />
          <span className="text-xs text-muted-foreground">At least 8 characters.</span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Confirm new password</span>
          <Input type="password" autoComplete="new-password" maxLength={72} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={saving || !current || !next || !confirm}>
          {saving ? "Saving..." : "Change password"}
        </Button>
      </form>
    </main>
  );
}
