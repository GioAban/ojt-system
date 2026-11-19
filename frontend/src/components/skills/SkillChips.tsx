import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Skills bilang chips (hindi nae-edit). Ang tugma sa skills ng student ay naka-highlight; ang iba ay malabo.
 * Kapag marami, ang unang ilan lang at "+N more".
 */
export function SkillChips({ matched = [], others = [], skills, collapseAfter = 8, emptyText }: {
  /** Mga tugmang skill (naka-highlight) */
  matched?: string[];
  /** Ibang skill (malabo) */
  others?: string[];
  /** Kapag walang pagtutugma: lahat ng skill na pare-pareho ang itsura */
  skills?: string[];
  collapseAfter?: number;
  emptyText?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const all = skills
    ? skills.map((s) => ({ s, kind: "plain" as const }))
    : [...matched.map((s) => ({ s, kind: "match" as const })), ...others.map((s) => ({ s, kind: "other" as const }))];
  if (all.length === 0) return emptyText ? <p className="text-xs text-muted-foreground">{emptyText}</p> : null;
  const shown = expanded ? all : all.slice(0, collapseAfter);
  const hidden = all.length - shown.length;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Skills">
      {shown.map(({ s, kind }) => (
        <li
          key={`${kind}-${s}`}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-xs",
            kind === "match" && "border-emerald-600/40 bg-emerald-600/10 font-medium text-emerald-800 dark:text-emerald-300",
            kind === "other" && "border-dashed text-muted-foreground",
            kind === "plain" && "bg-muted",
          )}
        >
          {kind === "match" && <span className="sr-only">Matches your skills: </span>}
          {s}
        </li>
      ))}
      {hidden > 0 && (
        <li>
          <button type="button" className="rounded-full px-2 py-0.5 text-xs text-primary hover:underline pointer-coarse:min-h-8" onClick={() => setExpanded(true)}>
            +{hidden} more
          </button>
        </li>
      )}
    </ul>
  );
}
