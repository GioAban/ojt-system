import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardPlus,
  Inbox,
  MessageSquare,
} from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/requirementUi";
import type { NotificationItem, NotificationsData } from "@/types/studentProfile";

/** Pinapadala kapag may nagbago (hal. nabasa na sa pahina ng Notifications) */
const EVENT = "student-notifications-changed";

function iconFor(type: string) {
  const t = type.toLowerCase();
  if (t === "turned_in") return { Icon: Inbox, cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400" };
  if (t === "assigned") return { Icon: ClipboardPlus, cls: "bg-primary/10 text-primary" };
  if (t === "checked") return { Icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
  if (t === "invalid") return { Icon: AlertCircle, cls: "bg-red-500/10 text-red-600 dark:text-red-400" };
  if (t.startsWith("comment")) return { Icon: MessageSquare, cls: "bg-violet-500/10 text-violet-600 dark:text-violet-400" };
  if (t.includes("company")) return { Icon: Building2, cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" };
  return { Icon: Bell, cls: "bg-muted text-muted-foreground" };
}

/** Kampana sa top bar: abiso ng student o ng coordinator, depende sa role */
export function NotificationBell() {
  const role = localStorage.getItem("role");
  const base = role === "STUDENT" ? "/student/notifications" : role === "COORDINATOR" ? "/coordinator/notifications" : null;

  const navigate = useNavigate();
  const [data, setData] = useState<NotificationsData | null>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    if (!base) return;
    api
      .get<NotificationsData>(base)
      .then((res) => { setData(res.data); setFailed(false); })
      .catch(() => setFailed(true));
  }, [base]);

  // Bilang at listahan: nagre-refresh kada 30 segundo at kapag bumalik sa tab
  useEffect(() => {
    load();
    if (!base) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(EVENT, load);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(EVENT, load);
    };
  }, [base, load]);

  const markRead = useCallback(async () => {
    if (!base) return;
    try {
      await api.post(`${base}/read`);
      setData((prev) => (prev ? { unread: 0, items: prev.items } : prev));
    } catch {
      // hindi kritikal
    }
  }, [base]);

  function close() {
    setOpen(false);
    // Itinuturing na nakita na ang mga abiso kapag isinara ang listahan
    if (data && data.unread > 0) void markRead();
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data]);

  if (!base) return null;

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  function toggle() {
    if (open) { close(); return; }
    setOpen(true);
    load();
  }

  function go(n: NotificationItem) {
    close();
    if (n.link) navigate(n.link);
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-2 top-14 z-50 mt-1 overflow-hidden rounded-xl border bg-background shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:w-96"
        >
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <h2 className="text-sm font-semibold">Notifications</h2>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markRead()}
                className="text-xs font-medium text-primary hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {data === null && !failed && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
            )}
            {failed && data === null && (
              <p className="px-4 py-8 text-center text-sm text-destructive">Couldn't load your notifications.</p>
            )}
            {data && items.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <Bell className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">You're all caught up.</p>
              </div>
            )}
            {items.length > 0 && (
              <ul className="divide-y">
                {items.map((n) => {
                  const { Icon, cls } = iconFor(n.type);
                  return (
                    <li key={n.key}>
                      <button
                        type="button"
                        onClick={() => go(n)}
                        className={cn(
                          "flex w-full items-start gap-3 px-4 py-3 text-left outline-none transition hover:bg-muted/60 focus-visible:bg-muted/60",
                          n.unread && "bg-primary/5",
                        )}
                      >
                        <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", cls)}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-sm", n.unread ? "font-semibold" : "font-medium")}>{n.title}</span>
                          {n.message && (
                            <span className="mt-0.5 line-clamp-2 block whitespace-pre-wrap text-xs text-muted-foreground">{n.message}</span>
                          )}
                          <span className="mt-1 block text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                        </span>
                        {n.unread && <span aria-label="Unread" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {role === "STUDENT" && (
            <div className="border-t px-4 py-2 text-center">
              <Link to="/student/notifications" onClick={close} className="text-xs font-medium text-primary hover:underline">
                View all
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
