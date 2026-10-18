import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Bell, Building2, CheckCircle2, ClipboardPlus, MessageSquare } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/requirementUi";
import type { NotificationItem, NotificationsData } from "@/types/studentProfile";
import { notifyStudentNotificationsChanged } from "@/hooks/useStudentNotifications";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";

function iconFor(type: string) {
  const t = type.toLowerCase();
  if (t === "assigned") return { Icon: ClipboardPlus, cls: "bg-primary/10 text-primary" };
  if (t === "checked") return { Icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
  if (t === "invalid") return { Icon: AlertCircle, cls: "bg-red-500/10 text-red-600 dark:text-red-400" };
  if (t.startsWith("comment")) return { Icon: MessageSquare, cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400" };
  if (t.includes("company")) return { Icon: Building2, cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" };
  return { Icon: Bell, cls: "bg-muted text-muted-foreground" };
}

function Row({ n }: { n: NotificationItem }) {
  const { Icon, cls } = iconFor(n.type);
  const body = (
    <div className={cn("flex items-start gap-3 rounded-xl border p-3 transition", n.unread ? "bg-primary/5" : "bg-card", n.link && "hover:bg-muted/50")}>
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", cls)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm", n.unread ? "font-semibold" : "font-medium")}>{n.title}</p>
          <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
        </div>
        {n.message && <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{n.message}</p>}
      </div>
      {n.unread && <span aria-label="Unread" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
    </div>
  );
  return n.link ? (
    <Link to={n.link} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
      {body}
    </Link>
  ) : (
    body
  );
}

export default function StudentNotifications() {
  const [data, setData] = useState<NotificationsData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<NotificationsData>("/student/notifications")
      .then(async (res) => {
        setData(res.data);
        if (res.data.unread > 0) {
          // Ipinapakita muna kung alin ang bago, saka minamarkahang nabasa na
          try {
            await api.post("/student/notifications/read");
            notifyStudentNotificationsChanged();
          } catch {
            // hindi kritikal
          }
        }
      })
      .catch((err) => setError(getErrorMessage(err, "Couldn't load your notifications.")));
  }, []);

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">New tasks from your coordinator, results, and comments.</p>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!data && !error && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      )}
      {data && data.items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <Bell className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">You're all caught up.</p>
        </div>
      )}
      {data && data.items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {data.items.map((n) => (
            <li key={n.key}>
              <Row n={n} />
            </li>
          ))}
        </ul>
      )}
    </DashboardLayout>
  );
}
