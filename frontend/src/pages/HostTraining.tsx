import { useMemo, useState } from "react";
import { Building2, Clock, Layers, Plus, Search, Users } from "lucide-react";
import api from "@/lib/api";
import { isApproved } from "@/lib/company";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useSemester } from "@/contexts/semesterContext";
import { useSectionData } from "@/hooks/useTracking";
import type {
  CompaniesData,
  CompanyItem,
  DepartmentItem,
  ListingRow,
} from "@/types/company";
import type { CompanyRequestsData } from "@/types/companyRequest";
import { CountBadge } from "@/components/companies/CountBadge";
import { RequestsPanel } from "@/components/companies/RequestsPanel";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTablePagination } from "@/components/DataTablePagination";
import { CompanyCard } from "@/components/companies/CompanyCard";
import { CompanyFormDialog } from "@/components/companies/CompanyFormDialog";
import { MoaFilesDialog } from "@/components/companies/MoaFilesDialog";
import { CompanyListing } from "@/components/companies/CompanyListing";
import { DepartmentFormDialog } from "@/components/companies/DepartmentFormDialog";
import { StatCard } from "@/components/companies/parts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";

type Tab = "companies" | "listing" | "requests";
type StatusFilter = "active" | "archived" | "all";
type ApprovalFilter = "all" | "approved" | "pending";
type SlotsFilter = "all" | "open" | "full";

interface ConfirmTarget {
  kind: "company" | "department";
  action: "archive" | "restore";
  id: number;
  label: string;
}

