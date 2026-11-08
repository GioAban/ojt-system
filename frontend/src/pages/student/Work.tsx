import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, CalendarClock, CheckCircle2, Download, FileText,
  Link2, Loader2, Lock, Plus, Trash2, Undo2, Upload, XCircle,
} from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { openExternalLink, openProtectedFile } from "@/lib/files";
import type { MaterialItem } from "@/types/requirements";
import type { SubmissionItem, WorkDetail } from "@/types/studentProfile";
import { MaterialChip } from "@/components/requirements/MaterialChip";
import { StudentEvaluationForm, type StudentEvaluationHandle } from "@/components/evaluation/StudentEvaluationForm";
import { SIGNED_COPY_ACCEPT, isSignedCopyName } from "@/lib/evaluationForm";
import { SCOPE_LABEL, TYPE_LABEL, formatDue, formatSize, isPastDue, normType } from "@/lib/requirementUi";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PrivateComments } from "@/components/PrivateComments";
import { WeeklyReportEditor } from "@/components/weekly/WeeklyReportEditor";
import { DtrEditor } from "@/components/dtr/DtrEditor";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const MAX_BYTES = 25 * 1024 * 1024;

function statusChip(status: string) {
  switch (status.trim().toLowerCase()) {
    case "checked":
      return { text: "Checked", cls: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400" };
    case "for checking":
      return { text: "Turned in", cls: "border-blue-600/30 bg-blue-600/10 text-blue-700 dark:text-blue-400" };
    case "invalid":
      return { text: "Needs revision", cls: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400" };
    default:
      return { text: "Assigned", cls: "border-border bg-muted text-muted-foreground" };
  }
}

function ItemRow({
  item, removable, busy, onRemove,
}: { item: SubmissionItem; removable: boolean; busy: boolean; onRemove: () => void }) {
  const isLink = item.kind === "LINK";
  const Icon = isLink ? Link2 : FileText;
  const open = item.url ?? undefined;
  return (
    <li className="flex items-center gap-3 rounded-lg border bg-background p-2.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        {open ? (
          <a href={open} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium hover:underline">
            {item.name}
          </a>
        ) : (
          <p className="truncate text-sm font-medium">{item.name}</p>
        )}
        <p className="truncate text-xs text-muted-foreground">
          {isLink ? item.url : formatSize(item.sizeBytes) || "File"}
        </p>
      </div>
      {removable && (
        <Button
          type="button" variant="ghost" size="icon" disabled={busy}
          aria-label={`Remove ${item.name}`} onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </li>
  );
}

export default function WorkPage() {
  const { scope, id } = useParams();
  const base = `/student/work/${scope}/${id}`;
  const [data, setData] = useState<WorkDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [hours, setHours] = useState("");
  const [confirmTurnIn, setConfirmTurnIn] = useState(false);
  const [confirmUnsubmit, setConfirmUnsubmit] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const evaluationRef = useRef<StudentEvaluationHandle>(null);
  const [scores, setScores] = useState<{ missing: string[]; any: boolean }>({ missing: [], any: false });

  const load = useCallback(() => {
    api
      .get<WorkDetail>(base)
      .then((res) => {
        setData(res.data);
        setHours(res.data.hours === null ? "" : String(res.data.hours));
        setError("");
      })
      .catch((err) => setError(getErrorMessage(err, "Couldn't open this requirement.")));
  }, [base]);

  useEffect(() => { load(); }, [load]);

  async function run<T>(action: () => Promise<T>, okMsg?: string) {
    setBusy(true);
    try {
      await action();
      if (okMsg) notify.success(okMsg);
    } catch (err) {
      notify.error(getErrorMessage(err, "Something went wrong. Please try again."));
      load();
    } finally {
      setBusy(false);
    }
  }

  async function upload(files: FileList | File[]) {
    if (!data?.canEdit) return;
    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) {
        notify.error(`${file.name} is too big. The limit is 25 MB.`);
        continue;
      }
      if (data.systemKey && !isSignedCopyName(file.name)) {
        notify.error(`${file.name} isn't an image or PDF. Upload the signed copy as an image or PDF.`);
        continue;
      }
      const form = new FormData();
      form.append("file", file);
      await run(async () => {
        const res = await api.post<WorkDetail>(`${base}/files`, form);
        setData(res.data);
      });
    }
  }

  async function addLink() {
    await run(async () => {
      const res = await api.post<WorkDetail>(`${base}/links`, {
        url: linkUrl.trim(), name: linkName.trim() || null,
      });
      setData(res.data);
      setLinkOpen(false);
      setLinkUrl("");
      setLinkName("");
    }, "Link added.");
  }

  async function remove(item: SubmissionItem) {
    await run(async () => {
      const res = await api.delete<WorkDetail>(`${base}/items/${item.id}`);
      setData(res.data);
    });
  }

  async function turnIn() {
    setConfirmTurnIn(false);
    await run(async () => {
      // Ang huling tinype na score ang dapat masuri at maisumite
      await evaluationRef.current?.flush();
      const res = await api.post<WorkDetail>(`${base}/turn-in`, {
        hours: data?.needsHours ? Number(hours) : null,
      });
      setData(res.data);
    }, "Turned in! Your coordinator will check it.");
  }

  async function unsubmit() {
    setConfirmUnsubmit(false);
    await run(async () => {
      const res = await api.post<WorkDetail>(`${base}/unsubmit`);
      setData(res.data);
    }, "Unsubmitted. You can edit your work again.");
  }

  async function openMaterial(material: MaterialItem) {
    if (material.kind === "LINK") {
      if (!material.url || !openExternalLink(material.url)) notify.error("That link can't be opened.");
      return;
    }
    try {
      await openProtectedFile(`${base}/materials/${material.id}/file`, material.name);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Couldn't open the file.");
    }
  }

  const hoursValid = hours.trim() !== "" && Number(hours) >= 0 && Number(hours) <= 744 && Number.isFinite(Number(hours));
  const chip = data ? statusChip(data.status) : null;
  const checked = data?.status.trim().toLowerCase() === "checked";
  const turnedIn = data?.status.trim().toLowerCase() === "for checking";
  const invalid = data?.status.trim().toLowerCase() === "invalid";
  const scoresIncomplete = Boolean(data?.systemKey) && scores.any && scores.missing.length > 0;
  const overdue = data ? isPastDue(data.dueDate) && !checked && !turnedIn && !data.closed : false;

  return (
    <DashboardLayout>
      <Link to="/student/home" className="mb-4 inline-flex items-center gap-1 py-1 text-sm text-muted-foreground hover:text-foreground pointer-coarse:py-2.5">
        <ArrowLeft className="h-4 w-4" /> Back to Home
      </Link>

      {error && !data && <p className="text-sm text-destructive">{error}</p>}

      {!data && !error && (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      )}

      {data?.locked && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-14 text-center">
          <Lock className="h-8 w-8 text-muted-foreground" />
          <h1 className="px-4 text-lg font-semibold">{data.title}</h1>
          <p className="max-w-sm px-4 text-sm text-muted-foreground">
            Not open yet. Your coordinator will open this when it is time.
          </p>
        </div>
      )}

      {data && !data.locked && chip && (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
          {/* Kaliwa: ang requirement mismo */}
          <section className="min-w-0 rounded-xl border bg-card p-4 sm:p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {data.systemKey ? data.title : (SCOPE_LABEL[data.scope] ?? "Requirement")} · {TYPE_LABEL[normType(data.type)]}
            </p>
            <h1 className="mt-1 break-words text-xl font-bold tracking-tight sm:text-2xl">{data.title}</h1>
            <p
              className={cn(
                "mt-2 inline-flex items-center gap-1.5 text-sm",
                overdue ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground",
              )}
            >
              <CalendarClock className="h-4 w-4" />
              {data.dueDate ? `Due ${formatDue(data.dueDate, true)}` : "No due date"}
              {overdue && " · Overdue"}
            </p>

            <h2 className="mb-1 mt-6 text-sm font-semibold">Instructions</h2>
            {data.instructions && data.instructions.trim() ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{data.instructions}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No instructions were added.</p>
            )}

            {data.templateUrl && (
              <>
                <h2 className="mb-2 mt-6 text-sm font-semibold">Template</h2>
                <a
                  href={data.templateUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg border bg-background p-2.5 transition hover:bg-muted/50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{data.templateName ?? "Template"}</p>
                    <p className="text-xs text-muted-foreground">Download, fill it out, then upload it on the right</p>
                  </div>
                  <Download className="h-4 w-4 text-muted-foreground" />
                </a>
              </>
            )}

            {data.materials.length > 0 && (
              <>
                <h2 className="mb-2 mt-6 text-sm font-semibold">Attachments</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {data.materials.map((m) => (
                    <MaterialChip
                      key={m.id}
                      kind={m.kind}
                      name={m.name}
                      url={m.url}
                      size={m.size}
                      contentType={m.contentType}
                      onOpen={() => void openMaterial(m)}
                    />
                  ))}
                </div>
              </>
            )}

            {data.systemKey && (
              <div className="mt-6 border-t pt-5">
                <StudentEvaluationForm
                  key={`${data.status}-${data.closed}`}
                  ref={evaluationRef}
                  requirementId={data.id}
                  canEdit={data.canEdit}
                  onScoresChange={setScores}
                />
              </div>
            )}

            {data.scope === "weekly" && id && (
              <div className="mt-6 border-t pt-5">
                <WeeklyReportEditor refId={id} />
              </div>
            )}

            {data.scope === "dtr" && id && (
              <div className="mt-6 border-t pt-5">
                <DtrEditor
                  refId={id}
                  onHoursChange={(h) => { if (data.canEdit && h > 0) setHours(String(h)); }}
                />
              </div>
            )}
          </section>

          {/* Kanan: ang gawa ng student */}
          <aside className="min-w-0 rounded-xl border bg-card p-4 sm:p-5 lg:sticky lg:top-18">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">{data.systemKey ? "Signed copy" : "Your work"}</h2>
              <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", chip.cls)}>{chip.text}</span>
            </div>

            {data.closed && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Your coordinator closed this evaluation. Your work is saved, but you can't change it until it's reopened.</p>
              </div>
            )}
            {checked && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-600/30 bg-emerald-600/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Your coordinator checked this. It's now locked and can't be changed.</p>
              </div>
            )}
            {invalid && !data.closed && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Your coordinator marked this as invalid. Please fix your work and turn it in again.</p>
              </div>
            )}
            {turnedIn && !data.closed && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Turned in. Waiting for your coordinator to check it. Unsubmit if you need to change something.</p>
              </div>
            )}

            {data.items.length > 0 && (
              <ul className="mt-4 flex flex-col gap-2">
                {data.items.map((it) => (
                  <ItemRow key={it.id} item={it} removable={data.canEdit} busy={busy} onRemove={() => void remove(it)} />
                ))}
              </ul>
            )}

            {data.canEdit && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
                }}
                className={cn(
                  "mt-4 flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-5 text-center transition",
                  dragging ? "border-primary bg-primary/5" : "border-border",
                )}
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
                <p className="text-sm text-muted-foreground">Drag a file here, or</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                    <Plus className="mr-1 h-4 w-4" /> Upload file
                  </Button>
                  {!data.systemKey && (
                    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setLinkOpen(true)}>
                      <Link2 className="mr-1 h-4 w-4" /> Add link
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {data.systemKey ? "An image or PDF, up to 25 MB" : "Up to 25 MB per file"}
                </p>
                <input
                  ref={fileRef} type="file" multiple className="hidden"
                  accept={data.systemKey ? SIGNED_COPY_ACCEPT : undefined}
                  onChange={(e) => {
                    if (e.target.files?.length) void upload(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
            )}

            {data.needsHours && (
              <div className="mt-4">
                <label htmlFor="work-hours" className="text-sm font-medium">Hours rendered this month</label>
                <Input
                  id="work-hours" type="number" inputMode="decimal" min={0} max={744} step="0.5"
                  disabled={!data.canEdit} value={hours} onChange={(e) => setHours(e.target.value)}
                  placeholder="e.g. 120"
                  className="mt-1.5"
                />
                {data.canEdit && hours.trim() !== "" && !hoursValid && (
                  <p className="mt-1 text-xs text-destructive">Enter a number from 0 to 744.</p>
                )}
              </div>
            )}

            {data.canEdit && (
              <Button className="mt-4 w-full" disabled={busy || !data.canTurnIn || scoresIncomplete || (data.needsHours && !hoursValid)} onClick={() => setConfirmTurnIn(true)}>
                Turn in
              </Button>
            )}
            {data.canEdit && !data.canTurnIn && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                {data.systemKey ? "Upload the signed copy (an image or PDF) to turn in." : "Add a file or a link to turn in."}
              </p>
            )}
            {data.canEdit && scoresIncomplete && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                Fill in all the scores to turn in. Missing: {scores.missing.join(", ")}.
              </p>
            )}
            {data.canUnsubmit && (
              <Button className="mt-4 w-full" variant="outline" disabled={busy} onClick={() => setConfirmUnsubmit(true)}>
                <Undo2 className="mr-1 h-4 w-4" /> Unsubmit
              </Button>
            )}
            {checked && data.items.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">Nothing was attached.</p>
            )}

            <div className="mt-6 border-t pt-4">
              <PrivateComments
                listUrl={`${base}/comments`}
                postUrl={`${base}/comments`}
                otherParty="your coordinator"
                readOnly={!data.canComment}
              />
            </div>
          </aside>
        </div>
      )}

      <Dialog open={linkOpen} onOpenChange={(o) => { if (!busy) setLinkOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add link</DialogTitle>
            <DialogDescription>Paste a link to your work, like a Google Drive or Docs link. Make sure your coordinator can open it.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input autoFocus placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
            <Input placeholder="Name (optional)" value={linkName} onChange={(e) => setLinkName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setLinkOpen(false)}>Cancel</Button>
            <Button disabled={busy || !/^https?:\/\/.+/i.test(linkUrl.trim())} onClick={() => void addLink()}>
              {busy ? "Adding…" : "Add link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmTurnIn}
        title="Turn in your work?"
        description="Your coordinator will be able to check it. You can still unsubmit until it's checked."
        confirmLabel="Turn in"
        loading={busy}
        onConfirm={() => void turnIn()}
        onCancel={() => setConfirmTurnIn(false)}
      />
      <ConfirmDialog
        open={confirmUnsubmit}
        title="Unsubmit?"
        description="Your work goes back to draft so you can change it. Remember to turn it in again."
        confirmLabel="Unsubmit"
        loading={busy}
        onConfirm={() => void unsubmit()}
        onCancel={() => setConfirmUnsubmit(false)}
      />
    </DashboardLayout>
  );
}
