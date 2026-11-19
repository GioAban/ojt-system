import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, CheckCircle2, ClipboardList, FileText, PenLine, Trash2, type LucideIcon } from "lucide-react";
import { discardDraft, type DraftKind, type PendingDraft } from "@/offline/drafts";
import { refreshSyncSummary, useSyncSummary } from "@/offline/syncSummary";
import { useConnection } from "@/offline/connection";
import { formatWhen } from "@/offline/format";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const ICON: Record<DraftKind, LucideIcon> = {
  weekly: ClipboardList,
  dtr: CalendarClock,
  report: FileText,
  signatories: PenLine,
};

/**
 * Listahan ng mga pagbabagong hindi pa naipapadala, bawat isa may Open at Discard.
 * Phase 1: ang mga draft (weekly, DTR, report, pirmahan), na nagsi-sync kapag binuksan habang online.
 */
export function SyncCenter({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { drafts, failed } = useSyncSummary();
  const { online } = useConnection();
  const [discarding, setDiscarding] = useState<PendingDraft | null>(null);
  const [busy, setBusy] = useState(false);

  async function discard() {
    if (!discarding) return;
    setBusy(true);
    await discardDraft(discarding.id);
    await refreshSyncSummary();
    setBusy(false);
    setDiscarding(null);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
          <SheetHeader className="border-b p-4">
            <SheetTitle>Sync center</SheetTitle>
            <SheetDescription>
              {online
                ? "Changes saved on this device are sent to your account."
                : "You're offline. These changes are saved on this device and will be sent when you're back online."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain p-4">
            {drafts.length === 0 && failed === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                </span>
                <p className="font-medium">All changes synced</p>
                <p className="max-w-xs text-sm text-muted-foreground">Nothing is waiting on this device.</p>
              </div>
            ) : (
              <>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Waiting to sync ({drafts.length})
                </p>
                <ul className="flex flex-col gap-2">
                  {drafts.map((d) => {
                    const Icon = ICON[d.kind];
                    return (
                      <li key={d.id} className="flex items-start gap-3 rounded-xl border bg-card p-3">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{d.label}</p>
                          {d.detail && <p className="break-words text-xs text-muted-foreground">{d.detail}</p>}
                          <p className="mt-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center rounded-full bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-700 dark:text-amber-300">
                              Waiting to sync
                            </span>
                            {d.updatedAt && <span className="ml-2">Changed {formatWhen(d.updatedAt)}</span>}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" render={<Link to={d.link} onClick={() => onOpenChange(false)} />} nativeButton={false}>
                              Open to sync
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDiscarding(d)}>
                              <Trash2 className="h-4 w-4" /> Discard
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-4 text-xs text-muted-foreground">
                  Drafts are sent automatically when you open them while online. Nothing here is deleted unless you
                  discard it.
                </p>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={discarding !== null}
        title="Discard this change?"
        description={`Your unsynced ${discarding?.label.toLowerCase() ?? "change"} on this device will be deleted. The copy in your account (if any) stays as it is.`}
        confirmLabel="Discard"
        loading={busy}
        onConfirm={() => void discard()}
        onCancel={() => setDiscarding(null)}
      />
    </>
  );
}
