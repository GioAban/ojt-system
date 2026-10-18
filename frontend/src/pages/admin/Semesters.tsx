import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Ellipsis,
  Pencil,
  Plus,
  Search,
  Star,
} from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import type { Semester } from "@/types/semester";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { DataTablePagination } from "@/components/DataTablePagination";
import { SemesterFormDialog } from "@/components/semesters/SemesterFormDialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ConfirmDialog";
type StatusFilter = "all" | "active" | "archived";

interface ConfirmAction {
  type: "default" | "archive" | "restore";
  semester: Semester;
}

interface Notice {
  type: "success" | "error";
  text: string;
}

function confirmCopy(action: ConfirmAction, currentDefault?: Semester) {
  const name = action.semester.semester;

  if (action.type === "default") {
    return {
      title: "Set as default semester?",
      description: currentDefault
        ? `${name} will become the default semester. ${currentDefault.semester} will no longer be the default.`
        : `${name} will become the default semester.`,
      label: "Set as default",
      success: `${name} is now the default semester.`,
    };
  }

  if (action.type === "archive") {
    return {
      title: "Archive this semester?",
      description: `${name} will be moved to the archived list. You can restore it anytime.`,
      label: "Archive",
      success: `${name} was archived.`,
    };
  }

  return {
    title: "Restore this semester?",
    description: `${name} will be moved back to the active list.`,
    label: "Restore",
    success: `${name} was restored.`,
  };
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function Semesters() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<Semester | null>(null);

  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [confirming, setConfirming] = useState(false);

  const loadSemesters = useCallback(async () => {
    try {
      const res = await api.get<Semester[]>("/semesters");
      setSemesters(res.data);
      setLoadError("");
    } catch (err) {
      setLoadError(getErrorMessage(err, "Failed to load server | semesters."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSemesters();
  }, [loadSemesters]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const currentDefault = semesters.find((s) => s.isDefault);

  const counts = {
    all: semesters.length,
    active: semesters.filter((s) => !s.isArchived).length,
    archived: semesters.filter((s) => s.isArchived).length,
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return semesters.filter((s) => {
      if (status === "active" && s.isArchived) return false;
      if (status === "archived" && !s.isArchived) return false;
      return !q || s.semester.toLowerCase().includes(q);
    });
  }, [semesters, search, status]);

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

  function openEdit(semester: Semester) {
    setEditing(semester);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  async function handleSaved(message: string) {
    await loadSemesters();
    setNotice({ type: "success", text: message });
  }

  async function handleConfirm() {
    if (!confirm) return;

    const { type, semester } = confirm;
    const copy = confirmCopy(confirm, currentDefault);

    setConfirming(true);
    try {
      await api.patch(`/semesters/${semester.id}/${type}`);
      await loadSemesters();
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

  const copy = confirm ? confirmCopy(confirm, currentDefault) : null;

  const filters: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "archived", label: "Archived" },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Semester Management"
        description="Manage school terms and choose which semester is the default."
        actions={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Semester
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadSemesters()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-xl border bg-card">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search semester..."
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
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
              <TableHead>Semester</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-12 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!loading && pageRows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-10 text-center text-muted-foreground"
                >
                  No semesters found.
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              pageRows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {s.semester}
                      {s.isDefault && (
                        <Badge>
                          <Star className="h-3 w-3" />
                          Default
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.isArchived ? "outline" : "secondary"}>
                      {s.isArchived ? "Archived" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(s.createdAt)}
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
                          onClick={() => openEdit(s)}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>

                        {!s.isDefault && !s.isArchived && (
                          <DropdownMenuItem
                            className="gap-2"
                            onClick={() =>
                              setConfirm({ type: "default", semester: s })
                            }
                          >
                            <Star className="h-4 w-4" />
                            Set as default
                          </DropdownMenuItem>
                        )}

                        {!s.isArchived && !s.isDefault && (
                          <DropdownMenuItem
                            className="gap-2"
                            onClick={() =>
                              setConfirm({ type: "archive", semester: s })
                            }
                          >
                            <Archive className="h-4 w-4" />
                            Archive
                          </DropdownMenuItem>
                        )}

                        {s.isArchived && (
                          <DropdownMenuItem
                            className="gap-2"
                            onClick={() =>
                              setConfirm({ type: "restore", semester: s })
                            }
                          >
                            <ArchiveRestore className="h-4 w-4" />
                            Restore
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
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      <SemesterFormDialog
        key={formKey}
        open={formOpen}
        onOpenChange={setFormOpen}
        semester={editing}
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
