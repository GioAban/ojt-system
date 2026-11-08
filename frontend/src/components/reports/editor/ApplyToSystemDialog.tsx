import { useEffect, useState } from "react";
import { ArrowRight, Loader2, X } from "lucide-react";
import { notify } from "@/lib/notify";
import {
  commitApply, departmentOptions, previewApply, type ApplyItem, type ApplyPreviewRow,
} from "@/lib/reportWriteBack";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { ReportSource } from "@/types/reports";

const SELECT =
  "mt-1 block h-11 w-full rounded-md border bg-background px-3 text-base outline-none sm:h-9 md:text-sm focus-visible:ring-2 focus-visible:ring-ring";

interface ApplyToSystemDialogProps {
  reportId: number;
  items: ApplyItem[];
  source: ReportSource;
  onClose: () => void;
  onApplied: (source: ReportSource, items: ApplyItem[]) => void;
}

/**
 * Bago sumulat sa system: inililista ng server ang lumang halaga, bagong halaga at sino ang apektado.
 * Walang naisusulat hangga't hindi pinipindot ang Confirm, at lahat o wala ang napapalitan.
 */
export function ApplyToSystemDialog({ reportId, items: initial, source, onClose, onApplied }: ApplyToSystemDialogProps) {
  const [items, setItems] = useState(initial);
  const [rows, setRows] = useState<{ key: string; rows: ApplyPreviewRow[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const ready = items.filter((i) => i.value !== "");
  const requestKey = JSON.stringify(ready.map((i) => [i.key, i.value]));

  useEffect(() => {
    if (ready.length === 0) return;
    let cancelled = false;
    previewApply(reportId, ready)
      .then((res) => { if (!cancelled) { setRows({ key: requestKey, rows: res.rows }); setFailed(false); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
    // requestKey ang kumakatawan sa laman ng listahan
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, requestKey]);

  const current = rows?.key === requestKey ? rows.rows : null;
  const rowFor = (item: ApplyItem) => {
    const at = ready.indexOf(item);
    return at >= 0 ? current?.[at] ?? null : null;
  };
  const allGood = items.length > 0 && ready.length === items.length && current !== null
    && current.every((r) => r.problem === null);

  async function confirm() {
    setBusy(true);
    try {
      const outcome = await commitApply(reportId, items);
      if (outcome.kind === "blocked") {
        setRows({ key: requestKey, rows: outcome.rows });
        notify.error("Nothing was changed. Please review the problems listed.");
        return;
      }
      notify.success(`Updated ${items.length} ${items.length === 1 ? "record" : "records"} in the system.`);
      onApplied(outcome.source, items);
    } catch {
      notify.error("Couldn't apply the changes. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  const options = departmentOptions(source);

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Apply to system?</DialogTitle>
          <DialogDescription>
            These changes will update the real records, not just this report. Nothing is saved until you confirm.
          </DialogDescription>
        </DialogHeader>

        {failed && (
          <Alert variant="destructive">
            <AlertDescription>
              {navigator.onLine ? "Couldn't check these changes. Please try again." : "You need to be online to apply changes to the system."}
            </AlertDescription>
          </Alert>
        )}

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">There's nothing left to apply.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => {
              const row = rowFor(item);
              const affected = row?.affected ?? 0;
              return (
                <li key={item.key} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium break-words">{row?.who || item.who}</p>
                      <p className="text-xs text-muted-foreground">{row?.field ?? item.fieldLabel}</p>
                    </div>
                    <Button
                      type="button" variant="ghost" size="icon-sm" className="pointer-coarse:size-11"
                      aria-label={`Leave out ${item.who}`} title="Leave out of this update" disabled={busy}
                      onClick={() => setItems((all) => all.filter((x) => x !== item))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {item.field === "assignment" && (
                    <label className="mt-2 block text-xs font-medium text-muted-foreground">
                      Move to {item.wanted ? `(you typed “${item.wanted}”)` : ""}
                      <select
                        className={SELECT}
                        value={item.value}
                        disabled={busy}
                        onChange={(e) => {
                          const value = e.target.value;
                          setItems((all) => all.map((x) => (x === item ? { ...x, value } : x)));
                        }}
                      >
                        <option value="">Choose a department</option>
                        {options.map((o) => <option key={o.id} value={String(o.id)}>{o.label}</option>)}
                      </select>
                    </label>
                  )}

                  {row && (
                    <p className="mt-2 flex flex-wrap items-center gap-1.5 break-words">
                      <span className="text-muted-foreground">{row.oldValue || "(blank)"}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-label="becomes" />
                      <span className="font-medium">{row.newValue || "(blank)"}</span>
                    </p>
                  )}
                  {row && item.target === "department" && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                      Affects all {affected} {affected === 1 ? "student" : "students"} in this department.
                    </p>
                  )}
                  {row?.problem && <p className="mt-1 text-xs text-destructive">{row.problem}</p>}
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={!allGood || busy} onClick={() => void confirm()}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
