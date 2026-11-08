import { useCallback, useEffect, useState } from "react";
import { Check, Inbox, X } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import type {
  CompanyRequestRow,
  CompanyRequestsData,
  RequestStatus,
} from "@/types/companyRequest";
import { notifyCompanyRequestsChanged } from "@/hooks/usePendingCompanyRequests";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  CompanyRequestLinkCard,
  type CompanyLinkState,
} from "@/components/companies/CompanyRequestLinkCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

const BASE = "/coordinator/company-requests";

const CHIP: Record<RequestStatus, string> = {
  pending:
    "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  approved:
    "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  declined: "border-destructive/30 bg-destructive/10 text-destructive",
};
const LABEL: Record<RequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  declined: "Declined",
};

function deptLabel(r: CompanyRequestRow) {
  return r.departmentName && r.departmentName.trim() ? r.departmentName : "N/A";
}

function studentName(r: CompanyRequestRow) {
  if (!r.lastname && !r.firstname) return "a student";
  const mi = r.middleInitial ? ` ${r.middleInitial.replace(/\.?$/, ".")}` : "";
  return `${r.lastname ?? ""}, ${r.firstname ?? ""}${mi}`;
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="break-words text-sm">{value}</dd>
    </div>
  );
}

interface Props {
  semesterId: number | null;
  data: CompanyRequestsData | null;
  loading: boolean;
  onChanged: () => Promise<void> | void;
}

function byCompany(r: CompanyRequestRow) {
  return r.source === "company_link";
}

function whoRequested(r: CompanyRequestRow) {
  if (byCompany(r)) return "Submitted by the company through your link";
  if (r.source === "coordinator") return "Added by you";
  return `Requested by ${studentName(r)}${
    r.studentNumber
      ? ` (${r.studentNumber}${r.subjectCode ? ` · ${r.subjectCode}` : ""})`
      : ""
  }`;
}

