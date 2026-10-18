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
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { DataTablePagination } from "@/components/DataTablePagination";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CollegeFormDialog } from "@/components/colleges/CollegeFormDialog";
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

type StatusFilter = "all" | "active" | "archived";

interface ConfirmAction {
  type: "archive" | "restore";
  college: College;
}

interface Notice {
  type: "success" | "error";
  text: string;
}

function confirmCopy(action: ConfirmAction) {
  const label = `${action.college.name} (${action.college.abbreviation})`;

  if (action.type === "archive") {
    return {
      title: "Archive this college?",
      description: `${label} will be moved to the archived list. You can restore it anytime.`,
      label: "Archive",
      success: `${action.college.abbreviation} was archived.`,
    };
  }

  return {
    title: "Restore this college?",
    description: `${label} will be moved back to the active list.`,
    label: "Restore",
    success: `${action.college.abbreviation} was restored.`,
  };
}

export default function Colleges() {
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<College | null>(null);

  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [confirming, setConfirming] = useState(false);

  const loadColleges = useCallback(async () => {
    try {
      const res = await api.get<College[]>("/colleges");
      setColleges(res.data);
      setLoadError("");
    } catch (err) {
      setLoadError(getErrorMessage(err, "Failed to load colleges."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadColleges();
  }, [loadColleges]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const counts = {
    all: colleges.length,
    active: colleges.filter((c) => !c.isArchived).length,
    archived: colleges.filter((c) => c.isArchived).length,
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return colleges.filter((c) => {
      if (status === "active" && c.isArchived) return false;
      if (status === "archived" && !c.isArchived) return false;
      return (
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.abbreviation.toLowerCase().includes(q) ||
        c.dean.toLowerCase().includes(q)
      );
    });
  }, [colleges, search, status]);

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

  function openEdit(college: College) {
    setEditing(college);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  async function handleSaved(message: string) {
    await loadColleges();
    setNotice({ type: "success", text: message });
  }

  async function handleConfirm() {
    if (!confirm) return;

    const { type, college } = confirm;
    const copy = confirmCopy(confirm);

    setConfirming(true);
    try {
      await api.patch(`/colleges/${college.id}/${type}`);
      await loadColleges();
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
        title="College Management"
        description="Manage the colleges of the university and their deans."
        actions={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add College
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
              onClick={() => void loadColleges()}
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
              placeholder="Search college or dean..."
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
              <TableHead>College</TableHead>
              <TableHead>Dean</TableHead>
              <TableHead>Active programs</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!loading && pageRows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-muted-foreground"
                >
                  No colleges found.
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              pageRows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.name}</span>
                      <Badge variant="outline">{c.abbreviation}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.dean}
                  </TableCell>
                  <TableCell>{c.programsCount}</TableCell>
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

                        {!c.isArchived && (
                          <DropdownMenuItem
                            className="gap-2"
                            disabled={c.programsCount > 0}
                            onClick={() =>
                              setConfirm({ type: "archive", college: c })
                            }
                          >
                            <Archive className="h-4 w-4" />
                            {c.programsCount > 0
                              ? "Archive (has active programs)"
                              : "Archive"}
                          </DropdownMenuItem>
                        )}

                        {c.isArchived && (
                          <DropdownMenuItem
                            className="gap-2"
                            onClick={() =>
                              setConfirm({ type: "restore", college: c })
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

      <CollegeFormDialog
        key={formKey}
        open={formOpen}
        onOpenChange={setFormOpen}
        college={editing}
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
