import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CloudOff, KeyRound, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { checkNow, useConnection } from "@/offline/connection";
import { useSyncSummary } from "@/offline/syncSummary";
import { isSharedDevice } from "@/offline/session";
import { startRelogin } from "@/offline/relogin";
import { SyncCenter } from "@/components/offline/SyncCenter";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

type View = "online" | "offline" | "pending" | "synced" | "problem" | "auth";

const DOT: Record<View, string> = {
  online: "bg-emerald-500",
  synced: "bg-emerald-500",
  offline: "bg-amber-500",
  pending: "bg-sky-500",
  problem: "bg-destructive",
  auth: "bg-amber-500",
};

/**
 * Kalagayan ng koneksyon at ng pag-sync sa top nav (student at coordinator). Tahimik kapag maayos;
 * malinaw kapag offline, may naghihintay, may problema, o kailangang mag-login ulit.
 */
export function ConnectionStatus() {
  const navigate = useNavigate();
  const { online, checking, authExpired } = useConnection();
  const { drafts, failed, loaded } = useSyncSummary();
  const pending = drafts.length;
  const [syncCenter, setSyncCenter] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const previous = useRef<number | null>(null);

  // May naghihintay kanina at wala na ngayon habang online: maikling "All changes synced"
  useEffect(() => {
    if (!loaded) return;
    const before = previous.current;
    previous.current = pending;
    if (before !== null && before > 0 && pending === 0 && online) {
      setJustSynced(true);
      const t = window.setTimeout(() => setJustSynced(false), 4000);
      return () => window.clearTimeout(t);
    }
  }, [pending, online, loaded]);

  const view: View = authExpired
    ? "auth"
    : !online
      ? "offline"
      : failed > 0
        ? "problem"
        : pending > 0
          ? "pending"
          : justSynced
            ? "synced"
            : "online";

  const label: Record<View, string> = {
    online: "Online",
    synced: "All changes synced",
    offline: "Offline",
    pending: `${pending} to sync`,
    problem: `${failed} need attention`,
    auth: "Log in to sync",
  };

  const shared = isSharedDevice();

  return (
    <>
      <Popover>
        <PopoverTrigger
          className={cn(
            "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:h-10 pointer-coarse:px-2.5",
            view === "online" || view === "synced" ? "text-muted-foreground" : "border",
            view === "offline" && "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
            view === "auth" && "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
            view === "pending" && "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-300",
            view === "problem" && "border-destructive/40 bg-destructive/10 text-destructive",
          )}
          aria-label={`Connection: ${label[view]}. Open details.`}
        >
          <span className="relative flex h-2 w-2" aria-hidden="true">
            {(view === "offline" || view === "problem") && (
              <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", DOT[view])} />
            )}
            <span className={cn("relative inline-flex h-2 w-2 rounded-full", DOT[view])} />
          </span>
          {/* Sa phone: tuldok lang kapag maayos; may salita kapag may dapat malaman */}
          <span className={cn(view === "online" ? "hidden sm:inline" : "inline", "max-w-[9rem] truncate")}>{label[view]}</span>
        </PopoverTrigger>

        <PopoverContent align="end" className="w-80">
          <div className="flex flex-col gap-3">
            <div>
              <PopoverTitle className="flex items-center gap-2 text-sm font-semibold">
                <span className={cn("inline-flex h-2 w-2 rounded-full", DOT[view])} aria-hidden="true" />
                {view === "offline" ? "Offline" : view === "auth" ? "Session expired" : view === "problem" ? "Sync problem" : "Online"}
              </PopoverTitle>
              <PopoverDescription className="mt-1 text-sm text-muted-foreground">
                {view === "offline" &&
                  (shared
                    ? "You're on a shared computer, so nothing is saved on this device and offline mode is off."
                    : "Changes are saved on this device and sent when you're back online. Weekly reports, DTRs and reports work offline now; other actions will tell you if they need a connection.")}
                {view === "auth" && "Log in again to keep syncing. Everything saved on this device stays here until it's sent."}
                {view === "problem" && `${failed} change${failed === 1 ? "" : "s"} need${failed === 1 ? "s" : ""} attention. Open the Sync center to retry or discard.`}
                {(view === "online" || view === "synced") && "Connected. All changes are synced."}
                {view === "pending" && `${pending} change${pending === 1 ? " is" : "s are"} saved on this device and waiting to be sent.`}
              </PopoverDescription>
            </div>

            <div className="flex flex-wrap gap-2">
              {view === "auth" && (
                <Button size="sm" onClick={() => startRelogin(navigate)}>
                  <KeyRound className="h-4 w-4" /> Log in again
                </Button>
              )}
              {!shared && (
                <Button size="sm" variant={view === "pending" || view === "problem" ? "default" : "outline"} onClick={() => setSyncCenter(true)}>
                  {view === "offline" ? <CloudOff className="h-4 w-4" /> : null}
                  Sync center{pending + failed > 0 ? ` (${pending + failed})` : ""}
                </Button>
              )}
              <Button size="sm" variant="ghost" disabled={checking} onClick={() => void checkNow()}>
                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Check connection
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <SyncCenter open={syncCenter} onOpenChange={setSyncCenter} />
    </>
  );
}
