import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Ellipsis,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import type { College } from "@/types/college";
import type { Program } from "@/types/program";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { DataTablePagination } from "@/components/DataTablePagination";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ProgramFormDialog } from "@/components/programs/ProgramFormDialog";
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
  program: Program;
}

interface Notice {
  type: "success" | "error";
  text: string;
}

function confirmCopy(action: ConfirmAction) {
  const label = `${action.program.name} (${action.program.abbreviation})`;

  if (action.type === "archive") {
    return {
      title: "Archive this program?",
      description: `${label} will be moved to the archived list. You can restore it anytime.`,
      label: "Archive",
      success: `${action.program.abbreviation} was archived.`,
    };
  }

  return {
    title: "Restore this program?",
    description: `${label} will be moved back to the active list.`,
    label: "Restore",
    success: `${action.program.abbreviation} was restored.`,
  };
}

export default function Programs() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const [search, setSearch] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<Program | null>(null);

  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [confirming, setConfirming] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [programsRes, collegesRes] = await Promise.all([
        api.get<Program[]>("/programs"),
        api.get<College[]>("/colleges"),
      ]);
      setPrograms(programsRes.data);
      setColleges(collegesRes.data);
      setLoadError("");
    } catch (err) {
      setLoadError(getErrorMessage(err, "Failed to load programs."));
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
    all: programs.length,
    active: programs.filter((p) => !p.isArchived).length,
    archived: programs.filter((p) => p.isArchived).length,
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return programs.filter((p) => {
      if (status === "active" && p.isArchived) return false;
      if (status === "archived" && !p.isArchived) return false;
      if (collegeFilter && String(p.collegeId) !== collegeFilter) return false;
      return (
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.abbreviation.toLowerCase().includes(q) ||
        p.programHead.toLowerCase().includes(q) ||
        p.collegeAbbreviation.toLowerCase().includes(q)
      );
    });
  }, [programs, search, collegeFilter, status]);

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

  function openEdit(program: Program) {
    setEditing(program);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  async function handleSaved(message: string) {
    await loadAll();
    setNotice({ type: "success", text: message });
  }

  async function handleConfirm() {
    if (!confirm) return;

    const { type, program } = confirm;
    const copy = confirmCopy(confirm);

    setConfirming(true);
    try {
      await api.patch(`/programs/${program.id}/${type}`);
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
        title="Program Management"
        description="Manage the degree programs under each college and their required training hours."
        actions={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Program
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
                placeholder="Search program or head..."
                className="pl-9"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <NativeSelect
              aria-label="Filter by college"
              value={collegeFilter}
              onChange={(e) => {
                setCollegeFilter(e.target.value);
                setPage(1);
              }}
            >
              <NativeSelectOption value="">All colleges</NativeSelectOption>
              {colleges.map((c) => (
                <NativeSelectOption key={c.id} value={String(c.id)}>
                  {c.abbreviation}
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
              <TableHead>Program</TableHead>
              <TableHead>College</TableHead>
              <TableHead>Program head</TableHead>
              <TableHead>Training hours</TableHead>
              <TableHead>Coordinators</TableHead>
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
                  No programs found.
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              pageRows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{p.name}</span>
                      <span>
                        <Badge variant="outline">{p.abbreviation}</Badge>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{p.collegeAbbreviation}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.programHead}
                  </TableCell>
                  <TableCell>
                    {p.trainingDuration.toLocaleString("en-PH", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    hrs
                  </TableCell>
                  <TableCell>{p.coordinatorsCount}</TableCell>
                  <TableCell>
                    <Badge variant={p.isArchived ? "outline" : "secondary"}>
                      {p.isArchived ? "Archived" : "Active"}
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
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>

                        {!p.isArchived && (
                          <DropdownMenuItem
                            className="gap-2"
                            disabled={p.coordinatorsCount > 0}
                            onClick={() =>
                              setConfirm({ type: "archive", program: p })
                            }
                          >
                            <Archive className="h-4 w-4" />
                            {p.coordinatorsCount > 0
                              ? "Archive (has active coordinators)"
                              : "Archive"}
                          </DropdownMenuItem>
                        )}

                        {p.isArchived && (
                          <DropdownMenuItem
                            className="gap-2"
                            disabled={p.collegeArchived}
                            onClick={() =>
                              setConfirm({ type: "restore", program: p })
                            }
                          >
                            <ArchiveRestore className="h-4 w-4" />
                            {p.collegeArchived
                              ? "Restore (college is archived)"
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

      <ProgramFormDialog
        key={formKey}
        open={formOpen}
        onOpenChange={setFormOpen}
        program={editing}
        colleges={colleges}
        onSaved={(message) => void handleSaved(message)}
      />

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
