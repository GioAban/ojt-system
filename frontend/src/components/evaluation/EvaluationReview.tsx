import { useEffect, useImperativeHandle, useState, type Ref } from "react";
import { PencilLine, TriangleAlert } from "lucide-react";
import api from "@/lib/api";
import { formatLongDate } from "@/lib/dates";
import { getErrorMessage } from "@/lib/errors";
import { hasAnyScore, missingScores, toUpdate } from "@/lib/evaluationForm";
import { notify } from "@/lib/notify";
import type { EvaluationFormData, EvaluationReviewData } from "@/types/evaluation";
import type { SubmissionFile } from "@/types/requirements";
import type { TrackingStatus } from "@/types/tracking";
import { EvaluationForm } from "@/components/evaluation/EvaluationForm";
import { SignedCopyViewer } from "@/components/evaluation/SignedCopyViewer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export interface EvaluationReviewHandle {
  /** Sine-save ang mga pagbabago kung meron; nagba-bato ng error kapag pumalya */
  saveIfDirty: () => Promise<void>;
}

interface Props {
  requirementId: number;
  studentId: number;
  /** Ang naka-save na status: naka-lock ang form kapag Checked */
  status: TrackingStatus;
  ref?: Ref<EvaluationReviewHandle>;
}

/** Signed copy sa tabi ng mga score na in-encode ng student; pwedeng iwasto ng coordinator */
export function EvaluationReview({ requirementId, studentId, status, ref }: Props) {
  const url = `/coordinator/evaluations/${requirementId}/students/${studentId}`;
  const [form, setForm] = useState<EvaluationFormData | null>(null);
  const [files, setFiles] = useState<SubmissionFile[]>([]);
  const [loadError, setLoadError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<EvaluationReviewData>(url)
      .then((res) => {
        if (cancelled) return;
        setForm(res.data.form);
        setFiles(res.data.files);
        setLoadError("");
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getErrorMessage(err, "Couldn't load the evaluation."));
      });
    return () => {
      cancelled = true;
    };
  }, [url, reloadToken]);

  async function persist() {
    if (!form) return;
    setSaving(true);
    try {
      const res = await api.put<EvaluationReviewData>(url, toUpdate(form));
      setForm(res.data.form);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  useImperativeHandle(ref, () => ({
    saveIfDirty: async () => {
      if (dirty) await persist();
    },
  }));

  async function saveClicked() {
    try {
      await persist();
      notify.success("Scores saved.");
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't save the scores."));
    }
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

  const locked = status === "CHECKED";
  const missing = missingScores(form);
  const any = hasAnyScore(form);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <SignedCopyViewer requirementId={requirementId} files={files} />

      <section aria-label="Encoded scores" className="flex min-w-0 flex-col gap-3">
        {form.editedBy && (
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <PencilLine className="h-3.5 w-3.5" />
            Edited by coordinator: {form.editedBy}
            {form.editedAt ? ` · ${formatLongDate(form.editedAt)}` : ""}
          </p>
        )}
        {locked && (
          <p className="rounded-lg border bg-muted/50 p-2.5 text-xs text-muted-foreground">
            This is Checked, so the scores are locked. Change the status first to edit them.
          </p>
        )}
        {(!any || (any && missing.length > 0)) && (
          <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {any ? `Missing scores: ${missing.join(", ")}.` : "No scores encoded. You can type them from the signed copy."}
          </p>
        )}

        <EvaluationForm
          value={form}
          readOnly={locked}
          onChange={(next) => {
            setForm(next);
            setDirty(true);
          }}
        />

        {!locked && (
          <div className="flex justify-end">
            <Button type="button" variant="outline" disabled={!dirty || saving} onClick={() => void saveClicked()}>
              {saving ? "Saving…" : "Save scores"}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
