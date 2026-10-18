import { useEffect, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SemesterSwitcher } from "@/components/SemesterSwitcher";
import { NotificationBell } from "@/components/NotificationBell";
import { UserMenu } from "@/components/UserMenu";

/** Petsa at oras na gumagalaw; hiwalay na component para ito lang ang nagre-render kada segundo */
function DateTime() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const date = now.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = now.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex min-w-0 items-baseline gap-2 text-sm">
      <span className="hidden text-muted-foreground sm:inline">{date}</span>
      <time dateTime={now.toISOString()} className="font-semibold tabular-nums">
        {time}
      </time>
    </div>
  );
}

export function TopNav() {
  const showSemester = localStorage.getItem("role") === "COORDINATOR";

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-background px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger />
        <DateTime />
      </div>

      <div className="flex items-center gap-3">
        {showSemester && <SemesterSwitcher />}
        <NotificationBell />
        <UserMenu variant="topnav" />
      </div>
    </header>
  );
}