const TABS: { value: Tab; label: string }[] = [
  { value: "companies", label: "Companies" },
  { value: "listing", label: "Company & department list" },
  { value: "requests", label: "Requests" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
];

function companyText(c: CompanyItem) {
  return [
    c.name,
    c.address,
    c.location,
    c.nature,
    c.supervisorName,
    c.contactNumber,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function departmentText(d: DepartmentItem) {
  return [d.name, d.supervisorFullname, d.supervisorPosition, d.supervisorEmail]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function HostTraining() {
  const { semesterId, semester, loaded, error: semesterError } = useSemester();
  const { data, error, loading, reload, refresh } =
    useSectionData<CompaniesData>("/coordinator/companies", semesterId);

  const requestsSection = useSectionData<CompanyRequestsData>(
    "/coordinator/company-requests",
    semesterId,
  );
  const requestsPending = requestsSection.data?.pendingCount ?? 0;

  const [tab, setTab] = useState<Tab>("companies");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [natureId, setNatureId] = useState("");
  const [approval, setApproval] = useState<ApprovalFilter>("all");
  const [slotsFilter, setSlotsFilter] = useState<SlotsFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [companyForm, setCompanyForm] = useState<{
    company: CompanyItem | null;
  } | null>(null);
  const [deptForm, setDeptForm] = useState<{
    company: CompanyItem;
    department: DepartmentItem | null;
  } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmTarget | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [moaTarget, setMoaTarget] = useState<{
    companyId: number;
    departmentId: number;
  } | null>(null);

  const companies = useMemo(() => data?.companies ?? [], [data]);
  const natures = data?.natures ?? [];
  const q = search.trim().toLowerCase();
  const moaCompany = moaTarget
    ? (companies.find((c) => c.id === moaTarget.companyId) ?? null)
    : null;
  const moaDepartment = moaCompany
    ? (moaCompany.departments.find((d) => d.id === moaTarget?.departmentId) ??
      null)
    : null;

  // ---------- Mga bilang sa taas ----------
  const activeCompanies = companies.filter((c) => !c.archived);
  const activeDepartments = activeCompanies.flatMap((c) =>
    c.departments.filter((d) => !d.archived),
  );
  const totalSlots = activeDepartments.reduce((sum, d) => sum + d.slots, 0);
  const placed = activeDepartments.reduce((sum, d) => sum + d.filled, 0);
  const pendingCount = activeDepartments.filter(
    (d) => !isApproved(d.status),
  ).length;

  // ---------- Tab 1: mga company ----------
  const companyList = useMemo(() => {
    return companies.filter((c) => {
      if (status === "active" && c.archived) return false;
      if (status === "archived" && !c.archived) return false;
      if (natureId && String(c.natureId) !== natureId) return false;
      if (!q) return true;
      return (
        companyText(c).includes(q) ||
        c.departments.some((d) => departmentText(d).includes(q))
      );
    });
  }, [companies, status, natureId, q]);

  // ---------- Tab 2: isang row bawat company at department ----------
  const rows = useMemo(() => {
    const result: ListingRow[] = [];

    const statusOk = (archived: boolean) =>
      status === "all" || (status === "active" ? !archived : archived);

    for (const c of companies) {
      if (natureId && String(c.natureId) !== natureId) continue;

      if (c.departments.length === 0) {
        // Ang company na walang department ay walang approval o slots na maisasala
        if (approval !== "all" || slotsFilter !== "all") continue;
        if (!statusOk(c.archived)) continue;
        if (q && !companyText(c).includes(q)) continue;
        result.push({ key: `c-${c.id}`, company: c, department: null });
        continue;
      }

      for (const d of c.departments) {
        if (!statusOk(c.archived || d.archived)) continue;
        if (approval === "approved" && !isApproved(d.status)) continue;
        if (approval === "pending" && isApproved(d.status)) continue;
        if (slotsFilter === "open" && d.filled >= d.slots) continue;
        if (slotsFilter === "full" && d.filled < d.slots) continue;
        if (q && !companyText(c).includes(q) && !departmentText(d).includes(q))
          continue;

        result.push({ key: `d-${d.id}`, company: c, department: d });
      }
    }

    return result;
  }, [companies, status, natureId, approval, slotsFilter, q]);

  const total = tab === "companies" ? companyList.length : rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const companyPage = companyList.slice(start, start + pageSize);
  const rowPage = rows.slice(start, start + pageSize);

  const filtersActive =
    q !== "" ||
    natureId !== "" ||
    approval !== "all" ||
    slotsFilter !== "all" ||
    status !== "active";

  function resetFilters() {
    setSearch("");
    setStatus("active");
    setNatureId("");
    setApproval("all");
    setSlotsFilter("all");
    setPage(1);
  }

  // ---------- Mga aksyon ----------
  async function toggleApproval(
    company: CompanyItem,
    department: DepartmentItem,
  ) {
    const next = isApproved(department.status) ? "PENDING" : "APPROVED";

    try {
      await api.patch(
        `/coordinator/companies/departments/${department.id}/approval`,
        {
          status: next,
        },
      );
      notify.success(
        `${department.name ?? "Department"} of ${company.name} is now ${
          next === "APPROVED" ? "approved" : "pending"
        }.`,
      );
      await refresh();
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't update the approval."));
    }
  }

  async function handleConfirm() {
    if (!confirm) return;

    const base =
      confirm.kind === "company"
        ? "/coordinator/companies"
        : "/coordinator/companies/departments";

    setConfirming(true);
    try {
      await api.patch(`${base}/${confirm.id}/${confirm.action}`);
      notify.success(
        `${confirm.label} was ${confirm.action === "archive" ? "archived" : "restored"}.`,
      );
      await refresh();
    } catch (err) {
      notify.error(getErrorMessage(err, "Action failed."));
    } finally {
      setConfirming(false);
      setConfirm(null);
    }
  }

  function askCompany(company: CompanyItem) {
    setConfirm({
      kind: "company",
      action: company.archived ? "restore" : "archive",
      id: company.id,
      label: company.name,
    });
  }

  function askDepartment(company: CompanyItem, department: DepartmentItem) {
    setConfirm({
      kind: "department",
      action: department.archived ? "restore" : "archive",
      id: department.id,
      label: `${department.name ?? "Department"} (${company.name})`,
    });
  }

  const confirmCopy = confirm
    ? {
        title: `${confirm.action === "archive" ? "Archive" : "Restore"} this ${confirm.kind}?`,
        description:
          confirm.action === "archive"
            ? `${confirm.label} won't be available when assigning students. This is only allowed when no student is placed in it. You can restore it anytime.`
            : `${confirm.label} will be available again for placing students.`,
        label: confirm.action === "archive" ? "Archive" : "Restore",
      }
    : null;

  const noSemester = loaded && semesterId === null && !semesterError;
  const semesterName = semester?.semester ?? "";

  return (
    <DashboardLayout>
      <PageHeader
        title="Host Training Establishments"
        description={
          semesterName
            ? `Companies and departments where your students train in ${semesterName}.`
            : "Companies and departments where your students train."
        }
        actions={
          <Button
            type="button"
            disabled={semesterId === null}
            onClick={() => setCompanyForm({ company: null })}
          >
            <Plus className="h-4 w-4" />
            Add company
          </Button>
        }
      />

      {(semesterError || error) && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription className="flex items-center justify-between gap-4">
            {semesterError || error}
            <Button variant="outline" size="sm" onClick={reload}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {noSemester && (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No active semester found. Ask the director to add one.
        </p>
      )}

      {semesterId !== null && (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Building2}
              label="Companies"
              value={String(activeCompanies.length)}
            />
            <StatCard
              icon={Layers}
              label="Departments"
              value={String(activeDepartments.length)}
            />
            <StatCard
              icon={Users}
              label="Students placed"
              value={`${placed}/${totalSlots}`}
              hint={
                totalSlots > 0
                  ? `${Math.max(0, totalSlots - placed)} slots open`
                  : undefined
              }
            />
            <StatCard
              icon={Clock}
              label="Pending approval"
              value={String(pendingCount)}
              hint={pendingCount > 0 ? "Departments to review" : "All reviewed"}
              warn={pendingCount > 0}
            />
          </div>

          <nav className="mb-4 flex gap-1 border-b" aria-label="Views">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setTab(t.value);
                  setPage(1);
                }}
                className={cn(
                  "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  tab === t.value
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                {t.value === "requests" && (
                  <CountBadge count={requestsPending} className="ml-2" />
                )}
              </button>
            ))}
          </nav>

          {tab !== "requests" && (
            <>
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search company, department, supervisor..."
                      className="pl-9"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>

                  <NativeSelect
                    aria-label="Filter by nature"
                    value={natureId}
                    onChange={(e) => {
                      setNatureId(e.target.value);
                      setPage(1);
                    }}
                  >
                    <NativeSelectOption value="">
                      All natures
                    </NativeSelectOption>
                    {natures.map((n) => (
                      <NativeSelectOption key={n.id} value={String(n.id)}>
                        {n.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>

                  {tab === "listing" && (
                    <>
                      <NativeSelect
                        aria-label="Filter by approval"
                        value={approval}
                        onChange={(e) => {
                          setApproval(e.target.value as ApprovalFilter);
                          setPage(1);
                        }}
                      >
                        <NativeSelectOption value="all">
                          Any approval
                        </NativeSelectOption>
                        <NativeSelectOption value="approved">
                          Approved
                        </NativeSelectOption>
                        <NativeSelectOption value="pending">
                          Pending
                        </NativeSelectOption>
                      </NativeSelect>

                      <NativeSelect
                        aria-label="Filter by slots"
                        value={slotsFilter}
                        onChange={(e) => {
                          setSlotsFilter(e.target.value as SlotsFilter);
                          setPage(1);
                        }}
                      >
                        <NativeSelectOption value="all">
                          Any slots
                        </NativeSelectOption>
                        <NativeSelectOption value="open">
                          With open slots
                        </NativeSelectOption>
                        <NativeSelectOption value="full">
                          Full
                        </NativeSelectOption>
                      </NativeSelect>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {STATUS_OPTIONS.map((o) => (
                    <Button
                      key={o.value}
                      type="button"
                      size="sm"
                      variant={status === o.value ? "default" : "outline"}
                      onClick={() => {
                        setStatus(o.value);
                        setPage(1);
                      }}
                    >
                      {o.label}
                    </Button>
                  ))}
                </div>
              </div>

              {loading && (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              )}

              {!loading && !error && companies.length === 0 && (
                <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-20 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                    <Building2 className="h-7 w-7 text-muted-foreground" />
                  </span>
                  <div>
                    <p className="font-medium">
                      No host training establishments yet
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add a company and its departments, then place your
                      students in them.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setCompanyForm({ company: null })}
                  >
                    <Plus className="h-4 w-4" />
                    Add the first company
                  </Button>
                </div>
              )}

              {!loading && !error && companies.length > 0 && total === 0 && (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nothing matches your filters.
                  </p>
                  {filtersActive && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={resetFilters}
                    >
                      Reset filters
                    </Button>
                  )}
                </div>
              )}

              {!loading && total > 0 && tab === "companies" && (
                <>
                  <div className="flex flex-col gap-3">
                    {companyPage.map((c) => (
                      <CompanyCard
                        key={c.id}
                        company={c}
                        onEditCompany={() => setCompanyForm({ company: c })}
                        onArchiveCompany={() => askCompany(c)}
                        onAddDepartment={() =>
                          setDeptForm({ company: c, department: null })
                        }
                        onEditDepartment={(d) =>
                          setDeptForm({ company: c, department: d })
                        }
                        onToggleApproval={(d) => void toggleApproval(c, d)}
                        onArchiveDepartment={(d) => askDepartment(c, d)}
                      />
                    ))}
                  </div>

                  <div className="mt-3 rounded-xl border bg-card">
                    <DataTablePagination
                      page={currentPage}
                      pageSize={pageSize}
                      total={total}
                      pageSizeOptions={[5, 10, 20]}
                      onPageChange={setPage}
                      onPageSizeChange={(size) => {
                        setPageSize(size);
                        setPage(1);
                      }}
                    />
                  </div>
                </>
              )}

              {!loading && total > 0 && tab === "listing" && (
                <div className="isolate rounded-xl border bg-card">
                  <CompanyListing
                    rows={rowPage}
                    offset={start}
                    onEditCompany={(c) => setCompanyForm({ company: c })}
                    onArchiveCompany={askCompany}
                    onAddDepartment={(c) =>
                      setDeptForm({ company: c, department: null })
                    }
                    onEditDepartment={(c, d) =>
                      setDeptForm({ company: c, department: d })
                    }
                    onToggleApproval={(c, d) => void toggleApproval(c, d)}
                    onArchiveDepartment={askDepartment}
                    onManageMoa={(c, d) =>
                      setMoaTarget({ companyId: c.id, departmentId: d.id })
                    }
                  />

                  <DataTablePagination
                    page={currentPage}
                    pageSize={pageSize}
                    total={total}
                    pageSizeOptions={[10, 20, 50]}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                      setPageSize(size);
                      setPage(1);
                    }}
                  />
                </div>
              )}
            </>
          )}

          {tab === "requests" && (
            <RequestsPanel
              data={requestsSection.data}
              loading={requestsSection.loading}
              onChanged={requestsSection.refresh}
            />
          )}
        </>
      )}

      {companyForm && semesterId !== null && (
        <CompanyFormDialog
          key={companyForm.company?.id ?? "new"}
          open
          onOpenChange={(open) => {
            if (!open) setCompanyForm(null);
          }}
          company={companyForm.company}
          natures={natures}
          semesterId={semesterId}
          semesterName={semesterName}
          onSaved={(message) => {
            notify.success(message);
            void refresh();
          }}
        />
      )}

      {deptForm && (
        <DepartmentFormDialog
          key={`${deptForm.company.id}-${deptForm.department?.id ?? "new"}`}
          open
          onOpenChange={(open) => {
            if (!open) setDeptForm(null);
          }}
          companyId={deptForm.company.id}
          companyName={deptForm.company.name}
          department={deptForm.department}
          onSaved={(message) => {
            notify.success(message);
            void refresh();
          }}
        />
      )}

      {moaCompany && moaDepartment && (
        <MoaFilesDialog
          key={moaDepartment.id}
          open
          onOpenChange={(open) => {
            if (!open) setMoaTarget(null);
          }}
          companyName={moaCompany.name}
          department={moaDepartment}
          readOnly={moaCompany.archived || moaDepartment.archived}
          onChanged={refresh}
        />
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirmCopy?.title ?? ""}
        description={confirmCopy?.description ?? ""}
        confirmLabel={confirmCopy?.label ?? ""}
        loading={confirming}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </DashboardLayout>
  );
}
