import { useEffect, useState } from "react";
import { Megaphone, Pin } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { timeAgo } from "@/lib/requirementUi";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AnnouncementFileList, type AnnouncementFileItem } from "@/components/announcements/AnnouncementFileList";
import { Skeleton } from "@/components/ui/skeleton";

interface AnnouncementItem {
  id: number;
  title: string;
  message: string;
  pinned: boolean;
  postedBy: string;
  createdAt: string;
  files: AnnouncementFileItem[];
}

export default function StudentAnnouncements() {
  const [items, setItems] = useState<AnnouncementItem[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<AnnouncementItem[]>("/student/announcements")
      .then((res) => setItems(res.data))
      .catch((err) => setError(getErrorMessage(err, "Couldn't load the announcements.")));
  }, []);

  return (
    <DashboardLayout>
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Announcements</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Updates and files from your coordinator.</p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!items && !error && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      )}

      {items && items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <Megaphone className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No announcements yet.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {(items ?? []).map((a) => (
          <article key={a.id} className="rounded-xl border bg-card p-4">
            <h2 className="flex items-center gap-2 font-semibold">
              {a.pinned && <Pin className="h-4 w-4 text-primary" aria-label="Pinned" />}
              {a.title}
            </h2>
            <p className="text-xs text-muted-foreground">
              {a.postedBy ? `Posted by ${a.postedBy} · ` : ""}
              {timeAgo(a.createdAt)}
            </p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">{a.message}</p>
            <AnnouncementFileList base="/student/announcements" announcementId={a.id} files={a.files} />
          </article>
        ))}
      </div>
    </DashboardLayout>
  );
}
