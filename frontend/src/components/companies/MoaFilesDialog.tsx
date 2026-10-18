import { useRef, useState, type DragEvent } from "react";
import {
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import api from "@/lib/api";
import { formatLongDate } from "@/lib/dates";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import type { DepartmentItem, MoaFileItem } from "@/types/company";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp";
const ALLOWED = ["pdf", "doc", "docx", "jpg", "jpeg", "png", "gif", "webp"];
const MAX_SIZE = 20 * 1024 * 1024;
const MAX_PER_UPLOAD = 10;
const MAX_PER_DEPARTMENT = 20;

interface Picked {
  key: string;
  file: File;
  problem: string | null;
}

function problemWith(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED.includes(ext))
    return "Only PDF, Word, and image files are allowed.";
  if (file.size === 0) return "The file is empty.";
  if (file.size > MAX_SIZE) return "Larger than 20 MB.";
  return null;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isInline(file: MoaFileItem) {
  return (
    file.contentType === "application/pdf" ||
    file.contentType.startsWith("image/")
  );
}

function typeLabel(file: MoaFileItem) {
  if (file.contentType === "application/pdf") return "PDF";
  if (file.contentType.startsWith("image/")) return "Image";
  return "Word";
}

interface MoaFilesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName: string;
  department: DepartmentItem;
  readOnly: boolean;
  onChanged: () => void | Promise<void>;
}

export function MoaFilesDialog({
  open,
  onOpenChange,
  companyName,
  department,
  readOnly,
  onChanged,
}: MoaFilesDialogProps) {
  const base = `/coordinator/companies/departments/${department.id}/moa-files`;
  const files = department.moaFiles;

  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const valid = picked.filter((p) => !p.problem);
  const room = MAX_PER_DEPARTMENT - files.length;
  const overLimit = valid.length > MAX_PER_UPLOAD || valid.length > room;

  function addFiles(list: FileList | File[]) {
    setError("");
    setPicked((prev) => {
      const next = [...prev];
      for (const file of Array.from(list)) {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (next.some((p) => p.key === key)) continue;
        next.push({ key, file, problem: problemWith(file) });
      }
      return next;
    });
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }

  async function upload() {
    if (valid.length === 0 || overLimit) return;

    setUploading(true);
    setError("");

    const form = new FormData();
    valid.forEach((p) => form.append("files", p.file));

    try {
      await api.post(base, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      notify.success(
        `${valid.length} file${valid.length === 1 ? "" : "s"} uploaded to ${department.name ?? "the department"}.`,
      );
      setPicked([]);
      await onChanged();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to upload the files."));
    } finally {
      setUploading(false);
    }
  }

  async function openFile(file: MoaFileItem) {
    setOpeningId(file.id);
    setError("");

    // Binubuksan agad ang tab para hindi ito harangin ng browser
    const tab = isInline(file) ? window.open("about:blank", "_blank") : null;

    try {
      const res = await api.get(`${base}/${file.id}/file`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(
        new Blob([res.data], { type: file.contentType }),
      );

      if (tab) {
        tab.location.href = url;
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      tab?.close();
      setError(getErrorMessage(err, "Couldn't open the file."));
    } finally {
      setOpeningId(null);
    }
  }

  async function removeFile(file: MoaFileItem) {
    setDeletingId(file.id);
    setError("");

    try {
      await api.delete(`${base}/${file.id}`);
      notify.success(`${file.name} was deleted.`);
      setConfirmId(null);
      await onChanged();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't delete the file."));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Signed MOA files</DialogTitle>
          <DialogDescription>
            {department.name ?? "Department"} · {companyName}
          </DialogDescription>
        </DialogHeader>

        <section className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Uploaded ({files.length} of {MAX_PER_DEPARTMENT})
          </p>

          {files.length === 0 ? (
            <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
              No signed MOA has been uploaded yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {files.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    {f.contentType.startsWith("image/") ? (
                      <ImageIcon className="h-4 w-4" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={f.name}>
                      {f.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {typeLabel(f)} · {formatSize(f.size)} · Uploaded{" "}
                      {formatLongDate(f.uploadedAt)}
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={openingId === f.id}
                    onClick={() => void openFile(f)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {isInline(f) ? "View" : "Download"}
                  </Button>

                  {!readOnly &&
                    (confirmId === f.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={deletingId === f.id}
                          onClick={() => void removeFile(f)}
                        >
                          {deletingId === f.id ? "Deleting..." : "Delete"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={deletingId === f.id}
                          onClick={() => setConfirmId(null)}
                        >
                          Keep
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Delete ${f.name}`}
                        onClick={() => setConfirmId(f.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ))}
                </li>
              ))}
            </ul>
          )}
        </section>

        {readOnly ? (
          <p className="text-xs text-muted-foreground">
            This company or department is archived. Restore it to upload or
            delete files.
          </p>
        ) : (
          <section className="flex flex-col gap-3 border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground">
              Upload signed MOA
            </p>

            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                dragging && "border-primary bg-muted",
              )}
            >
              <Upload className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium">
                Drag files here, or click to choose
              </p>
              <p className="text-xs text-muted-foreground">
                PDF, Word, or images · up to 20 MB each · up to {MAX_PER_UPLOAD}{" "}
                at a time
              </p>
            </div>

            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />

            {picked.length > 0 && (
              <ul className="flex flex-col gap-1">
                {picked.map((p) => (
                  <li
                    key={p.key}
                    className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                  >
                    <span
                      className="min-w-0 flex-1 truncate"
                      title={p.file.name}
                    >
                      {p.file.name}
                    </span>
                    {p.problem ? (
                      <span className="shrink-0 text-xs text-destructive">
                        {p.problem}
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatSize(p.file.size)}
                      </span>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${p.file.name}`}
                      disabled={uploading}
                      onClick={() =>
                        setPicked((prev) => prev.filter((x) => x.key !== p.key))
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {overLimit && (
              <p className="text-xs text-destructive">
                {valid.length > MAX_PER_UPLOAD
                  ? `You can upload up to ${MAX_PER_UPLOAD} files at a time.`
                  : `Only ${Math.max(0, room)} more file(s) fit in this department.`}
              </p>
            )}
          </section>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          {!readOnly && (
            <Button
              type="button"
              disabled={uploading || valid.length === 0 || overLimit}
              onClick={() => void upload()}
            >
              {uploading
                ? "Uploading..."
                : valid.length > 0
                  ? `Upload ${valid.length} file${valid.length === 1 ? "" : "s"}`
                  : "Upload"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
