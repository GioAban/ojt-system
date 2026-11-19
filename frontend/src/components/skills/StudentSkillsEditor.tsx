import { useEffect, useId, useState } from "react";
import { Sparkles } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { skillKey } from "@/lib/skills";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SkillsInput } from "./SkillsInput";

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((s, i) => skillKey(s) === skillKey(b[i]) && s === b[i]);

/**
 * Skills ng student na nae-edit. Ginagamit sa Profile (card) at sa Companies (bar).
 * Ang `endpoint` ay "/student/skills" para sa student o "/coordinator/skills/students/{id}" para sa coordinator.
 */
export function StudentSkillsEditor({
  endpoint, searchUrl, variant = "card", title = "Skills", description, onSaved, className,
}: {
  endpoint: string;
  searchUrl: string;
  variant?: "card" | "bar" | "plain";
  title?: string;
  description?: string;
  /** Tinatawag pagka-load at pagka-save, para sa pagtutugma sa companies */
  onSaved?: (skills: string[]) => void;
  className?: string;
}) {
  const inputId = useId();
  const helpId = useId();
  const [saved, setSaved] = useState<string[] | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get<{ skills: string[] }>(endpoint)
      .then((res) => {
        if (cancelled) return;
        setSaved(res.data.skills);
        setDraft(res.data.skills);
        onSaved?.(res.data.skills);
      })
      .catch((err) => { if (!cancelled) setLoadError(getErrorMessage(err, "Couldn't load the skills.")); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isang beses lang kada endpoint
  }, [endpoint]);

  const dirty = saved !== null && !sameList(saved, draft);

  async function save() {
    setBusy(true);
    try {
      const res = await api.put<{ skills: string[] }>(endpoint, { skills: draft });
      setSaved(res.data.skills);
      setDraft(res.data.skills);
      onSaved?.(res.data.skills);
      notify.success("Skills saved.");
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't save the skills."));
    } finally {
      setBusy(false);
    }
  }

  const body = (
    <>
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <label htmlFor={inputId} className="text-sm font-semibold">{title}</label>
          <p id={helpId} className="text-xs text-muted-foreground">
            {description ?? "Add what you can do, like Excel, Photoshop or Customer service. Press Enter or a comma after each one."}
          </p>
        </div>
      </div>
      <div className="mt-3">
        {saved === null && !loadError && <Skeleton className="h-10 w-full" />}
        {loadError && <p className="text-sm text-destructive">{loadError}</p>}
        {saved !== null && (
          <SkillsInput id={inputId} value={draft} onChange={setDraft} searchUrl={searchUrl} disabled={busy}
            aria-describedby={helpId} collapseAfter={variant === "bar" ? 6 : 10} />
        )}
      </div>
      {dirty && (
        <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" disabled={busy} onClick={() => setDraft(saved ?? [])}>Discard</Button>
          <Button type="button" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save skills"}
          </Button>
        </div>
      )}
    </>
  );

  if (variant === "plain") return <div className={className}>{body}</div>;
  return (
    <section className={cn("rounded-xl border bg-card p-4", variant === "bar" && "bg-muted/30", className)}>
      {body}
    </section>
  );
}
