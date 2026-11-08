import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, CloudOff, Download, Eraser, Eye, FilePenLine, Loader2, Plus, Printer, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { PaperPreview } from "@/components/paper/PaperPreview";
import { collegeLogoSrc } from "@/components/colleges/CollegeLogo";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { WeeklyReportSheet, chunkRows, formatSheetDate, printableRows } from "@/components/weekly/WeeklyReportSheet";
import {
  loadDraft, saveDraft,
  type WeeklyContent, type WeeklyHeader, type WeeklyRow,
} from "@/lib/weeklyDraftStore";

interface ServerDetail {
  header: WeeklyHeader;
  draft: { content: string; clientUpdatedAt: number } | null;
}
interface SaveResult {
  saved: boolean;
  draft: { content: string; clientUpdatedAt: number };
}

type Status = "local" | "syncing" | "synced" | "offline" | "error";

const MAX_ROWS = 14;

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function parseIso(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** Lahat ng araw mula simula hanggang katapusan ng linggo (hal. Feb 2 - Feb 7); pwedeng alisin ang hindi kailangan */
function weekdays(from: string, to: string): WeeklyRow[] {
  const a = parseIso(from);
  const b = parseIso(to);
  if (a === null || b === null || b < a) return [{ id: newId(), date: from || "", text: "" }];
  const rows: WeeklyRow[] = [];
  for (let t = a; t <= b && rows.length < MAX_ROWS; t += 86_400_000) {
    rows.push({ id: newId(), date: new Date(t).toISOString().slice(0, 10), text: "" });
  }
  return rows;
}

function freshContent(h: WeeklyHeader): WeeklyContent {
  return {
    studentName: h.studentName, course: h.course, company: h.company,
    department: h.department, semester: h.semester, rows: weekdays(h.weekFrom, h.weekTo),
    supervisorName: h.supervisorName, supervisorPosition: h.supervisorPosition, supervisorDate: h.weekTo,
  };
}

/** Pinupunan ang mga blangko mula sa system at sinisigurong may id ang bawat row; read-only ang pangalan, course at semester */
function normalize(c: WeeklyContent, h: WeeklyHeader): WeeklyContent {
  const keep = (mine: string | undefined, fromSystem: string) => (mine && mine.trim() ? mine : fromSystem);
  return {
    ...c,
    studentName: h.studentName || c.studentName,
    course: h.course || c.course,
    semester: h.semester || c.semester,
    company: keep(c.company, h.company),
    department: keep(c.department, h.department),
    supervisorName: keep(c.supervisorName, h.supervisorName),
    supervisorPosition: keep(c.supervisorPosition, h.supervisorPosition),
    supervisorDate: keep(c.supervisorDate, h.weekTo),
    rows: c.rows.map((r) => (r.id ? r : { ...r, id: newId() })),
  };
}

function parseContent(raw: string): WeeklyContent | null {
  try {
    const c = JSON.parse(raw) as WeeklyContent;
    return c && Array.isArray(c.rows) ? c : null;
  } catch {
    return null;
  }
}

const STATUS_TEXT: Record<Status, string> = {
  local: "Saved on this device",
  syncing: "Saving to your account…",
  synced: "Saved on this device and in your account",
  offline: "Offline: saved on this device, will sync when you're back online",
  error: "Saved on this device. Couldn't reach the server, will retry",
};

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium">{value || "–"}</dd>
    </div>
  );
}

