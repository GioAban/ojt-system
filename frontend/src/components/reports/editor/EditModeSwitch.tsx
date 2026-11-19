import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Naka-off tuwing binubuksan ang report: read-only ang mga table hanggang i-on ito */
export function EditModeSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <Button
      type="button"
      role="switch"
      aria-checked={on}
      variant={on ? "default" : "outline"}
      size="sm"
      title={on
        ? "Edit mode is on. Use Save changes to database to write changes to real records."
        : "Turn on to edit this report and its records."}
      className={cn("gap-1.5")}
      onClick={() => onChange(!on)}
    >
      <Pencil className="h-3.5 w-3.5" />
      Edit mode: {on ? "on" : "off"}
    </Button>
  );
}
