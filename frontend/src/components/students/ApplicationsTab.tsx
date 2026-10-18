import { useCallback, useEffect, useState } from "react";
import { Check, Inbox, X } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import type { CoordinatorApplication, CoordinatorApplicationsData } from "@/types/companyApplications";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const BASE = "/coordinator/company-applications";

const CHIP: Record<string, string> = {
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  accepted: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  declined: "border-destructive/30 bg-destructive/10 text-destructive",
  cancelled: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

function name(a: CoordinatorApplication) {
  const mi = a.middleInitial ? ` ${a.middleInitial.replace(/\.?$/, ".")}` : "";
  return `${a.lastname}, ${a.firstname}${mi}`;
}

interface Props {
  semesterId: number;
  visible: boolean;
  onPendingChange: (count: number) => void;
  onChanged: () => void;
}

export function ApplicationsTab({ semesterId, visible, onPendingChange, onChanged }: Props) {
  const [data, setData] = useState<CoordinatorApplicationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [accepting, setAccepting] = useState<CoordinatorApplication | null>(null);
  const [declining, setDeclining] = useState<CoordinatorApplication | null>(null);
  const [reason, setReason] = useState("");
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<CoordinatorApplicationsData>(BASE, { params: { semesterId } });
      setData(res.data);
      onPendingChange(res.data.pendingCount);
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't load the applications."));
    } finally {
      setLoading(false);
    }
  }, [semesterId, onPendingChange]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!visible) return;
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [visible, load]);

  async function accept(a: CoordinatorApplication) {
    setBusyId(a.id);
    try {
      await api.patch(`${BASE}/${a.id}/accept`);
      notify.success(`${a.firstname} is now deployed at ${a.companyName}.`);
      setAccepting(null);
      await load();
      onChanged();
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't accept the application."));
    } finally {
      setBusyId(null);
    }
  }

  async function decline() {
    if (!declining || !reason.trim()) return;
    setBusyId(declining.id);
    try {
      await api.patch(`${BASE}/${declining.id}/decline`, { reason: reason.trim() });
      notify.success(`Declined. ${declining.firstname} will see your reason.`);
      setDeclining(null);
      setReason("");
      await load();
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't decline the application."));
    } finally {
      setBusyId(null);
    }
  }

  const all = data?.applications ?? [];
  const pending = all.filter((a) => a.status === "pending");
  const done = all.filter((a) => a.status !== "pending");
  const shown = showDone ? all : pending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {pending.length === 0
            ? "No pending applications."
            : `${pending.length} pending application${pending.length === 1 ? "" : "s"} to review`}
        </p>
        {done.length > 0 && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setShowDone((v) => !v)}>
            {showDone ? "Show pending only" : `Show reviewed (${done.length})`}
          </Button>
        )}
      </div>

      {loading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!loading && shown.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </span>
          <p className="text-sm text-muted-foreground">
            Approved students who apply to a company will show up here.
          </p>
        </div>
      )}

      {!loading &&
        shown.map((a) => {
          const full = a.filled >= a.slots;
          return (
            <div key={a.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{name(a)}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.studentNumber}
                    {a.subjectCode ? ` · ${a.subjectCode}` : ""} · applied {new Date(a.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-medium capitalize",
                    CHIP[a.status],
                  )}
                >
                  {a.status}
                </span>
              </div>

              <p className="mt-3 text-sm">
                {a.companyName} <span className="text-muted-foreground">·</span> {a.departmentName}
                <span className={cn("ml-2 text-xs", full ? "text-destructive" : "text-muted-foreground")}>
                  {a.filled}/{a.slots} slots filled
                </span>
              </p>

              {a.status === "declined" && a.declineReason && (
                <p className="mt-3 rounded-md border border-destructive/20 bg-destructive/5 p-2 text-sm">
                  <span className="text-xs text-muted-foreground">Your reason (private to the student): </span>
                  {a.declineReason}
                </p>
              )}

              {a.status === "pending" && (
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId === a.id}
                    onClick={() => {
                      setReason("");
                      setDeclining(a);
                    }}
                  >
                    <X className="h-4 w-4" />
                    Decline
                  </Button>
                  <Button type="button" size="sm" disabled={busyId === a.id || full} onClick={() => setAccepting(a)}>
                    <Check className="h-4 w-4" />
                    Accept &amp; deploy
                  </Button>
                </div>
              )}
            </div>
          );
        })}

      <ConfirmDialog
        open={accepting !== null}
        title="Accept and deploy this student?"
        description={
          accepting
            ? `${accepting.firstname} ${accepting.lastname} will be placed in ${accepting.companyName} – ${accepting.departmentName} and marked Deployed. Their other pending applications will be cancelled.`
            : ""
        }
        confirmLabel="Accept & deploy"
        loading={busyId !== null}
        onConfirm={() => accepting && void accept(accepting)}
        onCancel={() => setAccepting(null)}
      />

      <Dialog open={declining !== null} onOpenChange={(o) => !o && setDeclining(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline this application</DialogTitle>
            <DialogDescription>
              Tell {declining?.firstname ?? "the student"} why. Only they can see this.
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="min-h-24 w-full rounded-md border bg-background p-2 text-sm"
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. This department already has enough interns, please apply to another."
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeclining(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={!reason.trim() || busyId !== null} onClick={() => void decline()}>
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
