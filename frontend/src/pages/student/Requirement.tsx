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
import type { RequirementDetail, SubmissionItem } from "@/types/studentProfile";
import { TYPE_LABEL, formatDue, formatSize, isPastDue, normType } from "@/lib/requirementUi";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ConfirmDialog } from "@/components/ConfirmDialog";
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

export default function RequirementPage() {
  const { id } = useParams();
  const base = `/student/requirements/${id}`;
  const [data, setData] = useState<RequirementDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [confirmTurnIn, setConfirmTurnIn] = useState(false);
  const [confirmUnsubmit, setConfirmUnsubmit] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api
      .get<RequirementDetail>(base)
      .then((res) => { setData(res.data); setError(""); })
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
      const form = new FormData();
      form.append("file", file);
      await run(async () => {
        const res = await api.post<RequirementDetail>(`${base}/files`, form);
        setData(res.data);
      });
    }
  }

  async function addLink() {
    await run(async () => {
      const res = await api.post<RequirementDetail>(`${base}/links`, {
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
      const res = await api.delete<RequirementDetail>(`${base}/items/${item.id}`);
      setData(res.data);
    });
  }

  async function turnIn() {
    setConfirmTurnIn(false);
    await run(async () => {
      const res = await api.post<RequirementDetail>(`${base}/turn-in`);
      setData(res.data);
    }, "Turned in! Your coordinator will check it.");
  }

  async function unsubmit() {
    setConfirmUnsubmit(false);
    await run(async () => {
      const res = await api.post<RequirementDetail>(`${base}/unsubmit`);
      setData(res.data);
    }, "Unsubmitted. You can edit your work again.");
  }

  const chip = data ? statusChip(data.status) : null;
  const checked = data?.status.trim().toLowerCase() === "checked";
  const turnedIn = data?.status.trim().toLowerCase() === "for checking";
  const invalid = data?.status.trim().toLowerCase() === "invalid";
  const overdue = data ? isPastDue(data.dueDate) && !checked && !turnedIn : false;

  return (
    <DashboardLayout>
      <Link to="/student/home" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Home
      </Link>

      {error && !data && <p className="text-sm text-destructive">{error}</p>}

      {!data && !error && (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      )}

      {data && chip && (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
          {/* Kaliwa: ang requirement mismo */}
          <section className="rounded-xl border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {TYPE_LABEL[normType(data.type)]}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{data.title}</h1>
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
              <p className="text-sm text-muted-foreground">No instructions were added for this requirement.</p>
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
          </section>

          {/* Kanan: ang gawa ng student */}
          <aside className="rounded-xl border bg-card p-5 lg:sticky lg:top-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Your work</h2>
              <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", chip.cls)}>{chip.text}</span>
            </div>

            {checked && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-600/30 bg-emerald-600/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Your coordinator checked this. It's now locked and can't be changed.</p>
              </div>
            )}
            {invalid && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Your coordinator marked this as invalid. Please fix your work and turn it in again.</p>
              </div>
            )}
            {turnedIn && (
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
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setLinkOpen(true)}>
                    <Link2 className="mr-1 h-4 w-4" /> Add link
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Up to 25 MB per file</p>
                <input
                  ref={fileRef} type="file" multiple className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) void upload(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
            )}

            {data.canEdit && (
              <Button className="mt-4 w-full" disabled={busy || !data.canTurnIn} onClick={() => setConfirmTurnIn(true)}>
                Turn in
              </Button>
            )}
            {data.canEdit && !data.canTurnIn && (
              <p className="mt-2 text-center text-xs text-muted-foreground">Add a file or a link to turn in.</p>
            )}
            {data.canUnsubmit && (
              <Button className="mt-4 w-full" variant="outline" disabled={busy} onClick={() => setConfirmUnsubmit(true)}>
                <Undo2 className="mr-1 h-4 w-4" /> Unsubmit
              </Button>
            )}
            {checked && data.items.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">Nothing was attached.</p>
            )}
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
