import { useLocation, useNavigate } from "react-router-dom";
import { CloudOff, KeyRound } from "lucide-react";
import { useConnection } from "@/offline/connection";
import { usePageCache } from "@/offline/pageCache";
import { formatWhen } from "@/offline/format";
import { OFFLINE_VIEW_DAYS, isSharedDevice, offlineViewExpired } from "@/offline/session";
import { startRelogin } from "@/offline/relogin";
import { Button } from "@/components/ui/button";

/**
 * Banner sa ilalim ng top nav: offline (at kung naka-save na datos ang ipinapakita), o nag-expire ang login.
 * Wala itong ipinapakita kapag online at maayos.
 */
export function OfflineBanner() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { online, authExpired } = useConnection();
  const page = usePageCache(pathname);

  if (online && !authExpired) return null;

  if (online && authExpired) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 sm:px-6 dark:text-amber-200">
        <KeyRound className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          Your session expired. Log in again to continue. Anything saved on this device stays here.
        </span>
        <Button size="sm" variant="outline" onClick={() => startRelogin(navigate)}>
          Log in again
        </Button>
      </div>
    );
  }

  let text: string;
  if (isSharedDevice()) {
    text = "You're offline. Offline mode is off on a shared computer, so saved pages aren't available.";
  } else if (offlineViewExpired()) {
    text = `You've been offline for more than ${OFFLINE_VIEW_DAYS} days. Connect to the internet and log in again to see your saved data.`;
  } else if (page.servedAt !== null) {
    text = `You're offline. Showing saved data from ${formatWhen(page.servedAt)}. Actions that need a connection are paused.`;
  } else if (page.missing) {
    text = "You're offline, and this page hasn't been saved on this device yet. Open it once while online to use it offline.";
  } else {
    text = "You're offline. Pages you opened before are still available. Actions that need a connection are paused.";
  }

  return (
    <div role="status" className="flex items-start gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 sm:px-6 dark:text-amber-200">
      <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{text}</span>
    </div>
  );
}
