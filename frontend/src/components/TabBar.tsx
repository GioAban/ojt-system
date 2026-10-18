import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountBadge } from "@/components/companies/CountBadge";

export interface TabDef<K extends string> {
  key: K;
  label: string;
  /** Bilang ng hindi pa nagagawa; may pulang bilog kapag higit sa 0 */
  count?: number;
  /** Naka-lock pa (hal. hindi pa Deployed). Pwede pa ring buksan para makita ang paliwanag. */
  locked?: boolean;
}

interface Props<K extends string> {
  tabs: TabDef<K>[];
  value: K;
  onChange: (key: K) => void;
  size?: "md" | "sm";
  label: string;
}

/** Simpleng tab bar na may warning count sa bawat tab */
export function TabBar<K extends string>({ tabs, value, onChange, size = "md", label }: Props<K>) {
  return (
    <div role="tablist" aria-label={label} className={cn("flex gap-1 overflow-x-auto border-b", size === "sm" && "border-b-0")}>
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              size === "md"
                ? cn("-mb-px border-b-2 px-4 py-2.5", active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")
                : cn("rounded-full border px-3 py-1.5", active ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted"),
            )}
          >
            {t.locked && <Lock className="h-3 w-3" aria-label="Locked" />}
            {t.label}
            <CountBadge count={t.count ?? 0} />
          </button>
        );
      })}
    </div>
  );
}
