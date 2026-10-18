import { useRef, useState } from "react";
import { Link2, Upload } from "lucide-react";
import {
  ACCEPT,
  ALLOWED_EXTENSIONS,
  MAX_ATTACHMENTS,
  MAX_FILES_PER_UPLOAD,
  MAX_FILE_BYTES,
  extensionOf,
} from "@/lib/files";
import { cn } from "@/lib/utils";
import type { MaterialItem, PendingLink } from "@/types/requirements";
import { MaterialChip } from "@/components/requirements/MaterialChip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AttachmentPickerProps {
  existing: MaterialItem[];
  files: File[];
  links: PendingLink[];
  onFilesChange: (files: File[]) => void;
  onLinksChange: (links: PendingLink[]) => void;
  onRemoveExisting: (id: number) => void;
  onProblem: (message: string) => void;
}

export function AttachmentPicker({
  existing,
  files,
  links,
  onFilesChange,
  onLinksChange,
  onRemoveExisting,
  onProblem,
}: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");

  const total = existing.length + files.length + links.length;

  function addFiles(list: FileList | File[]) {
    const problems: string[] = [];
    const accepted: File[] = [];

    for (const file of Array.from(list)) {
      if (!ALLOWED_EXTENSIONS.includes(extensionOf(file.name))) {
        problems.push(`"${file.name}" isn't an allowed file type.`);
      } else if (file.size > MAX_FILE_BYTES) {
        problems.push(`"${file.name}" is larger than 20 MB.`);
      } else if (
        files.some((f) => f.name === file.name && f.size === file.size)
      ) {
        // nakapili na ito
      } else {
        accepted.push(file);
      }
    }

    const room = Math.max(
      0,
      Math.min(MAX_FILES_PER_UPLOAD - files.length, MAX_ATTACHMENTS - total),
    );
    if (accepted.length > room) {
      problems.push(
        `You can add up to ${MAX_FILES_PER_UPLOAD} new files at a time, and ${MAX_ATTACHMENTS} attachments in total.`,
      );
    }

    const next = accepted.slice(0, room);
    if (next.length > 0) onFilesChange([...files, ...next]);
    onProblem(problems.join(" "));
  }

  function addLink() {
    const url = linkUrl.trim();

    if (!/^https?:\/\/\S+$/i.test(url)) {
      onProblem("Enter a valid link that starts with http:// or https://");
      return;
    }
    if (total >= MAX_ATTACHMENTS) {
      onProblem(`A requirement can have up to ${MAX_ATTACHMENTS} attachments.`);
      return;
    }

    onLinksChange([...links, { url, name: linkName.trim() }]);
    setLinkUrl("");
    setLinkName("");
    setLinkOpen(false);
    onProblem("");
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>
        Attachments <span className="text-muted-foreground">(optional)</span>
      </Label>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col gap-2 rounded-lg border border-dashed p-3 transition-colors",
          dragging && "border-primary bg-primary/5",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload files
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLinkOpen((v) => !v)}
          >
            <Link2 className="h-3.5 w-3.5" />
            Add link
          </Button>
          <span className="text-xs text-muted-foreground">
            or drop files here
          </span>
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

        {linkOpen && (
          <div className="flex flex-col gap-2 rounded-md bg-muted/40 p-2 sm:flex-row">
            <Input
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLink();
                }
              }}
            />
            <Input
              placeholder="Name (optional)"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLink();
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              className="shrink-0"
              onClick={addLink}
            >
              Add
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          PDF, images, Word, Excel, PowerPoint, TXT, CSV, ZIP · up to 20 MB each
        </p>
      </div>

      {total > 0 && (
        <div className="flex flex-col gap-1.5">
          {existing.map((m) => (
            <MaterialChip
              key={`m-${m.id}`}
              kind={m.kind}
              name={m.name}
              url={m.url}
              size={m.size}
              contentType={m.contentType}
              onRemove={() => onRemoveExisting(m.id)}
            />
          ))}

          {files.map((f) => (
            <MaterialChip
              key={`f-${f.name}-${f.size}`}
              kind="FILE"
              name={f.name}
              size={f.size}
              contentType={f.type}
              badge="New"
              onRemove={() => onFilesChange(files.filter((x) => x !== f))}
            />
          ))}

          {links.map((l) => (
            <MaterialChip
              key={`l-${l.url}`}
              kind="LINK"
              name={l.name || l.url}
              url={l.url}
              badge="New"
              onRemove={() => onLinksChange(links.filter((x) => x !== l))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
