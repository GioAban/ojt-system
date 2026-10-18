import { useCallback, useEffect, useState } from "react";
import { Building2, CheckCircle2, Lock, MapPin, Phone, Plus } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import type { StudentCompaniesData } from "@/types/studentProfile";
import type { CompanyOverview } from "@/types/companyApplications";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RequestCompanyDialog } from "@/components/students/RequestCompanyDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const PILL: Record<string, string> = {
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  approved: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  accepted: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  declined: "border-destructive/30 bg-destructive/10 text-destructive",
  cancelled: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

const LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  accepted: "Accepted",
  declined: "Declined",
  cancelled: "Cancelled",
};

function Pill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-medium",
        PILL[status] ?? PILL.cancelled,
      )}
    >
      {LABEL[status] ?? status}
    </span>
  );
}

export default function StudentCompanies() {
  const [data, setData] = useState<StudentCompaniesData | null>(null);
  const [overview, setOverview] = useState<CompanyOverview | null>(null);
  const [error, setError] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [presetCompany, setPresetCompany] = useState<{ id: number; name: string } | null>(null);
  const [applying, setApplying] = useState<{ departmentId: number; label: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .get<StudentCompaniesData>("/student/companies")
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err, "Couldn't load the companies.")));
    api
      .get<CompanyOverview>("/student/company/overview")
      .then((res) => setOverview(res.data))
      .catch(() => setOverview(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pendingDepts = new Set(
    (overview?.applications ?? []).filter((a) => a.status === "pending").map((a) => a.departmentId),
  );
  const pendingCount = pendingDepts.size;
  const maxApps = overview?.maxApplications ?? 3;
  const canApply = !!overview?.canApply;
  const atLimit = pendingCount >= maxApps;

  async function apply() {
    if (!applying) return;
    setBusy(true);
    try {
      await api.post("/student/company/applications", { departmentId: applying.departmentId });
      notify.success("Application sent. Your coordinator will review it.");
      setApplying(null);
      load();
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't send your application."));
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: number) {
    try {
      await api.delete(`/student/company/applications/${id}`);
      notify.success("Application cancelled.");
      load();
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't cancel the application."));
    }
  }

  function openRequest(company: { id: number; name: string } | null) {
    setPresetCompany(company);
    setRequesting(true);
  }

  return (
    <DashboardLayout>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">
            Companies and departments where you can do your OJT.
          </p>
        </div>
        {canApply && overview?.accepting && (
          <Button type="button" variant="outline" onClick={() => openRequest(null)}>
            <Plus className="h-4 w-4" />
            Can't find yours? Request it
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {overview?.deployed && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-600/30 bg-emerald-600/10 p-4 text-sm text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            You're deployed
            {overview.deployedCompany ? (
              <>
                {" "}
                at <strong>{overview.deployedCompany}</strong>
                {overview.deployedDepartment ? ` – ${overview.deployedDepartment}` : ""}
              </>
            ) : null}
            .
          </p>
        </div>
      )}

      {data && !data.canApply && !overview?.deployed && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            You can browse the companies now, but you can only apply once your status is <strong>Approved</strong>. Your
            current status: <strong>{data.status || "For Approval"}</strong>.
          </p>
        </div>
      )}

      {canApply && overview && !overview.accepting && (
        <p className="mb-4 rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
          Your coordinator isn't accepting requests for new companies right now.
        </p>
      )}

      {overview && overview.applications.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold">My applications</h2>
          <div className="flex flex-col gap-2">
            {overview.applications.map((a) => (
              <div key={a.id} className="rounded-xl border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {a.companyName} <span className="text-muted-foreground">·</span> {a.departmentName}
                  </p>
                  <div className="flex items-center gap-2">
                    <Pill status={a.status} />
                    {a.status === "pending" && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => void cancel(a.id)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
                {a.status === "declined" && a.declineReason && (
                  <p className="mt-2 rounded-md border border-destructive/20 bg-destructive/5 p-2 text-sm">
                    <span className="text-xs text-muted-foreground">Coordinator's note: </span>
                    {a.declineReason}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {overview && overview.requests.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold">My requests</h2>
          <div className="flex flex-col gap-2">
            {overview.requests.map((r) => (
              <div key={r.departmentId} className="rounded-xl border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {r.companyName} <span className="text-muted-foreground">·</span> {r.departmentName}
                  </p>
                  <Pill status={r.status} />
                </div>
                {r.status === "declined" && r.declineReason && (
                  <p className="mt-2 rounded-md border border-destructive/20 bg-destructive/5 p-2 text-sm">
                    <span className="text-xs text-muted-foreground">Coordinator's note: </span>
                    {r.declineReason}
                  </p>
                )}
                {r.status === "approved" && (
                  <p className="mt-1 text-xs text-muted-foreground">It's in the list below now. You can apply to it.</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {!data && !error && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      )}

      {data && data.companies.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <Building2 className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Your coordinator hasn't added any company yet.</p>
        </div>
      )}

      {data && data.companies.length > 0 && (
        <div className="flex flex-col gap-4">
          {canApply && atLimit && (
            <p className="text-xs text-muted-foreground">
              You have {maxApps} pending applications. Cancel one to apply to another.
            </p>
          )}
          {data.companies.map((c) => (
            <div key={c.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium">{c.name}</p>
                {canApply && overview?.accepting && (
                  <button
                    type="button"
                    className="text-xs text-primary underline"
                    onClick={() => openRequest({ id: c.id, name: c.name })}
                  >
                    Request another department
                  </button>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {c.address}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {c.contactNumber}
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {c.departments.map((d) => {
                  const open = Math.max(0, d.slots - d.filled);
                  const applied = pendingDepts.has(d.id);
                  return (
                    <div
                      key={d.id}
                      className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate">{d.name}</p>
                        <p
                          className={
                            open > 0
                              ? "text-xs text-emerald-700 dark:text-emerald-400"
                              : "text-xs text-muted-foreground"
                          }
                        >
                          {open > 0 ? `${open} slot${open === 1 ? "" : "s"} open` : "Full"}
                        </p>
                      </div>
                      {canApply &&
                        (applied ? (
                          <Pill status="pending" />
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            disabled={open === 0 || atLimit}
                            onClick={() =>
                              setApplying({ departmentId: d.id, label: `${c.name} – ${d.name}` })
                            }
                          >
                            Apply
                          </Button>
                        ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <RequestCompanyDialog
        open={requesting}
        onOpenChange={setRequesting}
        presetCompany={presetCompany}
        onSent={load}
      />

      <ConfirmDialog
        open={applying !== null}
        title="Apply to this department?"
        description={`${applying?.label ?? ""}. Your coordinator will review your application. You can have up to ${maxApps} pending applications.`}
        confirmLabel="Apply"
        loading={busy}
        onConfirm={() => void apply()}
        onCancel={() => setApplying(null)}
      />
    </DashboardLayout>
  );
}
