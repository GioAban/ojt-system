import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, FileText, Plus, Search, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { notify } from "@/lib/notify";
import { REPORT_TYPES, reportTypeTitle } from "@/lib/reportCatalog";
import { deleteReportDraft } from "@/lib/reportDraftStore";
import { useSemester } from "@/contexts/semesterContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { NewReportDialog } from "@/components/reports/NewReportDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SavedReportSummary } from "@/types/reports";

const SEARCH_DELAY = 250;

const formatEdited = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

const linkTo = (r: SavedReportSummary) => `/coordinator/reports/${r.type}/${r.id}`;

/** Mga naka-save na report ng coordinator para sa napiling semester */
export default function Reports() {
  const { semesterId, semester, loaded: semestersLoaded } = useSemester();
  const [loaded, setLoaded] = useState<{ semesterId: number; rows: SavedReportSummary[] } | null>(null);
  // Hindi ipinapakita ang listahan ng ibang semester habang naglo-load
  const rows = loaded && loaded.semesterId === semesterId ? loaded.rows : null;
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<SavedReportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(query.trim()), SEARCH_DELAY);
    return () => window.clearTimeout(t);
  }, [query]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (semesterId === null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<SavedReportSummary[]>("/coordinator/reports/saved", {
          params: { semesterId, type: type || undefined, q: search || undefined },
        });
        if (cancelled) return;
        setLoaded({ semesterId, rows: res.data });
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [semesterId, type, search, attempt]);

  async function duplicate(r: SavedReportSummary) {
    setBusy(true);
    try {
      await api.post(`/coordinator/reports/saved/${r.id}/duplicate`);
      notify.success("Report duplicated.");
      reload();
    } catch {
      notify.error("Couldn't duplicate the report. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api.delete(`/coordinator/reports/saved/${toDelete.id}`);
      await deleteReportDraft(`${localStorage.getItem("email") ?? ""}:saved:${toDelete.id}`);
      notify.success("Report deleted.");
      setToDelete(null);
      reload();
    } catch {
      notify.error("Couldn't delete the report. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const filtered = Boolean(search || type);
  const semesterName = semester ? semester.semester : "the selected semester";

  const actions = (r: SavedReportSummary) => (
    <>
      <Link to={linkTo(r)} className={cn(buttonVariants({ size: "sm", variant: "outline" }), "pointer-coarse:h-11")}>
        Open
      </Link>
      <Button
        type="button" variant="ghost" size="icon-sm" className="pointer-coarse:size-11"
        aria-label={`Duplicate ${r.title}`} title="Duplicate" disabled={busy}
        onClick={() => void duplicate(r)}
      >
        <Copy className="h-4 w-4" />
      </Button>
      <Button
        type="button" variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive pointer-coarse:size-11"
        aria-label={`Delete ${r.title}`} title="Delete" disabled={busy}
        onClick={() => setToDelete(r)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </>
  );

  let body;
  if (semestersLoaded && semesterId === null) {
    body = <p className="text-sm text-muted-foreground">Choose a semester at the top of the page first.</p>;
  } else if (error && rows === null) {
    body = (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          Couldn't load your saved reports.
          <Button variant="outline" size="sm" onClick={reload}>Retry</Button>
        </AlertDescription>
      </Alert>
    );
  } else if (rows === null) {
    body = (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading saved reports">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  } else if (rows.length === 0) {
    body = (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
        <FileText className="h-8 w-8 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-medium">{filtered ? "No reports match your search" : "No saved reports yet"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered ? "Try a different title or report type." : `Create your first report for ${semesterName}.`}
          </p>
        </div>
        {!filtered && (
          <Button type="button" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New report
          </Button>
        )}
      </div>
    );
  } else {
    body = (
      <>
        {/* Mesa sa desktop */}
        <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Semester</TableHead>
                <TableHead>Last edited</TableHead>
                <TableHead>Edited by</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="max-w-64 whitespace-normal font-medium break-words">
                    <Link to={linkTo(r)} className="hover:underline">{r.title}</Link>
                  </TableCell>
                  <TableCell className="max-w-56 whitespace-normal text-muted-foreground">{reportTypeTitle(r.type)}</TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">{semesterName}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatEdited(r.clientUpdatedAt)}</TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">{r.lastEditedBy ?? ""}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">{actions(r)}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mga card sa telepono */}
        <ul className="flex flex-col gap-3 md:hidden">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border bg-card p-4">
              <Link to={linkTo(r)} className="block font-semibold leading-snug break-words">{r.title}</Link>
              <p className="mt-1 text-sm text-muted-foreground">{reportTypeTitle(r.type)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{semesterName}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Edited {formatEdited(r.clientUpdatedAt)}{r.lastEditedBy ? ` by ${r.lastEditedBy}` : ""}
              </p>
              <div className="mt-3 flex items-center justify-end gap-1">{actions(r)}</div>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Reports"
        description={`Saved reports and printable lists for ${semesterName}. Edit, print or download as PDF.`}
        actions={
          <Button type="button" disabled={semesterId === null} onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New report
          </Button>
        }
      />

      <h2 className="mb-3 text-base font-semibold">Saved reports</h2>
      {semesterId !== null && (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={query}
              aria-label="Search saved reports"
              placeholder="Search by title"
              className="h-11 pl-8 sm:h-9"
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter by report type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-11 w-full min-w-0 rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9 sm:w-64 md:text-sm"
          >
            <option value="">All types</option>
            {REPORT_TYPES.map((r) => <option key={r.type} value={r.type}>{r.title}</option>)}
          </select>
        </div>
      )}

      {error && rows !== null && (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            Couldn't refresh your saved reports. This list may be out of date.
            <Button variant="outline" size="sm" onClick={reload}>Retry</Button>
          </AlertDescription>
        </Alert>
      )}

      {body}

      {semesterId !== null && creating && (
        <NewReportDialog open={creating} onOpenChange={setCreating} semesterId={semesterId} semesterName={semesterName} />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this report?"
        description={toDelete ? `"${toDelete.title}" will be permanently deleted. This doesn't change any system data.` : ""}
        confirmLabel="Delete"
        loading={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </DashboardLayout>
  );
}
