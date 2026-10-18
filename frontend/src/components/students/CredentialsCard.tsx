import { Copy } from "lucide-react";
import { notify } from "@/lib/notify";
import type { ApprovalResult } from "@/types/students";
import { Button } from "@/components/ui/button";

interface Props {
  result: ApprovalResult;
  onDone: () => void;
}

/** Login details na ibibigay ng coordinator sa student; isang beses lang makikita */
export function CredentialsCard({ result, onDone }: Props) {
  const message =
    `OJT System login\n` +
    `Email: ${result.email}\n` +
    `Default password: ${result.temporaryPassword}\n` +
    `Log in at: ${window.location.origin}/login\n` +
    `You will be asked to change your password right after you log in. Do not share it.`;

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify.success(done);
    } catch {
      notify.error("Couldn't copy. Select the text and copy it manually.");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
      <div>
        <p className="text-sm font-medium">Login details for {result.name}</p>
        <p className="text-xs text-muted-foreground">
          Share these with the student, or ask them to use the default password rule.
        </p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Email</dt>
        <dd className="break-all">{result.email}</dd>
        <dt className="text-muted-foreground">Password</dt>
        <dd className="flex items-center gap-1">
          <code className="rounded bg-background px-1.5 py-0.5 font-mono text-sm">{result.temporaryPassword}</code>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Copy password"
            onClick={() => void copy(result.temporaryPassword, "Password copied.")}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </dd>
      </dl>
      <p className="text-xs text-muted-foreground">The student must set their own password after logging in.</p>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => void copy(message, "Login details copied.")}>
          <Copy className="h-4 w-4" /> Copy login details
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}
