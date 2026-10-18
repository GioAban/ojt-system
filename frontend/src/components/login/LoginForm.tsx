import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  /**
   * Ang dati mong login logic. Mag-throw ng error kapag mali ang login;
   * ikaw ang bahala sa pag-save ng token at pag-redirect kapag tama.
   * identifier = email o Student ID.
   */
  onSubmit: (identifier: string, password: string) => Promise<void>;
}

/** Minimalist na login card: Email o Student ID + password */
export function LoginForm({ onSubmit }: Props) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError("Enter your email or Student ID and your password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onSubmit(identifier.trim(), password);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : getErrorMessage(err, "Wrong email, Student ID, or password."));
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
      <p className="mt-1 text-sm text-muted-foreground">Use your email or your Student ID.</p>

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

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Password</span>
          <div className="relative">
            <Input
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
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>

        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

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
        <p className="mt-0.5 text-muted-foreground">Contact your OJT coordinator. Forgot your password? They can reset it for you.</p>
      </div>
    </div>
  );
}
