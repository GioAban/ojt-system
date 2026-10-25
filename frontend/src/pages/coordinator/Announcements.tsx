import { useRef, useState } from "react";
import { Megaphone, Pencil, Pin, Plus, Trash2, Upload, X } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { timeAgo } from "@/lib/requirementUi";
import { useSemester } from "@/contexts/semesterContext";
import { useSectionData } from "@/hooks/useTracking";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  AnnouncementFileList,
  formatSize,
  type AnnouncementFileItem,
} from "@/components/announcements/AnnouncementFileList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

const BASE = "/coordinator/announcements";
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.gif,.webp";
const ALLOWED = ["pdf", "png", "jpg", "jpeg", "gif", "webp"];
const MAX_FILES = 5;
const MAX_SIZE = 10 * 1024 * 1024;

interface AnnouncementItem {
  id: number;
  title: string;
  message: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  files: AnnouncementFileItem[];
}

function problemWith(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED.includes(ext)) return "Only PDF and image files are allowed.";
  if (file.size === 0) return "The file is empty.";
  if (file.size > MAX_SIZE) return "Larger than 10 MB.";
  return null;
}

interface FormProps {
  semesterId: number;
  editing: AnnouncementItem | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

function AnnouncementForm({
  semesterId,
  editing,
  onClose,
  onSaved,
}: FormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [message, setMessage] = useState(editing?.message ?? "");
  const [pinned, setPinned] = useState(editing?.pinned ?? false);
  const [picked, setPicked] = useState<File[]>([]);
  const [removeIds, setRemoveIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const kept = (editing?.files ?? []).filter((f) => !removeIds.includes(f.id));
  const pickedProblems = picked.map(problemWith);
  const tooMany = kept.length + picked.length > MAX_FILES;
  const hasProblem = pickedProblems.some(Boolean) || tooMany;

  function addFiles(list: File[]) {
    setError("");
    setPicked((prev) => {
      const next = [...prev];
      for (const f of list) {
        if (
          !next.some(
            (p) =>
              p.name === f.name &&
              p.size === f.size &&
              p.lastModified === f.lastModified,
          )
        )
          next.push(f);
      }
      return next;
    });
  }

  async function save() {
    if (!title.trim()) return setError("Enter a title.");
    if (!message.trim()) return setError("Write the announcement.");
    if (hasProblem) return;

    const form = new FormData();
    form.append("title", title.trim());
    form.append("message", message.trim());
    form.append("pinned", String(pinned));
    if (!editing) form.append("semesterId", String(semesterId));
    removeIds.forEach((id) => form.append("removeFileIds", String(id)));
    picked.forEach((f) => form.append("files", f));

    setSaving(true);
    setError("");
    try {
      await api.post(editing ? `${BASE}/${editing.id}` : BASE, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      notify.success(
        editing
          ? "Announcement updated."
          : "Announcement posted. Your students were notified.",
      );
      await onSaved();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save the announcement."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit announcement" : "New announcement"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Changes are shown to students right away. They aren't notified again."
              : "All your students in this semester will get a notification."}
          </DialogDescription>
        </DialogHeader>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Title</span>
          <Input
            value={title}
            maxLength={255}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Message</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            className="w-full rounded-md border bg-background p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
          />
          Pin to the top
        </label>

        <section className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Attachments ({kept.length + picked.length} of {MAX_FILES}) · PDF or
            images · up to 10 MB each
          </p>

          {kept.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
            >
              <span className="min-w-0 flex-1 truncate" title={f.name}>
                {f.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatSize(f.size)}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Remove ${f.name}`}
                onClick={() => setRemoveIds((ids) => [...ids, f.id])}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          {picked.map((f, i) => (
            <div
              key={`${f.name}-${f.size}`}
              className="flex items-center gap-2 rounded-md border border-primary/30 px-3 py-1.5 text-sm"
            >
              <span className="min-w-0 flex-1 truncate" title={f.name}>
                {f.name}
              </span>
              {pickedProblems[i] ? (
                <span className="shrink-0 text-xs text-destructive">
                  {pickedProblems[i]}
                </span>
              ) : (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatSize(f.size)}
                </span>
              )}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Remove ${f.name}`}
                onClick={() =>
                  setPicked((prev) => prev.filter((_, idx) => idx !== i))
                }
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            disabled={kept.length + picked.length >= MAX_FILES}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4" /> Add files
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              // Kopyahin muna bago i-clear ang input; live ang FileList
              const chosen = e.target.files ? Array.from(e.target.files) : [];
              e.target.value = "";
              if (chosen.length > 0) addFiles(chosen);
            }}
          />
          {tooMany && (
            <p className="text-xs text-destructive">
              You can attach up to {MAX_FILES} files.
            </p>
          )}
        </section>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void save()}
            disabled={saving || hasProblem}
          >
            {saving
              ? "Saving..."
              : editing
                ? "Save changes"
                : "Post announcement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CoordinatorAnnouncements() {
  const { semesterId, semester } = useSemester();
  const { data, loading, error, reload, refresh } = useSectionData<
    AnnouncementItem[]
  >(BASE, semesterId);

  const [form, setForm] = useState<{ editing: AnnouncementItem | null } | null>(
    null,
  );
  const [deleting, setDeleting] = useState<AnnouncementItem | null>(null);
  const [busy, setBusy] = useState(false);

  const items = data ?? [];

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`${BASE}/${deleting.id}`);
      notify.success("Announcement deleted.");
      setDeleting(null);
      await refresh();
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't delete the announcement."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Announcements"
        description={
          semester?.semester
            ? `Post updates and files for your students in ${semester.semester}.`
            : "Post updates and files for your students."
        }
        actions={
          <Button
            type="button"
            disabled={semesterId == null}
            onClick={() => setForm({ editing: null })}
          >
            <Plus className="h-4 w-4" /> New announcement
          </Button>
        }
      />

      {error && (
        <p className="mb-4 text-sm text-destructive">
          {error}{" "}
          <button type="button" className="underline" onClick={reload}>
            Retry
          </button>
        </p>
      )}

      {loading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Megaphone className="h-6 w-6 text-muted-foreground" />
          </span>
          <p className="text-sm text-muted-foreground">No announcements yet.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {items.map((a) => (
          <article key={a.id} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 font-semibold">
                  {a.pinned && (
                    <Pin className="h-4 w-4 text-primary" aria-label="Pinned" />
                  )}
                  {a.title}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {timeAgo(a.createdAt)}
                  {a.updatedAt && a.updatedAt !== a.createdAt
                    ? " · edited"
                    : ""}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Edit"
                  onClick={() => setForm({ editing: a })}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Delete"
                  onClick={() => setDeleting(a)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">
              {a.message}
            </p>
            <AnnouncementFileList
              base={BASE}
              announcementId={a.id}
              files={a.files}
            />
          </article>
        ))}
      </div>

      {form && semesterId != null && (
        <AnnouncementForm
          key={form.editing?.id ?? "new"}
          semesterId={semesterId}
          editing={form.editing}
          onClose={() => setForm(null)}
          onSaved={refresh}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this announcement?"
        description={
          deleting
            ? `"${deleting.title}" and its files will be removed for your students too.`
            : ""
        }
        confirmLabel="Delete"
        loading={busy}
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(null)}
      />
    </DashboardLayout>
  );
}
