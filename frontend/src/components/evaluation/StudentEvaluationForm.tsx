import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { CheckCircle2, Loader2, PencilLine, TriangleAlert } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { formatLongDate } from "@/lib/dates";
import { hasAnyScore, missingScores, toUpdate } from "@/lib/evaluationForm";
import type { EvaluationFormData } from "@/types/evaluation";
import { EvaluationForm } from "@/components/evaluation/EvaluationForm";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const AUTOSAVE_MS = 1000;

export interface StudentEvaluationHandle {
  /** Sine-save agad ang nakabinbin; nagba-bato ng error kapag pumalya */
  flush: () => Promise<void>;
}

interface Props {
  requirementId: number;
  canEdit: boolean;
  onScoresChange: (scores: { missing: string[]; any: boolean }) => void;
  ref?: Ref<StudentEvaluationHandle>;
}

/** Form ng student: kusang nase-save bilang draft sa server */
export function StudentEvaluationForm({ requirementId, canEdit, onScoresChange, ref }: Props) {
  const url = `/student/evaluations/${requirementId}`;
  const [form, setForm] = useState<EvaluationFormData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");

  const latest = useRef<EvaluationFormData | null>(null);
  const dirty = useRef(false);
  const timer = useRef<number | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<EvaluationFormData>(url)
      .then((res) => {
        if (cancelled) return;
        latest.current = res.data;
        setForm(res.data);
        setLoadError("");
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getErrorMessage(err, "Couldn't load the evaluation form."));
      });
    return () => {
      cancelled = true;
    };
  }, [url, reloadToken]);

  useEffect(() => {
    if (form) onScoresChange({ missing: missingScores(form), any: hasAnyScore(form) });
  }, [form, onScoresChange]);

  // Iisang save lang ang tumatakbo, at laging ang pinakahuling laman ang ipinapadala
  const persist = useCallback(async (): Promise<void> => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (inFlight.current) await inFlight.current.catch(() => undefined);

    while (dirty.current && latest.current) {
      dirty.current = false;
      setSaveState("saving");
      const request = api
        .put(url, toUpdate(latest.current))
        .then(() => {
          setSaveState("saved");
          setSaveError("");
        })
        .catch((err) => {
          dirty.current = true;
          setSaveState("error");
          setSaveError(getErrorMessage(err, "Couldn't save your scores."));
          throw err;
        })
        .finally(() => {
          inFlight.current = null;
        });
      inFlight.current = request;
      await request;
    }
  }, [url]);

  useImperativeHandle(ref, () => ({ flush: persist }), [persist]);

  // Huwag mawala ang huling tinype kapag umalis sa pahina
  useEffect(
    () => () => {
      if (dirty.current) void persist().catch(() => undefined);
    },
    [persist],
  );

  function change(next: EvaluationFormData) {
    latest.current = next;
    dirty.current = true;
    setForm(next);
    setSaveState("idle");
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void persist().catch(() => undefined);
    }, AUTOSAVE_MS);
  }

  if (loadError && !form) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
        {loadError}
        <Button type="button" variant="outline" size="sm" onClick={() => setReloadToken((t) => t + 1)}>
          Retry
        </Button>
      </div>
    );
  }
  if (!form) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-5 flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-live="polite">
        {form.editedBy && (
          <span className="mr-auto inline-flex items-center gap-1">
            <PencilLine className="h-3 w-3" />
            Edited by coordinator{form.editedAt ? ` · ${formatLongDate(form.editedAt)}` : ""}
          </span>
        )}
        {saveState === "saving" && (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving…
          </span>
        )}
        {saveState === "saved" && (
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Saved
          </span>
        )}
        {saveState === "error" && (
          <span className="inline-flex items-center gap-2 text-destructive">
            <TriangleAlert className="h-3 w-3" /> {saveError}
            <Button type="button" variant="outline" size="sm" onClick={() => void persist().catch(() => undefined)}>
              Retry
            </Button>
          </span>
        )}
      </div>
      <EvaluationForm value={form} onChange={change} readOnly={!canEdit} />
    </div>
  );
}
