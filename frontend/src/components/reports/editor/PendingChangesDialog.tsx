import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Database, FileText, Loader2, Server, WifiOff } from "lucide-react";
import { notify } from "@/lib/notify";
import { commitApply, previewApply, problemsByKey, type ApplyPreviewRow } from "@/lib/reportWriteBack";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { PendingChange, ReportOnlyNote, ReportSource } from "@/types/reports";

/**
 * save: mula sa "Save changes to database" (Confirm / Cancel; mananatili ang Edit mode)
 * exit: pinapatay ang Edit mode na may naghihintay (Save / Discard / Keep editing)
 * leave: aalis sa page o magbubukas ng ibang report (Save / Discard / Keep editing)
 */
export type ReviewMode = "save" | "exit" | "leave";

interface PendingChangesDialogProps {
  open: boolean;
  mode: ReviewMode;
  reportId: number;
  /** Isusulat sa system */
  changes: PendingChange[];
  /** Mga edit sa report lang ngayong Edit mode (naka-save na sa report) */
  reportOnly: ReportOnlyNote[];
  /** Cancel o Keep editing */
  onCancel: () => void;
  /** Itapon ang mga pagbabago sa system (ang edit sa report lang ay naiiwan) */
  onDiscard: () => void;
  /**
   * Naisulat na ang mga pumasa. saved: ang naisulat; problems: key -> error ng mga hindi naisulat
   * (naiiwan silang naghihintay at may marka ang cell).
   */
  onSaved: (source: ReportSource, saved: PendingChange[], problems: Record<string, string>) => void;
}

/**
 * Buod bago isulat sa database. Dalawang pangkat: "Will update the system" (sinusuri ng server; lumang halaga,
 * bagong halaga, ilan ang apektado) at "This report only" (naka-save na sa report). Walang naisusulat bago ang Confirm.
 */
export function PendingChangesDialog(props: PendingChangesDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={(open) => { if (!open) props.onCancel(); }}>
      {props.open && <Body {...props} />}
    </Dialog>
  );
}

