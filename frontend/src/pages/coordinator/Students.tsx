import { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Building2,
  Eye,
  KeyRound,
  QrCode,
  SlidersHorizontal,
  Plus,
  Search,
  Upload,
  UserCheck,
  Users,
} from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { GENDERS, YEARS, required, validEmail, validNumber, validOptionalPhone } from "@/lib/students";
import { useSemester } from "@/contexts/semesterContext";
import { useSectionData } from "@/hooks/useTracking";
import type { StudentListData, StudentRow } from "@/types/students";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTablePagination } from "@/components/DataTablePagination";
import { StatCard } from "@/components/companies/parts";
import { EditableCell } from "@/components/tracking/EditableCell";
import { AddStudentPanel } from "@/components/students/AddStudentPanel";
import { AccountsTab } from "@/components/students/AccountsTab";
import { ApplicationsTab } from "@/components/students/ApplicationsTab";
import { ImportDialog } from "@/components/students/ImportDialog";
import { SelectCell } from "@/components/students/SelectCell";
import { StudentDrawer } from "@/components/students/StudentDrawer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const BASE = "/coordinator/student-management";

type StatusFilter = "active" | "archived" | "all";
type PlacementFilter = "all" | "placed" | "unplaced";
type AccountFilter = "all" | "with" | "without";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
];

const COL = { num: 48, number: 130, last: 160, first: 160, mi: 70, gender: 110, course: 110, year: 120, email: 230, contact: 150, company: 220, status: 150, actions: 120 } as const;

const HEAD = "px-2";
const CELL = "whitespace-normal px-1 py-1 align-top";

type Field =
  | "studentNumber" | "lastname" | "firstname" | "middleInitial" | "gender"
  | "year" | "course" | "contact" | "email" | "birthday" | "address";

