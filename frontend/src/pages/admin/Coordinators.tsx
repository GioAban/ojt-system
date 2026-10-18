import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Ellipsis,
  KeyRound,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import type { Coordinator } from "@/types/coordinator";
import type { Program } from "@/types/program";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { DataTablePagination } from "@/components/DataTablePagination";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CoordinatorFormDialog } from "@/components/coordinators/CoordinatorFormDialog";
import { ResetPasswordDialog } from "@/components/coordinators/ResetPasswordDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type StatusFilter = "all" | "active" | "archived";

interface ConfirmAction {
  type: "archive" | "restore";
  coordinator: Coordinator;
}

interface Notice {
  type: "success" | "error";
  text: string;
}

function confirmCopy(action: ConfirmAction) {
  const { coordinator } = action;

  if (action.type === "archive") {
    return {
      title: "Archive this coordinator?",
      description:
        `${coordinator.fullname} won't be able to log in anymore.` +
        (coordinator.studentsCount > 0
          ? ` Their ${coordinator.studentsCount} active student(s) stay assigned to them until reassigned.`
          : "") +
        " You can restore the account anytime.",
      label: "Archive",
      success: `${coordinator.fullname} was archived.`,
    };
  }

  return {
    title: "Restore this coordinator?",
    description: `${coordinator.fullname} will be able to log in again.`,
    label: "Restore",
    success: `${coordinator.fullname} was restored.`,
  };
}

export default function Coordinators() {
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const [search, setSearch] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<Coordinator | null>(null);

  const [resetTarget, setResetTarget] = useState<Coordinator | null>(null);

  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [confirming, setConfirming] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [coordinatorsRes, programsRes] = await Promise.all([
        api.get<Coordinator[]>("/coordinators"),
        api.get<Program[]>("/programs"),
      ]);
      setCoordinators(coordinatorsRes.data);
      setPrograms(programsRes.data);
      setLoadError("");
    } catch (err) {
      setLoadError(getErrorMessage(err, "Failed to load coordinators."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const counts = {
    all: coordinators.length,
    active: coordinators.filter((c) => !c.isArchived).length,
    archived: coordinators.filter((c) => c.isArchived).length,
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return coordinators.filter((c) => {
      if (status === "active" && c.isArchived) return false;
      if (status === "archived" && !c.isArchived) return false;
      if (programFilter && String(c.programId) !== programFilter) return false;
      return (
        !q ||
        c.fullname.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.employeeNumber.toLowerCase().includes(q) ||
        c.programAbbreviation.toLowerCase().includes(q)
      );
    });
  }, [coordinators, search, programFilter, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  function openAdd() {
    setEditing(null);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  function openEdit(coordinator: Coordinator) {
    setEditing(coordinator);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  async function handleSaved(message: string) {
    await loadAll();
    setNotice({ type: "success", text: message });
  }

  async function handleConfirm() {
    if (!confirm) return;

    const { type, coordinator } = confirm;
    const copy = confirmCopy(confirm);

    setConfirming(true);
    try {
      await api.patch(`/coordinators/${coordinator.id}/${type}`);
      await loadAll();
      setNotice({ type: "success", text: copy.success });
    } catch (err) {
      setNotice({
        type: "error",
        text: getErrorMessage(err, "Action failed."),
      });
    } finally {
      setConfirming(false);
      setConfirm(null);
    }
  }

  const copy = confirm ? confirmCopy(confirm) : null;

  const filters: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "archived", label: "Archived" },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Coordinator Management"
        description="Create coordinator accounts, assign programs, and manage their access."
        actions={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Coordinator
          </Button>
        }
      />

      {notice && (
        <Alert
          variant={notice.type === "error" ? "destructive" : "default"}
          className="mb-4"
        >
          <AlertDescription>{notice.text}</AlertDescription>
        </Alert>
      )}

      {loadError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription className="flex items-center justify-between gap-4">
            {loadError}
            <Button variant="outline" size="sm" onClick={() => void loadAll()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-xl border bg-card">
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name, email, or ID..."
                className="pl-9"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <NativeSelect
              aria-label="Filter by program"
              value={programFilter}
              onChange={(e) => {
                setProgramFilter(e.target.value);
                setPage(1);
              }}
            >
              <NativeSelectOption value="">All programs</NativeSelectOption>
              {programs.map((p) => (
                <NativeSelectOption key={p.id} value={String(p.id)}>
                  {p.abbreviation}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="flex items-center gap-1">
            {filters.map((f) => (
              <Button
                key={f.value}
                type="button"
                size="sm"
                variant={status === f.value ? "default" : "outline"}
                onClick={() => {
                  setStatus(f.value);
                  setPage(1);
                }}
              >
                {f.label} ({counts[f.value]})
              </Button>
            ))}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Coordinator</TableHead>
              <TableHead>Employee no.</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Students</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!loading && pageRows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-muted-foreground"
                >
                  No coordinators found.
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              pageRows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {c.fullname}
                        {c.professionalTitles
                          ? `, ${c.professionalTitles}`
                          : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {c.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.employeeNumber}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline">{c.programAbbreviation}</Badge>
                      <Badge variant="secondary">{c.collegeAbbreviation}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={c.type === "ADMIN" ? "default" : "secondary"}
                    >
                      {c.type === "ADMIN" ? "Admin" : "Staff"}
                    </Badge>
                  </TableCell>
                  <TableCell>{c.studentsCount}</TableCell>
                  <TableCell>
                    <Badge variant={c.isArchived ? "outline" : "secondary"}>
                      {c.isArchived ? "Archived" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className={buttonVariants({
                          variant: "ghost",
                          size: "icon",
                        })}
                        aria-label="Row actions"
                      >
                        <Ellipsis className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="gap-2"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          className="gap-2"
                          onClick={() => setResetTarget(c)}
                        >
                          <KeyRound className="h-4 w-4" />
                          Reset password
                        </DropdownMenuItem>

                        {!c.isArchived && (
                          <DropdownMenuItem
                            className="gap-2"
                            onClick={() =>
                              setConfirm({ type: "archive", coordinator: c })
                            }
                          >
                            <Archive className="h-4 w-4" />
                            Archive
                          </DropdownMenuItem>
                        )}

                        {c.isArchived && (
                          <DropdownMenuItem
                            className="gap-2"
                            disabled={c.programArchived}
                            onClick={() =>
                              setConfirm({ type: "restore", coordinator: c })
                            }
                          >
                            <ArchiveRestore className="h-4 w-4" />
                            {c.programArchived
                              ? "Restore (program is archived)"
                              : "Restore"}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>

        <DataTablePagination
          page={currentPage}
          pageSize={pageSize}
          total={filtered.length}
          pageSizeOptions={[10, 20, 50]}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      <CoordinatorFormDialog
        key={formKey}
        open={formOpen}
        onOpenChange={setFormOpen}
        coordinator={editing}
        programs={programs}
        onSaved={(message) => void handleSaved(message)}
      />

      {resetTarget && (
        <ResetPasswordDialog
          key={resetTarget.id}
          open
          onOpenChange={(open) => {
            if (!open) setResetTarget(null);
          }}
          coordinator={resetTarget}
          onDone={(message) => setNotice({ type: "success", text: message })}
        />
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={copy?.title ?? ""}
        description={copy?.description ?? ""}
        confirmLabel={copy?.label ?? ""}
        loading={confirming}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </DashboardLayout>
  );
}