function WeeklyReportEditorBody({ refId, onClose }: { refId: string; onClose: () => void }) {
  const key = `weekly:${refId}`;
  const [header, setHeader] = useState<WeeklyHeader | null>(null);
  const [content, setContent] = useState<WeeklyContent | null>(null);
  const [status, setStatus] = useState<Status>("local");
  const [loadError, setLoadError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const contentRef = useRef<WeeklyContent | null>(null);
  const headerRef = useRef<WeeklyHeader | null>(null);
  const stampRef = useRef(0);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<number | undefined>(undefined);
  const pushTimer = useRef<number | undefined>(undefined);

  const persist = useCallback(async (dirty: boolean) => {
    const c = contentRef.current;
    if (!c) return;
    await saveDraft({
      key, owner: c.studentName, content: c, header: headerRef.current,
      clientUpdatedAt: stampRef.current, dirty,
    });
  }, [key]);

  const push = useCallback(async () => {
    const c = contentRef.current;
    if (!c || !dirtyRef.current) return;
    if (!navigator.onLine) { setStatus("offline"); return; }
    const sent = stampRef.current;
    setStatus("syncing");
    try {
      const res = await api.put<SaveResult>(`/student/weekly-draft/${refId}`, {
        content: JSON.stringify(c), clientUpdatedAt: sent,
      });
      if (!res.data.saved) {
        // Mas bago ang nasa account (galing sa ibang device)
        const remote = parseContent(res.data.draft.content);
        if (remote && headerRef.current) {
          const merged = normalize(remote, headerRef.current);
          contentRef.current = merged;
          stampRef.current = res.data.draft.clientUpdatedAt;
          setContent(merged);
          dirtyRef.current = false;
          await persist(false);
          notify.success("Updated with your newer copy from another device.");
        }
        setStatus("synced");
        return;
      }
      if (stampRef.current === sent) {
        dirtyRef.current = false;
        await persist(false);
        setStatus("synced");
      } else {
        window.clearTimeout(pushTimer.current);
        pushTimer.current = window.setTimeout(() => void push(), 800);
      }
    } catch {
      setStatus(navigator.onLine ? "error" : "offline");
    }
  }, [persist, refId]);

  const update = useCallback((next: WeeklyContent) => {
    contentRef.current = next;
    stampRef.current = Date.now();
    dirtyRef.current = true;
    setContent(next);
    setStatus(navigator.onLine ? "local" : "offline");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void persist(true), 300);
    window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => void push(), 1500);
  }, [persist, push]);

  // Pag-load: pinaghahambing ang kopya sa device at sa account; ang mas bago ang gagamitin
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await loadDraft(key);
      let server: ServerDetail | null = null;
      try {
        server = (await api.get<ServerDetail>(`/student/weekly-draft/${refId}`)).data;
      } catch {
        server = null;
      }
      if (cancelled) return;

      if (!server) {
        if (local) {
          const h = local.header;
          const c = h ? normalize(local.content, h) : local.content;
          headerRef.current = h;
          contentRef.current = c;
          stampRef.current = local.clientUpdatedAt;
          dirtyRef.current = local.dirty;
          setHeader(h);
          setContent(c);
          setStatus(local.dirty ? "offline" : "local");
        } else {
          setLoadError("Open this page once while online so your weekly report can be saved on this device.");
        }
        return;
      }

      const h = server.header;
      headerRef.current = h;
      setHeader(h);
      const localUsable = local && local.owner === h.studentName ? local : null;
      const remote = server.draft ? parseContent(server.draft.content) : null;
      const remoteStamp = server.draft?.clientUpdatedAt ?? 0;

      let chosen: WeeklyContent;
      let stamp: number;
      let dirty: boolean;
      if (localUsable && (localUsable.dirty || localUsable.clientUpdatedAt >= remoteStamp)) {
        chosen = localUsable.content;
        stamp = localUsable.clientUpdatedAt;
        dirty = localUsable.dirty;
      } else if (remote) {
        chosen = remote;
        stamp = remoteStamp;
        dirty = false;
      } else {
        chosen = freshContent(h);
        stamp = Date.now();
        dirty = false;
      }
      const normalized = normalize(chosen, h);
      if (JSON.stringify(normalized) !== JSON.stringify(chosen)) {
        // may napunan mula sa system: i-save din sa account
        dirty = true;
        stamp = Date.now();
      }
      contentRef.current = normalized;
      stampRef.current = stamp;
      dirtyRef.current = dirty;
      setContent(normalized);
      setStatus(dirty ? "local" : "synced");
      await persist(dirty);
      if (dirty) void push();
    })();
    return () => { cancelled = true; };
  }, [key, refId, persist, push]);

  // Balik sa online -> i-sync ang mga hindi pa na-save sa account
  useEffect(() => {
    const goOnline = () => { if (dirtyRef.current) void push(); };
    const goOffline = () => setStatus("offline");
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.clearTimeout(saveTimer.current);
      window.clearTimeout(pushTimer.current);
    };
  }, [push]);

  // Siguradong na-save sa device bago isara ang tab
  useEffect(() => {
    const flush = () => { if (dirtyRef.current) void persist(true); };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [persist]);

  function setRowsPerPage(n: number) {
    if (content) update({ ...content, rowsPerPage: n });
  }
  function setField(
    k: "company" | "department" | "supervisorName" | "supervisorPosition" | "supervisorDate",
    v: string,
  ) {
    if (content) update({ ...content, [k]: v });
  }
  function setRow(i: number, patch: Partial<WeeklyRow>) {
    if (!content) return;
    update({ ...content, rows: content.rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
  }
  function addRow() {
    if (!content || content.rows.length >= MAX_ROWS) return;
    const last = content.rows[content.rows.length - 1];
    const t = last ? parseIso(last.date) : null;
    const date = t === null ? "" : new Date(t + 86_400_000).toISOString().slice(0, 10);
    update({ ...content, rows: [...content.rows, { id: newId(), date, text: "" }] });
  }
  function removeRow(i: number) {
    if (!content || content.rows.length <= 1) return;
    update({ ...content, rows: content.rows.filter((_, idx) => idx !== i) });
  }

  function clearAll() {
    setConfirmClear(false);
    if (!header) return;
    update(freshContent(header));
    notify.success("Cleared. Your report is back to a blank week.");
  }

  async function downloadPdf() {
    const root = document.getElementById("weekly-print-root");
    if (!root || !header) return;
    setPdfBusy(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
      const pageW = 215.9;
      const pageH = 330.2; // long bond 8.5 x 13 in
      const pdf = new jsPDF({ unit: "mm", format: [pageW, pageH] });
      const pages = Array.from(root.querySelectorAll<HTMLElement>(".wk-page"));
      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], {
          scale: 2, backgroundColor: "#ffffff", useCORS: true,
          onclone: (doc) => {
            const el = doc.getElementById("weekly-print-root");
            if (el) { el.style.position = "static"; el.style.left = "0"; el.style.top = "0"; }
          },
        });
        let w = pageW;
        let h = (canvas.height * pageW) / canvas.width;
        if (h > pageH) { w = (pageW * pageH) / h; h = pageH; } // paliitin kung sobra ang haba
        if (i > 0) pdf.addPage([pageW, pageH]);
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", (pageW - w) / 2, 0, w, h);
      }
      pdf.save(`Weekly-Report-${header.weekFrom || "draft"}.pdf`);
    } catch (err) {
      console.error("Weekly report PDF failed", err);
      notify.error("Couldn't create the PDF. If you're offline, open this page online once first, or use Print and choose Save as PDF.");
    } finally {
      setPdfBusy(false);
    }
  }

  if (loadError) return <p className="mt-4 text-sm text-destructive">{loadError}</p>;
  if (!content || !header) return <p className="mt-4 text-sm text-muted-foreground">Loading your weekly report…</p>;

  const StatusIcon = status === "syncing" ? Loader2 : status === "offline" || status === "error" ? CloudOff : Check;

  return (
    <div className="mt-4">
      <style>{`
        @media print {
          @page { size: 8.5in 13in; margin: 0; }
          body > *:not(#weekly-print-root) { display: none !important; }
          #weekly-print-root { position: static !important; left: 0 !important; display: block !important; }
        }
      `}</style>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => setShowPreview(true)}>
          <Eye className="mr-1 h-4 w-4" /> Preview, print or download
        </Button>
        <Button type="button" variant="ghost" className="text-destructive hover:text-destructive sm:ml-auto" onClick={() => setConfirmClear(true)}>
          <Eraser className="mr-1 h-4 w-4" /> Clear
        </Button>
      </div>
      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
        <StatusIcon className={status === "syncing" ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
        {STATUS_TEXT[status]}
      </p>

      <h3 className="mb-2 mt-5 text-sm font-semibold">Report details</h3>
      <dl className="grid gap-x-6 gap-y-3 rounded-lg border bg-background p-3 sm:grid-cols-2">
        <ReadOnly label="Student" value={content.studentName} />
        <ReadOnly label="Course" value={content.course} />
        <div className="sm:col-span-2"><ReadOnly label="Semester and school year" value={content.semester} /></div>
      </dl>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="wk-company">Name of company / office</label>
          <Input id="wk-company" className="mt-1" value={content.company} onChange={(e) => setField("company", e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="wk-department">Department assigned</label>
          <Input id="wk-department" className="mt-1" value={content.department} onChange={(e) => setField("department", e.target.value)} />
        </div>
      </div>

      <h3 className="mb-1 mt-6 text-sm font-semibold">Daily activities</h3>
      <p className="mb-2 text-xs text-muted-foreground">
        Write one activity per line. Days you leave empty won't show on the printed report. You can remove a day you don't need.
      </p>
      <div className="flex flex-col gap-3">
        {content.rows.map((r, i) => {
          const rowId = r.id ?? String(i);
          return (
            <div key={rowId} className="rounded-lg border bg-background p-3">
              <div className="flex items-center gap-2">
                <Input
                  type="date" className="w-44" value={r.date} aria-label={`Date for day ${i + 1}`}
                  onChange={(e) => setRow(i, { date: e.target.value })}
                />
                <Button
                  type="button" variant="ghost" size="icon" className="ml-auto" aria-label={`Remove day ${i + 1}`}
                  disabled={content.rows.length <= 1} onClick={() => removeRow(i)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <textarea
                rows={3} value={r.text} onChange={(e) => setRow(i, { text: e.target.value })}
                placeholder="What did you do on this day?"
                aria-label={`Activities for day ${i + 1}`}
                className="mt-2 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />

            </div>
          );
        })}
        <Button type="button" variant="outline" size="sm" className="self-start" disabled={content.rows.length >= MAX_ROWS} onClick={addRow}>
          <Plus className="mr-1 h-4 w-4" /> Add a day
        </Button>
      </div>
      <h3 className="mb-1 mt-6 text-sm font-semibold">Supervisor</h3>
      <p className="mb-2 text-xs text-muted-foreground">
        Filled in from your assigned department. Change it if someone else signs your report.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="wk-supervisorName">Name of supervisor</label>
          <Input id="wk-supervisorName" className="mt-1" value={content.supervisorName ?? ""} onChange={(e) => setField("supervisorName", e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="wk-supervisorPosition">Position</label>
          <Input id="wk-supervisorPosition" className="mt-1" value={content.supervisorPosition ?? ""} onChange={(e) => setField("supervisorPosition", e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="wk-supervisorDate">Date</label>
          <Input id="wk-supervisorDate" type="date" className="mt-1" value={content.supervisorDate ?? ""} onChange={(e) => setField("supervisorDate", e.target.value)} />
          {content.supervisorDate && (
            <p className="mt-1 text-xs text-muted-foreground">Prints as {formatSheetDate(content.supervisorDate)}</p>
          )}
        </div>
      </div>

      <p className="mt-5 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        Next: open the preview to print it or save a PDF, have your supervisor sign and rate it, then upload the signed copy in "Your work".
      </p>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] gap-3 p-3 sm:max-h-[92dvh] sm:max-w-4xl sm:p-4">
          <DialogHeader>
            <DialogTitle>Weekly report preview</DialogTitle>
            <DialogDescription>
              This is how it will look on long bond paper (8.5 x 13 in). Print it or save it as a PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 bg-background px-1 py-1">
            <Button type="button" onClick={() => window.print()}>
              <Printer className="mr-1 h-4 w-4" /> Print
            </Button>
            <Button type="button" variant="outline" disabled={pdfBusy} onClick={() => void downloadPdf()}>
              {pdfBusy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
              Download PDF
            </Button>
            <Button type="button" variant="ghost" className="sm:ml-auto" onClick={() => setShowPreview(false)}>
              Close
            </Button>
          </div>
          <details className="rounded-lg border bg-background p-3 text-sm">
            <summary className="cursor-pointer select-none font-medium">
              Page settings (advanced) ·{" "}
              <span className="font-normal text-muted-foreground">
                {chunkRows(printableRows(content), content.rowsPerPage).length} page(s)
              </span>
            </summary>
            <div className="mt-3">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="wk-rowsPerPage">Days per page</label>
              <select
                id="wk-rowsPerPage"
                value={content.rowsPerPage ?? 0}
                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                className="mt-1 block h-9 w-full rounded-md border bg-background px-3 text-base outline-none pointer-coarse:h-11 md:text-sm focus-visible:ring-2 focus-visible:ring-ring sm:w-72"
              >
                <option value={0}>All days on one page (default)</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>{n} day{n === 1 ? "" : "s"} per page</option>
                ))}
              </select>
              <p className="mt-2 text-xs text-muted-foreground">
                If your activities are long and get cut off, choose fewer days per page. The signature and evaluation always go on the last page.
                The preview below updates right away.
              </p>
            </div>
          </details>
          <PaperPreview>
            <WeeklyReportSheet preview content={content} collegeAbbreviation={header.collegeAbbreviation} collegeLogoSrc={collegeLogoSrc(header.collegeLogoPath)} />
          </PaperPreview>
        </DialogContent>
      </Dialog>

      <div className="mt-4">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Close editor</Button>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear this report?"
        description="All activities and supervisor details you wrote for this week will be removed from this device and your account. This can't be undone."
        confirmLabel="Clear"
        loading={false}
        onConfirm={clearAll}
        onCancel={() => setConfirmClear(false)}
      />

      {createPortal(
        <div id="weekly-print-root" style={{ position: "fixed", left: -10000, top: 0 }}>
          <WeeklyReportSheet content={content} collegeAbbreviation={header.collegeAbbreviation} collegeLogoSrc={collegeLogoSrc(header.collegeLogoPath)} />
        </div>,
        document.body,
      )}
    </div>
  );
}

/** Nakatago sa simula; may button para buksan. Nananatiling naka-mount pagkabukas para hindi mawala ang edits. */
export function WeeklyReportEditor({ refId }: { refId: string }) {
  const [opened, setOpened] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <FilePenLine className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Weekly report maker</p>
          <p className="text-xs text-muted-foreground">
            Write your activities here, then print it or save it as a PDF. Your work is saved on this device, even without internet.
          </p>
        </div>
        <Button
          type="button" variant={visible ? "outline" : "default"} size="sm"
          onClick={() => { setOpened(true); setVisible((v) => !v); }}
        >
          {visible ? "Hide" : "Write report"}
        </Button>
      </div>
      {opened && (
        <div className={visible ? "" : "hidden"}>
          <WeeklyReportEditorBody refId={refId} onClose={() => setVisible(false)} />
        </div>
      )}
    </div>
  );
}