export function RequestsPanel({ semesterId, data, loading, onChanged }: Props) {
  const [link, setLink] = useState<CompanyLinkState | null>(null);
  const [linkFailed, setLinkFailed] = useState(false);

  const loadLink = useCallback(async () => {
    if (semesterId == null) return;
    try {
      const res = await api.get<CompanyLinkState>(`${BASE}/link`, {
        params: { semesterId },
      });
      setLink(res.data);
      setLinkFailed(false);
    } catch {
      setLinkFailed(true);
    }
  }, [semesterId]);

  useEffect(() => {
    setLink(null);
    setLinkFailed(false);
    void loadLink();
  }, [loadLink]);

  useEffect(() => {
    setLink(null);
    void loadLink();
  }, [loadLink]);

  const [busyId, setBusyId] = useState<number | null>(null);
  const [approving, setApproving] = useState<CompanyRequestRow | null>(null);
  const [declining, setDeclining] = useState<CompanyRequestRow | null>(null);
  const [reason, setReason] = useState("");

  const requests = data?.requests ?? [];
  const pending = requests.filter((r) => r.status === "pending");
  const shown = pending;

  async function after() {
    await onChanged();
    notifyCompanyRequestsChanged();
  }

  async function approve(r: CompanyRequestRow) {
    setBusyId(r.departmentId);
    try {
      await api.patch(`${BASE}/${r.departmentId}/approve`);
      notify.success(
        `${r.companyName} – ${deptLabel(r)} was approved and added to the list.`,
      );
      setApproving(null);
      await after();
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't approve the request."));
    } finally {
      setBusyId(null);
    }
  }

  async function submitDecline() {
    if (!declining) return;
    const text = reason.trim();
    if (!text) return;
    setBusyId(declining.departmentId);
    try {
      await api.patch(`${BASE}/${declining.departmentId}/decline`, {
        reason: text,
      });
      notify.success(
        declining.studentId
          ? `The request was declined. ${declining.firstname ?? "The student"} will see your reason.`
          : "The request was declined.",
      );
      setDeclining(null);
      setReason("");
      await after();
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't decline the request."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {semesterId !== null && (
        <CompanyRequestLinkCard
          semesterId={semesterId}
          state={link}
          failed={linkFailed}
          onChange={setLink}
        />
      )}

      <p className="text-sm text-muted-foreground">
        {pending.length === 0
          ? "No pending requests."
          : `${pending.length} pending request${pending.length === 1 ? "" : "s"} to review`}
      </p>

      {loading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!loading && shown.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </span>
          <p className="text-sm text-muted-foreground">No pending requests.</p>
        </div>
      )}

      {!loading &&
        shown.map((r) => (
          <div key={r.departmentId} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {r.companyName}{" "}
                  <span className="text-muted-foreground">·</span>{" "}
                  {deptLabel(r)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {whoRequested(r)}
                  {r.newCompany
                    ? " · new company"
                    : " · new department in an existing company"}
                  {byCompany(r) && r.consentAt
                    ? ` · agreed to the Data Privacy Notice on ${new Date(r.consentAt).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex h-5 items-center rounded-md border px-1.5 text-xs font-medium",
                  CHIP[r.status],
                )}
              >
                {LABEL[r.status]}
              </span>
            </div>

            <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Address" value={r.address} />
              <Field label="Company number" value={r.contactNumber} />
              <Field label="Location" value={r.location} />
              <Field
                label={byCompany(r) ? "Contact person" : "Supervisor"}
                value={r.supervisorFullname}
              />
              <Field label="Position" value={r.supervisorPosition} />
              <Field
                label={byCompany(r) ? "Contact email" : "Supervisor email"}
                value={r.supervisorEmail}
              />
              <Field
                label={
                  byCompany(r) ? "Contact person number" : "Supervisor contact"
                }
                value={r.supervisorContactNumber}
              />
            </dl>

            {r.status === "declined" && r.declineReason && (
              <p className="mt-3 rounded-md border border-destructive/20 bg-destructive/5 p-2 text-sm">
                <span className="text-xs text-muted-foreground">
                  {r.studentId
                    ? "Your reason (private to the student): "
                    : "Your reason (kept in your records): "}
                </span>
                {r.declineReason}
              </p>
            )}

            {r.status === "pending" && (
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === r.departmentId}
                  onClick={() => {
                    setReason("");
                    setDeclining(r);
                  }}
                >
                  <X className="h-4 w-4" />
                  Decline
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busyId === r.departmentId}
                  onClick={() => setApproving(r)}
                >
                  <Check className="h-4 w-4" />
                  Approve
                </Button>
              </div>
            )}
          </div>
        ))}

      <ConfirmDialog
        open={approving !== null}
        title="Approve this request?"
        description={
          approving
            ? `${approving.companyName} – ${deptLabel(approving)} will be added to your list${
                approving.studentId
                  ? ` and ${approving.firstname ?? "the student"} will be notified`
                  : ""
              }.`
            : ""
        }
        confirmLabel="Approve"
        loading={busyId !== null}
        onConfirm={() => approving && void approve(approving)}
        onCancel={() => setApproving(null)}
      />

      <Dialog
        open={declining !== null}
        onOpenChange={(open) => {
          if (!open && busyId === null) setDeclining(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline this request?</DialogTitle>
            <DialogDescription>
              {declining
                ? declining.studentId
                  ? `${declining.companyName} – ${deptLabel(declining)}. Only ${declining.firstname ?? "the student"} will see your reason.`
                  : `${declining.companyName} – ${deptLabel(declining)}. The company isn't notified, so contact them yourself if needed.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="Reason (e.g. we already have this company, or not related to our program)"
            className="w-full rounded-md border bg-background p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeclining(null)}
              disabled={busyId !== null}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void submitDecline()}
              disabled={!reason.trim() || busyId !== null}
            >
              Decline request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
