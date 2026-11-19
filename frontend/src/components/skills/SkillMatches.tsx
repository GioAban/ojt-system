import { useMemo, useState } from "react";
import { ChevronDown, MapPin, Target } from "lucide-react";
import { rankBySkills } from "@/lib/skills";
import { cn } from "@/lib/utils";
import type { StudentCompany, StudentCompanyDepartment } from "@/types/studentProfile";
import { Button } from "@/components/ui/button";
import { SkillChips } from "./SkillChips";

const openSlots = (c: StudentCompany) => c.departments.reduce((n, d) => n + Math.max(0, d.slots - d.filled), 0);
const openDepartments = (c: StudentCompany) => c.departments.filter((d) => d.slots - d.filled > 0);

const INITIAL = 5;

/**
 * "Companies that match your skills": eksaktong pagtutugma (walang AI), para lang sa students na wala pang company.
 * Ang pag-apply ay dumadaan pa rin sa normal na Apply (parehong endpoint at tuntunin).
 */
export function SkillMatches({
  companies, skills, applyState, onView, onApply,
}: {
  companies: StudentCompany[];
  skills: string[];
  /** Kung puwedeng mag-Apply sa department (status, limit, pending) */
  applyState: (d: StudentCompanyDepartment) => "ok" | "pending" | "blocked";
  onView: (companyId: number) => void;
  onApply: (company: StudentCompany, d: StudentCompanyDepartment) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [showUnlisted, setShowUnlisted] = useState(false);

  // Mga company na may bakanteng slot lang
  const available = useMemo(() => companies.filter((c) => openSlots(c) > 0), [companies]);
  const ranked = useMemo(
    () => rankBySkills(available.filter((c) => c.skills.length > 0), skills, (c) => c.skills, openSlots, (c) => c.name),
    [available, skills],
  );
  const unlisted = available.filter((c) => c.skills.length === 0);
  const noSkills = skills.length === 0;
  const matches = noSkills ? ranked : ranked.filter((m) => m.count > 0);
  const nonMatching = noSkills ? [] : ranked.filter((m) => m.count === 0);
  const shown = showAll ? matches : matches.slice(0, INITIAL);

  if (available.length === 0) return null;

  const card = (c: StudentCompany, matched: string[], others: string[], count: number | null) => {
    const depts = openDepartments(c);
    const single = depts.length === 1 ? depts[0] : null;
    const state = single ? applyState(single) : "blocked";
    const slots = openSlots(c);
    return (
      <li key={c.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium">{c.name}</p>
            <p className="mt-0.5 inline-flex items-start gap-1 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{c.address}</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 text-xs">
            {count !== null && c.skills.length > 0 && (
              <span className={cn("rounded-full px-2 py-0.5 font-medium",
                count > 0 ? "bg-emerald-600/10 text-emerald-800 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
                {count} of {c.skills.length} skill{c.skills.length === 1 ? "" : "s"} match
              </span>
            )}
            <span className="text-emerald-700 dark:text-emerald-400">
              {slots} slot{slots === 1 ? "" : "s"} open
            </span>
          </div>
        </div>
        {c.skills.length > 0 && <SkillChips matched={matched} others={others} collapseAfter={6} />}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => onView(c.id)}>
            {single && state === "ok" ? "View company" : "View and apply"}
          </Button>
          {single && state !== "blocked" && (
            state === "pending" ? (
              <span className="self-center text-xs text-muted-foreground">Application pending</span>
            ) : (
              <Button type="button" className="w-full sm:w-auto" onClick={() => onApply(c, single)}>
                Apply{single.name && single.name !== "N/A" ? ` to ${single.name}` : ""}
              </Button>
            )
          )}
        </div>
      </li>
    );
  };

  return (
    <section className="mb-6" aria-labelledby="skill-matches-title">
      <div className="mb-2 flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <h2 id="skill-matches-title" className="text-sm font-semibold">Companies that match your skills</h2>
      </div>

      {noSkills && (
        <p className="mb-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Add your skills above and we'll show the companies that need them first. For now, here are all the companies with open slots.
        </p>
      )}
      {!noSkills && matches.length === 0 && (
        <p className="mb-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          No company lists your skills yet. You can still apply to any company below, or add more skills.
        </p>
      )}

      {shown.length > 0 && (
        <ul className="flex flex-col gap-3">
          {shown.map((m) => card(m.item, m.matched, m.others, noSkills ? null : m.count))}
        </ul>
      )}
      {matches.length > INITIAL && (
        <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show fewer" : `Show all ${matches.length} matches`}
        </Button>
      )}

      {(unlisted.length > 0 || nonMatching.length > 0) && (
        <div className="mt-3 rounded-xl border">
          <button type="button" aria-expanded={showUnlisted}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium"
            onClick={() => setShowUnlisted((v) => !v)}>
            <span>
              {noSkills ? "No skills listed" : "Other companies with open slots"}{" "}
              <span className="text-muted-foreground">({(noSkills ? 0 : nonMatching.length) + unlisted.length})</span>
            </span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", showUnlisted && "rotate-180")} />
          </button>
          {showUnlisted && (
            <ul className="flex flex-col gap-3 border-t p-3">
              {nonMatching.map((m) => card(m.item, m.matched, m.others, m.count))}
              {unlisted.length > 0 && !noSkills && nonMatching.length > 0 && (
                <li className="pt-1 text-xs font-medium text-muted-foreground">No skills listed</li>
              )}
              {unlisted.map((c) => card(c, [], [], null))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
