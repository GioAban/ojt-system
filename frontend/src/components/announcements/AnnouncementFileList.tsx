import { useState } from "react";
import { ExternalLink, FileText, Image as ImageIcon } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/button";

export interface AnnouncementFileItem {
  id: number;
  name: string;
  contentType: string;
  size: number;
  uploadedAt: string;
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  /** "/coordinator/announcements" o "/student/announcements" */
  base: string;
  announcementId: number;
  files: AnnouncementFileItem[];
}

/** Listahan ng attachment; binubuksan sa bagong tab (may login token kaya blob ang gamit) */
export function AnnouncementFileList({ base, announcementId, files }: Props) {
  const [openingId, setOpeningId] = useState<number | null>(null);

  if (files.length === 0) return null;

  async function open(file: AnnouncementFileItem) {
    setOpeningId(file.id);
    // Binubuksan agad ang tab para hindi ito harangin ng browser
    const tab = window.open("about:blank", "_blank");
    try {
      const res = await api.get(`${base}/${announcementId}/files/${file.id}`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: file.contentType }));
      if (tab) tab.location.href = url;
      else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      tab?.close();
      notify.error(getErrorMessage(err, "Couldn't open the file."));
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <ul className="mt-3 flex flex-col gap-2">
      {files.map((f) => (
        <li key={f.id} className="flex items-center gap-3 rounded-lg border p-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
            {f.contentType.startsWith("image/") ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={f.name}>{f.name}</p>
            <p className="text-xs text-muted-foreground">{formatSize(f.size)}</p>
          </div>
          <Button type="button" size="sm" variant="outline" disabled={openingId === f.id} onClick={() => void open(f)}>
            <ExternalLink className="h-3.5 w-3.5" /> View
          </Button>
        </li>
      ))}
    </ul>
  );
}