function Body({ mode, reportId, changes, reportOnly, onCancel, onDiscard, onSaved }: PendingChangesDialogProps) {
  const [rows, setRows] = useState<ApplyPreviewRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [attempt, setAttempt] = useState(0);
  const hasSystem = changes.length > 0;

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    if (!online || !hasSystem) return;
    let cancelled = false;
    previewApply(reportId, changes)
      .then((res) => { if (!cancelled) { setRows(res.rows); setFailed(false); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [reportId, changes, online, attempt, hasSystem]);

  const problemKeys = new Set((rows ?? []).filter((r) => r.problem && r.key).map((r) => r.key as string));
  const valid = changes.filter((c) => !problemKeys.has(c.key));
  const problems = rows?.filter((r) => r.problem) ?? [];
  const canSave = rows !== null && valid.length > 0 && online && !busy;

  async function save() {
    setBusy(true);
    try {
      // Ang mga pumasa lang ang ipinapadala; ang may problema ay naiiwang naghihintay
      const outcome = await commitApply(reportId, valid);
      if (outcome.kind === "blocked") {
        // Nagbago ang system habang bukas ito: walang naisulat; ipakita ang mga bagong problema
        const byKey = new Map(outcome.rows.filter((r) => r.key).map((r) => [r.key as string, r]));
        setRows((cur) => (cur ?? []).map((r) => (r.key && byKey.has(r.key) ? (byKey.get(r.key) as ApplyPreviewRow) : r)));
        notify.error("Nothing was saved. Some records changed in the meantime; see the changes marked below.");
        return;
      }
      const left = rows ? problemsByKey(rows) : {};
      const leftCount = Object.keys(left).length;
      notify.success(
        `Saved ${valid.length} ${valid.length === 1 ? "change" : "changes"} to the database.`
        + (leftCount > 0 ? ` ${leftCount} ${leftCount === 1 ? "needs" : "need"} fixing.` : ""),
      );
      onSaved(outcome.source, valid, left);
    } catch {
      notify.error("Couldn't save the changes. Nothing was written. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const systemRows: ApplyPreviewRow[] = rows ?? changes.map((c) => ({
    key: c.key, who: c.who, field: c.label, oldValue: "", newValue: "", affected: 0, problem: null,
  }));
  const touched = rows?.filter((r) => !r.problem).reduce((n, r) => n + (r.affected || 0), 0) ?? 0;

  const title = mode === "save"
    ? "Save changes to database?"
    : mode === "exit"
      ? "Save your changes before turning off Edit mode?"
      : "Save your changes before you leave?";

  return (
    <DialogContent size="2xl" showCloseButton={false}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          Changes to real records are written only when you confirm. Report-only edits are already saved in this report.
        </DialogDescription>
      </DialogHeader>

      <DialogBody className="flex flex-col gap-5">
        <section className="flex flex-col gap-2" aria-labelledby="sum-system">
          <h3 id="sum-system" className="inline-flex items-center gap-2 text-sm font-semibold">
            <Server className="h-4 w-4" /> Will update the system ({changes.length})
          </h3>

          {!hasSystem && <p className="text-sm text-muted-foreground">No changes to real records.</p>}
          {hasSystem && !online && (
            <Alert>
              <WifiOff className="h-4 w-4" />
              <AlertDescription>You're offline. These changes are kept in this report. Save once you're back online.</AlertDescription>
            </Alert>
          )}
          {hasSystem && online && failed && (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                Couldn't check these changes.
                <Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
              </AlertDescription>
            </Alert>
          )}
          {hasSystem && online && !failed && rows === null && (
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking the changes...
            </p>
          )}
          {problems.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {problems.length} {problems.length === 1 ? "change needs" : "changes need"} fixing and won't be saved.
                {valid.length > 0
                  ? ` The other ${valid.length} will be saved.`
                  : " Fix them in the report, then save again."}
              </AlertDescription>
            </Alert>
          )}

          {hasSystem && (
            <ul className="flex flex-col gap-2">
              {systemRows.map((r, i) => (
                <li key={r.key ?? i} className={`rounded-lg border p-3 text-sm ${r.problem ? "border-destructive/50 bg-destructive/5" : ""}`}>
                  <p className="font-medium break-words">{r.who || "Record"}</p>
                  <p className="text-xs text-muted-foreground">{r.field}</p>
                  {rows && (
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 break-words">
                      <span className="text-muted-foreground line-through decoration-muted-foreground/50">{r.oldValue || "(blank)"}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="font-medium">{r.newValue || "(blank)"}</span>
                    </p>
                  )}
                  {rows && !r.problem && r.affected > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Affects {r.affected} {r.affected === 1 ? "student" : "students"}
                    </p>
                  )}
                  {rows && !r.problem && r.affected === 0 && r.who.startsWith("Signatories") && (
                    <p className="mt-1 text-xs text-muted-foreground">Applies to all your reports</p>
                  )}
                  {r.problem && <p className="mt-1 text-xs text-destructive">{r.problem}</p>}
                </li>
              ))}
            </ul>
          )}
          {rows && valid.length > 0 && touched > valid.length && (
            <p className="text-xs text-muted-foreground">In total these changes affect {touched} student records.</p>
          )}
        </section>

        <section className="flex flex-col gap-2" aria-labelledby="sum-report">
          <h3 id="sum-report" className="inline-flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4" /> This report only ({reportOnly.length})
          </h3>
          {reportOnly.length === 0 ? (
            <p className="text-sm text-muted-foreground">No report-only edits in this session.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Already saved in this report and used for print, PDF and Excel. They don't change the database.
                Use Reset to system value on a cell to undo one.
              </p>
              <ul className="flex flex-col gap-2">
                {reportOnly.map((n) => (
                  <li key={n.key} className="rounded-lg border bg-amber-500/5 p-3 text-sm">
                    <p className="font-medium break-words">{n.label}</p>
                    {n.who && <p className="text-xs text-muted-foreground break-words">{n.who}</p>}
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 break-words">
                      {n.system !== null && (
                        <>
                          <span className="text-muted-foreground">{n.system || "(blank)"}</span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        </>
                      )}
                      <span className="font-medium">{n.value || "(blank)"}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </DialogBody>

      <DialogFooter>
        {mode === "save" ? (
          <>
            <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Cancel</Button>
            <Button type="button" disabled={!canSave} onClick={() => void save()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Confirm
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="ghost" className="sm:mr-auto" disabled={busy} onClick={onDiscard}>
              Discard
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Keep editing</Button>
            <Button type="button" disabled={!canSave} onClick={() => void save()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Save changes to database
            </Button>
          </>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
