import type { CSSProperties } from "react";
import { changeKeysOf, isPending, shownValue, type CellSpec } from "@/lib/reportFields";
import type { PendingMap } from "@/types/reports";

interface TypedCellProps {
  spec: CellSpec;
  pending: PendingMap;
  /** Ang ipinapakita kapag walang naghihintay na pagbabago */
  value: string;
  label: string;
  /** key ng pagbabago -> error mula sa server */
  problems: Record<string, string>;
  /** key -> kaka-save lang sa database (pansamantalang marka) */
  saved?: Record<string, true>;
  style?: CSSProperties;
  onOpen: (spec: CellSpec) => void;
}

/**
 * Isang cell sa papel kapag naka-on ang Edit mode (sa screen lang). Pinipindot para buksan ang tamang input.
 * Ang binago sa report lang ay may kulay at tuldok; ang naghihintay na pagbabago sa system ay may tuldok.
 */
export function TypedCell({ spec, pending, value, label, problems, saved, style, onOpen }: TypedCellProps) {
  const problem = changeKeysOf(spec).map((k) => problems[k]).find(Boolean);
  const justSaved = !problem && changeKeysOf(spec).some((k) => saved?.[k]);
  const shown = shownValue(spec, pending, value);

  let changed: boolean;
  let title: string;
  if (spec.type === "override") {
    changed = spec.system !== null && spec.value !== spec.system;
    title = changed
      ? `Edited in this report only, the system value is ${spec.system || "(blank)"}.`
      : `${spec.reason} Click to change it in this report only.`;
  } else {
    changed = spec.type === "period"
      ? isPending(spec.start, pending) || (spec.end !== null && isPending(spec.end, pending))
      : spec.type === "name"
        ? [spec.last, spec.first, spec.middle].some((x) => isPending(x, pending))
        : isPending(spec, pending);
    title = problem ?? (changed
      ? "Changed, not saved to the database yet. Use Save changes to database."
      : justSaved ? "Saved to the database." : "Click to change the real record.");
  }

  return (
    <span
      role="button"
      tabIndex={0}
      data-typed=""
      data-override={spec.type === "override" ? "" : undefined}
      data-edited={changed ? "" : undefined}
      data-problem={problem ? "" : undefined}
      data-saved={justSaved && !changed ? "" : undefined}
      title={title}
      aria-label={`${label}: ${shown || "blank"}${changed ? (spec.type === "override" ? ", edited in this report only" : ", changed") : ""}${problem ? `. ${problem}` : ""}`}
      style={style}
      onClick={() => onOpen(spec)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(spec);
        }
      }}
    >
      {shown}
    </span>
  );
}
