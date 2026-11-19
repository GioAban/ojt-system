import { Sparkles } from "lucide-react";
import { dismissUpdate, reloadToUpdate, useAppUpdate } from "@/offline/serviceWorker";
import { Button } from "@/components/ui/button";

/** "New version available": lumalabas kapag may bagong deploy at handa na ang bagong bersyon */
export function UpdatePrompt() {
  const { available } = useAppUpdate();
  if (!available) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl border bg-popover p-3 text-sm text-popover-foreground shadow-lg sm:inset-x-auto sm:left-4 sm:mx-0"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">New version available</p>
        <p className="text-xs text-muted-foreground">Reload to get the latest updates.</p>
      </div>
      <Button size="sm" variant="ghost" onClick={dismissUpdate}>
        Later
      </Button>
      <Button size="sm" onClick={reloadToUpdate}>
        Reload
      </Button>
    </div>
  );
}