const FIELD_LABELS: Record<Field, string> = {
  studentNumber: "Student ID",
  lastname: "Last name",
  firstname: "First name",
  middleInitial: "Middle initial",
  gender: "Gender",
  year: "Year",
  course: "Course",
  contact: "Contact",
  email: "Email",
  birthday: "Birthday",
  address: "Address",
};

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
        active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export default function Students() {
  const { semesterId, semester, loaded, error: semesterError } = useSemester();
  const { data, error, loading, reload, update, refresh } =
    useSectionData<StudentListData>(BASE, semesterId);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [year, setYear] = useState("");
  const [placement, setPlacement] = useState<PlacementFilter>("all");
  const [account, setAccount] = useState<AccountFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [showEmail, setShowEmail] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [tab, setTab] = useState<"students" | "accounts" | "applications">(() => {
    try {
      return new URLSearchParams(window.location.search).get("tab") === "applications" ? "applications" : "students";
    } catch {
      return "students";
    }
  });
  const [appCount, setAppCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<StudentRow | null>(null);
  const [confirming, setConfirming] = useState(false);

  const students = useMemo(() => data?.students ?? [], [data]);
  const q = search.trim().toLowerCase();

  const active = students.filter((s) => !s.archived);
  const placed = active.filter((s) => s.companyName).length;
  const archivedCount = students.length - active.length;
  const registered = active.filter((s) => s.registered).length;
  const minWidth = Object.entries(COL).reduce(
    (sum, [k, w]) => ((k === "email" && !showEmail) || (k === "contact" && !showContact) ? sum : sum + w),
    0,
  );

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (status === "active" && s.archived) return false;
      if (status === "archived" && !s.archived) return false;
      if (year && s.year !== year) return false;
      if (placement === "placed" && !s.companyName) return false;
      if (placement === "unplaced" && s.companyName) return false;
      if (account === "with" && !s.registered) return false;
      if (account === "without" && s.registered) return false;
      if (!q) return true;
      return [s.studentNumber, s.lastname, s.firstname, s.subjectCode, s.email, s.contact, s.companyName, s.address]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [students, status, year, placement, account, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * pageSize;
  const pageRows = filtered.slice(offset, offset + pageSize);

  function replaceRow(row: StudentRow) {
    update((d) => ({ ...d, students: d.students.map((s) => (s.id === row.id ? row : s)) }));
  }

  async function save(row: StudentRow, field: Field, value: string) {
    const res = await api.patch<StudentRow>(`${BASE}/${row.id}`, { field, value });
    replaceRow(res.data);
    notify.success(
      `${FIELD_LABELS[field]} updated for ${row.firstname} ${row.lastname}.`,
    );
  }

  async function toggleArchive() {
    if (!confirm) return;
    const archived = !confirm.archived;
    setConfirming(true);
    try {
      const res = await api.patch<StudentRow>(`${BASE}/${confirm.id}/archive`, null, {
        params: { archived },
      });
      replaceRow(res.data);
      notify.success(archived ? "Student archived." : "Student restored.");
      setConfirm(null);
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't update the student."));
    } finally {
      setConfirming(false);
    }
  }

  const noSemester = loaded && semesterId === null;
  const semesterName = semester?.semester ?? "";

  return (
    <DashboardLayout>
      <PageHeader
        title="Student Management"
        description={
          semesterName
            ? `Students of ${data?.programAbbreviation ?? "your program"} in ${semesterName}. Click any cell to edit.`
            : "Manage your students. Click any cell to edit."
        }
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={semesterId === null} onClick={() => setImporting(true)}>
              <Upload className="h-4 w-4" /> Import
            </Button>
            <Button type="button" disabled={semesterId === null} onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add student
            </Button>
          </div>
        }
      />

      {(semesterError || error) && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription className="flex items-center justify-between gap-4">
            {semesterError || error}
            <Button variant="outline" size="sm" onClick={reload}>Retry</Button>
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
          <div className="mb-5 flex gap-1 border-b" role="tablist" aria-label="Student management sections">
            <TabButton active={tab === "students"} onClick={() => setTab("students")}>
              <Users className="h-4 w-4" /> Students
            </TabButton>
            <TabButton active={tab === "accounts"} onClick={() => setTab("accounts")}>
              <KeyRound className="h-4 w-4" /> Accounts
              {pendingCount > 0 && (
                <span className="rounded-full bg-amber-500 px-1.5 text-xs font-medium text-white" aria-label={`${pendingCount} waiting`}>
                  {pendingCount}
                </span>
              )}
            </TabButton>
            <TabButton active={tab === "applications"} onClick={() => setTab("applications")}>
              <Building2 className="h-4 w-4" /> Company applications
              {appCount > 0 && (
                <span className="rounded-full bg-amber-500 px-1.5 text-xs font-medium text-white" aria-label={`${appCount} waiting`}>
                  {appCount}
                </span>
              )}
            </TabButton>
          </div>

          <div className={tab === "students" ? undefined : "hidden"}>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Users} label="Active students" value={String(active.length)} />
            <StatCard icon={UserCheck} label="Placed" value={`${placed}/${active.length}`} hint={`${active.length - placed} not placed yet`} />
            <StatCard icon={QrCode} label="Accounts" value={`${registered}/${active.length}`} hint={`${active.length - registered} not registered yet`} />
            <StatCard icon={Archive} label="Archived" value={String(archivedCount)} />
          </div>

          {adding && (
            <AddStudentPanel
              semesterId={semesterId}
              onClose={() => setAdding(false)}
              onCreated={(row) =>
                update((d) => ({ ...d, students: [...d.students, row].sort((a, b) => a.lastname.localeCompare(b.lastname) || a.firstname.localeCompare(b.firstname)) }))
              }
            />
          )}

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search name, number, email..."
                  aria-label="Search students"
                  className="w-64 pl-8"
                />
              </div>
              <NativeSelect aria-label="Filter by year" value={year} onChange={(e) => { setYear(e.target.value); setPage(1); }}>
                <NativeSelectOption value="">All years</NativeSelectOption>
                {YEARS.map((y) => <NativeSelectOption key={y} value={y}>{y}</NativeSelectOption>)}
              </NativeSelect>
              <NativeSelect aria-label="Filter by placement" value={placement} onChange={(e) => { setPlacement(e.target.value as PlacementFilter); setPage(1); }}>
                <NativeSelectOption value="all">Any placement</NativeSelectOption>
                <NativeSelectOption value="placed">Placed</NativeSelectOption>
                <NativeSelectOption value="unplaced">Not placed</NativeSelectOption>
              </NativeSelect>
              <NativeSelect aria-label="Filter by account" value={account} onChange={(e) => { setAccount(e.target.value as AccountFilter); setPage(1); }}>
                <NativeSelectOption value="all">Any account</NativeSelectOption>
                <NativeSelectOption value="with">With account</NativeSelectOption>
                <NativeSelectOption value="without">No account yet</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button type="button" size="sm" variant="outline" />}>
                  <SlidersHorizontal className="h-4 w-4" /> Columns
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuCheckboxItem checked={showEmail} onCheckedChange={(v) => setShowEmail(v === true)}>
                    Email
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={showContact} onCheckedChange={(v) => setShowContact(v === true)}>
                    Contact
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {STATUS_OPTIONS.map((o) => (
                <Button key={o.value} type="button" size="sm" variant={status === o.value ? "default" : "outline"} onClick={() => { setStatus(o.value); setPage(1); }}>
                  {o.label}
                </Button>
              ))}
            </div>
          </div>

          {loading && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          )}

          {!loading && data && (
            <>
              {filtered.length === 0 ? (
                <p className="rounded-xl border bg-card py-16 text-center text-sm text-muted-foreground">
                  {students.length === 0 ? "No students yet. Add one or import a file." : "No students match your filters."}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border bg-card">
                  <Table style={{ minWidth }}>
                    <TableHeader>
                      <TableRow>
                        <TableHead className={HEAD} style={{ width: COL.num }}>No.</TableHead>
                        <TableHead className={HEAD} style={{ width: COL.number }}>Student ID</TableHead>
                        <TableHead className={HEAD} style={{ width: COL.last }}>Last name</TableHead>
                        <TableHead className={HEAD} style={{ width: COL.first }}>First name</TableHead>
                        <TableHead className={HEAD} style={{ width: COL.mi }}>MI</TableHead>
                        <TableHead className={HEAD} style={{ width: COL.gender }}>Gender</TableHead>
                        <TableHead className={HEAD} style={{ width: COL.course }}>Course</TableHead>
                        <TableHead className={HEAD} style={{ width: COL.year }}>Year</TableHead>
                        {showEmail && <TableHead className={HEAD} style={{ width: COL.email }}>Email</TableHead>}
                        {showContact && <TableHead className={HEAD} style={{ width: COL.contact }}>Contact</TableHead>}
                        <TableHead className={HEAD} style={{ width: COL.company }}>Company</TableHead>
                        <TableHead className={HEAD} style={{ width: COL.status }}>Status</TableHead>
                        <TableHead className={cn(HEAD, "text-right")} style={{ width: COL.actions }}>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageRows.map((s, i) => (
                        <TableRow key={s.id} className={cn(s.archived && "opacity-60")}>
                          <TableCell className="px-2 py-2 align-top text-muted-foreground">{offset + i + 1}</TableCell>
                          <TableCell className={CELL}>
                            <EditableCell value={s.studentNumber} label="Student number" maxLength={50} validate={(v) => validNumber(v)} onSave={(v) => save(s, "studentNumber", v)} />
                          </TableCell>
                          <TableCell className={CELL}>
                            <EditableCell value={s.lastname} label="Last name" maxLength={100} validate={required("Last name")} onSave={(v) => save(s, "lastname", v)} />
                          </TableCell>
                          <TableCell className={CELL}>
                            <EditableCell value={s.firstname} label="First name" maxLength={100} validate={required("First name")} onSave={(v) => save(s, "firstname", v)} />
                          </TableCell>
                          <TableCell className={CELL}>
                            <EditableCell value={s.middleInitial} label="Middle initial" maxLength={3} onSave={(v) => save(s, "middleInitial", v)} />
                          </TableCell>
                          <TableCell className={CELL}>
                            <SelectCell value={s.gender} label="Gender" options={GENDERS} onSave={(v) => save(s, "gender", v)} />
                          </TableCell>
                          <TableCell className={CELL}>
                            <EditableCell value={s.subjectCode} label="Course" maxLength={50} validate={required("Course")} onSave={(v) => save(s, "course", v)} />
                          </TableCell>
                          <TableCell className={CELL}>
                            <SelectCell value={s.year} label="Year" options={YEARS} onSave={(v) => save(s, "year", v)} />
                          </TableCell>
                          {showEmail && (<TableCell className={CELL}>
                            <EditableCell value={s.email} label="Email" maxLength={255} validate={validEmail} onSave={(v) => save(s, "email", v)} />
                          </TableCell>)}
                          {showContact && (<TableCell className={CELL}>
                            <EditableCell value={s.contact} label="Contact" kind="tel" maxLength={20} validate={validOptionalPhone} onSave={(v) => save(s, "contact", v)} />
                          </TableCell>)}
                          <TableCell className="px-3 py-2 align-top text-sm">
                            {s.companyName ? (
                              <>
                                <div>{s.companyName}</div>
                                {s.departmentName && <div className="text-xs text-muted-foreground">{s.departmentName}</div>}
                              </>
                            ) : (
                              <span className="text-muted-foreground">Not placed</span>
                            )}
                          </TableCell>
                          <TableCell className="px-3 py-2 align-top text-sm">
                            <div>{s.status}</div>
                            <span
                              className={cn(
                                "mt-1 inline-block rounded-full px-2 py-0.5 text-xs",
                                s.registered
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {s.registered ? "Registered" : "Not registered"}
                            </span>
                          </TableCell>
                          <TableCell className="px-2 py-2 text-right align-top">
                            <div className="flex justify-end gap-1">
                              <Button type="button" variant="ghost" size="icon" aria-label="View profile" title="View profile" onClick={() => setViewId(s.id)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button type="button" variant="ghost" size="icon" aria-label={s.archived ? "Restore" : "Archive"} title={s.archived ? "Restore" : "Archive"} onClick={() => setConfirm(s)}>
                                {s.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {filtered.length > 0 && (
                <div className="mt-3 rounded-xl border bg-card">
                  <DataTablePagination
                    page={currentPage}
                    pageSize={pageSize}
                    total={filtered.length}
                    pageSizeOptions={[10, 20, 50]}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                  />
                </div>
              )}
            </>
          )}

          </div>

          <div className={tab === "applications" ? undefined : "hidden"}>
            <ApplicationsTab
              semesterId={semesterId}
              visible={tab === "applications"}
              onPendingChange={setAppCount}
              onChanged={() => void refresh()}
            />
          </div>

          <div className={tab === "accounts" ? undefined : "hidden"}>
            <AccountsTab
              semesterId={semesterId}
              visible={tab === "accounts"}
              onPendingChange={setPendingCount}
              onChanged={() => void refresh()}
            />
          </div>

          <ImportDialog
            open={importing}
            semesterId={semesterId}
            onOpenChange={setImporting}
            onImported={() => void refresh()}
          />
        </>
      )}

      <StudentDrawer studentId={viewId} onClose={() => setViewId(null)} onRowChange={replaceRow} />

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.archived ? "Restore this student?" : "Archive this student?"}
        description={
          confirm?.archived
            ? `${confirm?.firstname} ${confirm?.lastname} will show up in your active list again.`
            : `${confirm?.firstname} ${confirm?.lastname} will be hidden from your active lists. You can restore them any time.`
        }
        confirmLabel={confirm?.archived ? "Restore" : "Archive"}
        loading={confirming}
        onConfirm={() => void toggleArchive()}
        onCancel={() => setConfirm(null)}
      />
    </DashboardLayout>
  );
}
