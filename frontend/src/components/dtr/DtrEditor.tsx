import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarClock, Check, CloudOff, Download, Eraser, Eye, Loader2, Plus, Printer, Trash2 } from "lucide-react";
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
import { DtrSheet } from "@/components/dtr/DtrSheet";
import {
  chunk, dayName, formatHours, isWeekend, parseIso, rowHours, shortDate, totalHours,
} from "@/components/dtr/dtrMath";
import {
  loadDtr, saveDtr,
  type DtrContent, type DtrHeader, type DtrRow, type DtrSchedule,
} from "@/lib/dtrDraftStore";

interface ServerDetail {
  header: DtrHeader;
  draft: { content: string; clientUpdatedAt: number } | null;
}
interface SaveResult {
  saved: boolean;
  draft: { content: string; clientUpdatedAt: number };
}

type Status = "local" | "syncing" | "synced" | "offline" | "error";

const MAX_ROWS = 31;
const DEFAULT_SCHEDULE: DtrSchedule = { amIn: "08:00", amOut: "12:00", pmIn: "13:00", pmOut: "17:00" };

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function courseYear(h: DtrHeader): string {
  return [h.course, h.year].filter((s) => s && s.trim()).join(" - ");
}

function makeRow(date: string, schedule: DtrSchedule): DtrRow {
  const worked = date ? !isWeekend(date) : true;
  return {
    id: newId(), date, worked,
    amIn: worked ? schedule.amIn : "", amOut: worked ? schedule.amOut : "",
    pmIn: worked ? schedule.pmIn : "", pmOut: worked ? schedule.pmOut : "",
  };
}

/** Lahat ng araw ng buwan; ang Sabado at Linggo ay naka-"hindi pumasok" sa simula */
function monthRows(h: DtrHeader, schedule: DtrSchedule): DtrRow[] {
  const a = parseIso(h.monthStart);
  const b = parseIso(h.monthEnd);
  if (!a || !b) return [makeRow("", schedule)];
  const start = Date.UTC(a.y, a.m - 1, a.d);
  const end = Date.UTC(b.y, b.m - 1, b.d);
  const rows: DtrRow[] = [];
  for (let t = start; t <= end && rows.length < MAX_ROWS; t += 86_400_000) {
    rows.push(makeRow(new Date(t).toISOString().slice(0, 10), schedule));
  }
  return rows;
}

function freshContent(h: DtrHeader): DtrContent {
  return {
    studentName: h.studentName, courseYear: courseYear(h), company: h.company, department: h.department,
    semester: h.semester, monthLabel: h.monthLabel, rows: monthRows(h, DEFAULT_SCHEDULE),
    supervisorName: h.supervisorName, supervisorPosition: h.supervisorPosition,
    schedule: DEFAULT_SCHEDULE,
  };
}

/** Pinupunan ang mga blangko mula sa system; read-only ang pangalan, course, semester at buwan */
function normalize(c: DtrContent, h: DtrHeader): DtrContent {
  const keep = (mine: string | undefined, fromSystem: string) => (mine && mine.trim() ? mine : fromSystem);
  return {
    ...c,
    studentName: h.studentName || c.studentName,
    courseYear: courseYear(h) || c.courseYear,
    semester: h.semester || c.semester,
    monthLabel: h.monthLabel || c.monthLabel,
    company: keep(c.company, h.company),
    department: keep(c.department, h.department),
    supervisorName: keep(c.supervisorName, h.supervisorName),
    supervisorPosition: keep(c.supervisorPosition, h.supervisorPosition),
    schedule: c.schedule ?? DEFAULT_SCHEDULE,
    rows: c.rows.map((r) => (r.id ? r : { ...r, id: newId() })),
  };
}

function parseContent(raw: string): DtrContent | null {
  try {
    const c = JSON.parse(raw) as DtrContent;
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

const TIME_FIELDS: { key: keyof DtrSchedule; label: string }[] = [
  { key: "amIn", label: "Morning in" },
  { key: "amOut", label: "Morning out" },
  { key: "pmIn", label: "Afternoon in" },
  { key: "pmOut", label: "Afternoon out" },
];

function DtrEditorBody({
  refId, onClose, onHoursChange,
}: { refId: string; onClose: () => void; onHoursChange?: (hours: number) => void }) {
  const key = `dtr:${refId}`;
  const [header, setHeader] = useState<DtrHeader | null>(null);
  const [content, setContent] = useState<DtrContent | null>(null);
  const [status, setStatus] = useState<Status>("local");
  const [loadError, setLoadError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const contentRef = useRef<DtrContent | null>(null);
  const headerRef = useRef<DtrHeader | null>(null);
  const stampRef = useRef(0);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<number | undefined>(undefined);
  const pushTimer = useRef<number | undefined>(undefined);
  const hoursCb = useRef(onHoursChange);
  hoursCb.current = onHoursChange;

  const persist = useCallback(async (dirty: boolean) => {
    const c = contentRef.current;
    if (!c) return;
    await saveDtr({
      key, owner: c.studentName, content: c, header: headerRef.current,
      clientUpdatedAt: stampRef.current, dirty,
      // Para malaman sa logout at sa Sync center kung kanino ang draft (offline mode)
      ownerEmail: localStorage.getItem("email")?.toLowerCase() ?? undefined,
    });
  }, [key]);

  const push = useCallback(async () => {
    const c = contentRef.current;
    if (!c || !dirtyRef.current) return;
    if (!navigator.onLine) { setStatus("offline"); return; }
    const sent = stampRef.current;
    setStatus("syncing");
    try {
      const res = await api.put<SaveResult>(`/student/dtr-draft/${refId}`, {
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
          hoursCb.current?.(totalHours(merged));
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

  const update = useCallback((next: DtrContent) => {
    contentRef.current = next;
    stampRef.current = Date.now();
    dirtyRef.current = true;
    setContent(next);
    setStatus(navigator.onLine ? "local" : "offline");
    hoursCb.current?.(totalHours(next));
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void persist(true), 300);
    window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => void push(), 1500);
  }, [persist, push]);

  // Pag-load: pinaghahambing ang kopya sa device at sa account; ang mas bago ang gagamitin
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await loadDtr(key);
      let server: ServerDetail | null = null;
      try {
        server = (await api.get<ServerDetail>(`/student/dtr-draft/${refId}`)).data;
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
          setLoadError("Open this page once while online so your DTR can be saved on this device.");
        }
        return;
      }

      const h = server.header;
      headerRef.current = h;
      setHeader(h);
      const localUsable = local && local.owner === h.studentName ? local : null;
      const remote = server.draft ? parseContent(server.draft.content) : null;
      const remoteStamp = server.draft?.clientUpdatedAt ?? 0;

      let chosen: DtrContent;
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

  function setField(k: "company" | "department" | "supervisorName" | "supervisorPosition", v: string) {
    if (content) update({ ...content, [k]: v });
  }
  function setSchedule(k: keyof DtrSchedule, v: string) {
    if (content) update({ ...content, schedule: { ...content.schedule, [k]: v } });
  }
  function setRow(i: number, patch: Partial<DtrRow>) {
    if (!content) return;
    update({ ...content, rows: content.rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
  }
  function toggleWorked(i: number, worked: boolean) {
    if (!content) return;
    const s = content.schedule;
    const r = content.rows[i];
    setRow(i, worked
      ? {
        worked,
        amIn: r.amIn || s.amIn, amOut: r.amOut || s.amOut,
        pmIn: r.pmIn || s.pmIn, pmOut: r.pmOut || s.pmOut,
      }
      : { worked });
  }
  function applySchedule() {
    if (!content) return;
    const s = content.schedule;
    update({
      ...content,
      rows: content.rows.map((r) => (r.worked ? { ...r, amIn: s.amIn, amOut: s.amOut, pmIn: s.pmIn, pmOut: s.pmOut } : r)),
    });
    notify.success("Applied to all the days you worked.");
  }
  function addRow() {
    if (!content || content.rows.length >= MAX_ROWS) return;
    const last = content.rows[content.rows.length - 1];
    const p = last ? parseIso(last.date) : null;
    const date = p ? new Date(Date.UTC(p.y, p.m - 1, p.d) + 86_400_000).toISOString().slice(0, 10) : "";
    update({ ...content, rows: [...content.rows, makeRow(date, content.schedule)] });
  }
  function removeRow(i: number) {
    if (!content || content.rows.length <= 1) return;
    update({ ...content, rows: content.rows.filter((_, idx) => idx !== i) });
  }

  function clearAll() {
    setConfirmClear(false);
    if (!header) return;
    update(freshContent(header));
    notify.success("Cleared. Your DTR is back to a blank month.");
  }

  function printNow() {
    document.body.dataset.printing = "dtr";
    const done = () => { delete document.body.dataset.printing; window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    window.print();
  }

  async function downloadPdf() {
    const root = document.getElementById("dtr-print-root");
    if (!root || !header) return;
    setPdfBusy(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
      const pageW = 215.9;
      const pageH = 330.2; // long bond 8.5 x 13 in
      const pdf = new jsPDF({ unit: "mm", format: [pageW, pageH] });
      const pages = Array.from(root.querySelectorAll<HTMLElement>(".dtr-page"));
      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], {
          scale: 2, backgroundColor: "#ffffff", useCORS: true,
          onclone: (doc) => {
            const el = doc.getElementById("dtr-print-root");
            if (el) { el.style.position = "static"; el.style.left = "0"; el.style.top = "0"; }
          },
        });
        let w = pageW;
        let h = (canvas.height * pageW) / canvas.width;
        if (h > pageH) { w = (pageW * pageH) / h; h = pageH; }
        if (i > 0) pdf.addPage([pageW, pageH]);
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", (pageW - w) / 2, 0, w, h);
      }
      pdf.save(`DTR-${(header.monthLabel || "draft").replace(/\s+/g, "-")}.pdf`);
    } catch (err) {
      console.error("DTR PDF failed", err);
      notify.error("Couldn't create the PDF. If you're offline, open this page online once first, or use Print and choose Save as PDF.");
    } finally {
      setPdfBusy(false);
    }
  }

  if (loadError) return <p className="mt-4 text-sm text-destructive">{loadError}</p>;
  if (!content || !header) return <p className="mt-4 text-sm text-muted-foreground">Loading your DTR…</p>;

  const StatusIcon = status === "syncing" ? Loader2 : status === "offline" || status === "error" ? CloudOff : Check;
  const total = totalHours(content);

  return (
    <div className="mt-4">
      <style>{`
        @media print {
          @page { size: 8.5in 13in; margin: 0; }
          body[data-printing="dtr"] > *:not(#dtr-print-root) { display: none !important; }
          body[data-printing="dtr"] > #dtr-print-root { position: static !important; left: 0 !important; display: block !important; }
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

      <h3 className="mb-2 mt-5 text-sm font-semibold">DTR details</h3>
      <dl className="grid gap-x-6 gap-y-3 rounded-lg border bg-background p-3 sm:grid-cols-2">
        <ReadOnly label="Student" value={content.studentName} />
        <ReadOnly label="Course and year" value={content.courseYear} />
        <ReadOnly label="Month" value={content.monthLabel} />
        <ReadOnly label="Semester and school year" value={content.semester} />
      </dl>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="dtr-company">Name of company / office</label>
          <Input id="dtr-company" className="mt-1" value={content.company} onChange={(e) => setField("company", e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="dtr-department">Department assigned</label>
          <Input id="dtr-department" className="mt-1" value={content.department} onChange={(e) => setField("department", e.target.value)} />
        </div>
      </div>

      <h3 className="mb-1 mt-6 text-sm font-semibold">Your usual schedule</h3>
      <p className="mb-2 text-xs text-muted-foreground">
        Set your usual time in and out, then apply it to every day you worked. You can still change any single day below.
      </p>
      <div className="rounded-lg border bg-background p-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TIME_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="text-xs font-medium text-muted-foreground" htmlFor={`dtr-sched-${f.key}`}>{f.label}</label>
              <Input
                id={`dtr-sched-${f.key}`} type="time" className="mt-1"
                value={content.schedule[f.key]} onChange={(e) => setSchedule(f.key, e.target.value)}
              />
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={applySchedule}>
          <CalendarClock className="mr-1 h-4 w-4" /> Apply to all days I worked
        </Button>
      </div>

      <div className="mb-1 mt-6 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Daily time record</h3>
        <p className="text-sm">
          Total: <b>{total === 0 ? "0" : formatHours(total)} hours</b>
        </p>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        Weekends are marked as no work. Turn on "Worked" for days you went in, and change the time if it was different.
        The hours are added up for you and filled in when you turn in.
      </p>
      <div className="flex flex-col gap-2">
        {content.rows.map((r, i) => (
          <div key={r.id} className={`rounded-lg border bg-background p-3 ${r.worked ? "" : "opacity-70"}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {r.date ? (
                <p className="w-20 text-sm font-medium">
                  {shortDate(r.date)} <span className="text-xs font-normal text-muted-foreground">{dayName(r.date)}</span>
                </p>
              ) : (
                <Input type="date" className="w-40" value={r.date} aria-label={`Date for row ${i + 1}`} onChange={(e) => setRow(i, { date: e.target.value })} />
              )}
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm">
                <input
                  type="checkbox" checked={r.worked} className="h-4 w-4 pointer-coarse:h-5 pointer-coarse:w-5"
                  onChange={(e) => toggleWorked(i, e.target.checked)}
                />
                Worked
              </label>
              <span className="ml-auto text-sm tabular-nums text-muted-foreground">
                {r.worked ? `${formatHours(rowHours(r)) || "0"} h` : "No work"}
              </span>
              <Button
                type="button" variant="ghost" size="icon" aria-label={`Remove ${r.date ? shortDate(r.date) : `row ${i + 1}`}`}
                disabled={content.rows.length <= 1} onClick={() => removeRow(i)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {r.worked && (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TIME_FIELDS.map((f) => (
                  <Input
                    key={f.key} type="time" value={r[f.key]} aria-label={`${f.label} on ${r.date ? shortDate(r.date) : `row ${i + 1}`}`}
                    onChange={(e) => setRow(i, { [f.key]: e.target.value })}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="self-start" disabled={content.rows.length >= MAX_ROWS} onClick={addRow}>
          <Plus className="mr-1 h-4 w-4" /> Add a day
        </Button>
      </div>

      <h3 className="mb-1 mt-6 text-sm font-semibold">Supervisor</h3>
      <p className="mb-2 text-xs text-muted-foreground">
        Filled in from your assigned department. Change it if someone else signs your DTR.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="dtr-supervisorName">Name of supervisor</label>
          <Input id="dtr-supervisorName" className="mt-1" value={content.supervisorName ?? ""} onChange={(e) => setField("supervisorName", e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="dtr-supervisorPosition">Position</label>
          <Input id="dtr-supervisorPosition" className="mt-1" value={content.supervisorPosition ?? ""} onChange={(e) => setField("supervisorPosition", e.target.value)} />
        </div>
      </div>

      <p className="mt-5 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        Next: open the preview to print it or save a PDF, have your supervisor sign each day, then upload the signed copy in "Your work".
      </p>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] gap-3 p-3 sm:max-h-[92dvh] sm:max-w-4xl sm:p-4">
          <DialogHeader>
            <DialogTitle>DTR preview</DialogTitle>
            <DialogDescription>
              This is how it will look on long bond paper (8.5 x 13 in). Print it or save it as a PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 bg-background px-1 py-1">
            <Button type="button" onClick={printNow}>
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
                {chunk(content.rows, content.rowsPerPage).length} page(s)
              </span>
            </summary>
            <div className="mt-3">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="dtr-rowsPerPage">Days per page</label>
              <select
                id="dtr-rowsPerPage"
                value={content.rowsPerPage ?? 0}
                onChange={(e) => update({ ...content, rowsPerPage: Number(e.target.value) })}
                className="mt-1 block h-9 w-full rounded-md border bg-background px-3 text-base outline-none pointer-coarse:h-11 md:text-sm focus-visible:ring-2 focus-visible:ring-ring sm:w-72"
              >
                <option value={0}>All days on one page (default)</option>
                {[10, 12, 15, 16, 20].map((n) => (
                  <option key={n} value={n}>{n} days per page</option>
                ))}
              </select>
              <p className="mt-2 text-xs text-muted-foreground">
                If the table is too tight or gets cut off when printing, choose fewer days per page. The signatures always go on the last page.
                The preview below updates right away.
              </p>
            </div>
          </details>
          <PaperPreview>
            <DtrSheet preview content={content} collegeAbbreviation={header.collegeAbbreviation} collegeLogoSrc={collegeLogoSrc(header.collegeLogoPath)} />
          </PaperPreview>
        </DialogContent>
      </Dialog>

      <div className="mt-4">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Close editor</Button>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear this DTR?"
        description="All the times and supervisor details you set for this month will be removed from this device and your account. This can't be undone."
        confirmLabel="Clear"
        loading={false}
        onConfirm={clearAll}
        onCancel={() => setConfirmClear(false)}
      />

      {createPortal(
        <div id="dtr-print-root" style={{ position: "fixed", left: -10000, top: 0 }}>
          <DtrSheet content={content} collegeAbbreviation={header.collegeAbbreviation} collegeLogoSrc={collegeLogoSrc(header.collegeLogoPath)} />
        </div>,
        document.body,
      )}
    </div>
  );
}

/** Nakatago sa simula; may button para buksan. Nananatiling naka-mount pagkabukas para hindi mawala ang edits. */
export function DtrEditor({ refId, onHoursChange }: { refId: string; onHoursChange?: (hours: number) => void }) {
  const [opened, setOpened] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">DTR maker</p>
          <p className="text-xs text-muted-foreground">
            Fill in your time in and out, then print it or save it as a PDF. Your work is saved on this device, even without internet.
          </p>
        </div>
        <Button
          type="button" variant={visible ? "outline" : "default"} size="sm"
          onClick={() => { setOpened(true); setVisible((v) => !v); }}
        >
          {visible ? "Hide" : "Write DTR"}
        </Button>
      </div>
      {opened && (
        <div className={visible ? "" : "hidden"}>
          <DtrEditorBody refId={refId} onClose={() => setVisible(false)} onHoursChange={onHoursChange} />
        </div>
      )}
    </div>
  );
}
