import { useCallback, useEffect, useMemo, useState } from "react";
import { GitMerge, Pencil, Search, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { SKILL_MAX_LENGTH, skillDisplay, skillKey } from "@/lib/skills";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface SkillUsage {
  id: number;
  name: string;
  students: number;
  companies: number;
}

type Mode = { id: number; kind: "rename" | "merge" } | null;

const uses = (s: SkillUsage) =>
  `${s.students} student${s.students === 1 ? "" : "s"} · ${s.companies} compan${s.companies === 1 ? "y" : "ies"}`;

/**
 * Skills manager: iisang listahan ng skills ng lahat. Admin coordinator lang ang puwedeng mag-rename,
 * mag-merge (hal. "MS Excel" papunta sa "Excel") at mag-delete ng hindi ginagamit; read-only sa iba.
 */
export function SkillsManagerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [skills, setSkills] = useState<SkillUsage[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>(null);
  const [renameText, setRenameText] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const [rowError, setRowError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<SkillUsage | null>(null);

  const load = useCallback(() => {
    api.get<{ canManage: boolean; skills: SkillUsage[] }>("/coordinator/skills")
      .then((res) => { setSkills(res.data.skills); setCanManage(res.data.canManage); setError(""); })
      .catch((err) => setError(getErrorMessage(err, "Couldn't load the skills.")));
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const filtered = useMemo(() => {
    const k = skillKey(query);
    const list = skills ?? [];
    return k ? list.filter((s) => skillKey(s.name).includes(k)) : list;
  }, [skills, query]);

  function start(s: SkillUsage, kind: "rename" | "merge") {
    setMode({ id: s.id, kind });
    setRenameText(s.name);
    setMergeTarget("");
    setRowError("");
  }

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setRowError("");
    try {
      await action();
      notify.success(success);
      setMode(null);
      load();
    } catch (err) {
      setRowError(getErrorMessage(err, "Couldn't save the change."));
    } finally {
      setBusy(false);
    }
  }

  function rename(s: SkillUsage) {
    const name = skillDisplay(renameText);
    if (!name) return setRowError("Enter a name.");
    if (name.length > SKILL_MAX_LENGTH) return setRowError(`Keep it to ${SKILL_MAX_LENGTH} characters.`);
    void run(() => api.patch(`/coordinator/skills/${s.id}`, { name }), `Renamed to ${name}.`);
  }

  function merge(s: SkillUsage) {
    const target = skills?.find((x) => String(x.id) === mergeTarget);
    if (!target) return setRowError("Choose the skill to merge into.");
    void run(() => api.post(`/coordinator/skills/${s.id}/merge`, { targetId: target.id }), `${s.name} was merged into ${target.name}.`);
  }

  async function remove() {
    if (!deleting) return;
    const s = deleting;
    setBusy(true);
    try {
      await api.delete(`/coordinator/skills/${s.id}`);
      notify.success(`${s.name} was deleted.`);
      setDeleting(null);
      load();
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't delete the skill."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) setMode(null); onOpenChange(o); }}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>Skills</DialogTitle>
            <DialogDescription>
              One list shared by students and companies. Matching is exact, so merge names that mean the same thing
              (for example "MS Excel" into "Excel").
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            {!canManage && skills !== null && (
              <Alert>
                <AlertDescription>Only admin coordinators can rename, merge or delete skills.</AlertDescription>
              </Alert>
            )}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Search skills" placeholder="Search skills" className="pl-8" value={query}
                onChange={(e) => setQuery(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {skills === null && !error && (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            )}
            {skills !== null && filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {skills.length === 0 ? "No skills yet. They're added when students or companies list them." : "No skill matches your search."}
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {filtered.map((s) => {
                const editing = mode?.id === s.id;
                const unused = s.students === 0 && s.companies === 0;
                return (
                  <li key={s.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{unused ? "Not used" : uses(s)}</p>
                      </div>
                      {canManage && !editing && (
                        <div className="flex gap-1">
                          <Button type="button" size="sm" variant="ghost" onClick={() => start(s, "rename")}>
                            <Pencil className="h-3.5 w-3.5" /> Rename
                          </Button>
                          <Button type="button" size="sm" variant="ghost" disabled={(skills?.length ?? 0) < 2}
                            onClick={() => start(s, "merge")}>
                            <GitMerge className="h-3.5 w-3.5" /> Merge
                          </Button>
                          {unused && (
                            <Button type="button" size="sm" variant="ghost" className="text-destructive"
                              aria-label={`Delete ${s.name}`} onClick={() => setDeleting(s)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {editing && mode.kind === "rename" && (
                      <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); rename(s); }}>
                        <Input autoFocus aria-label={`New name for ${s.name}`} maxLength={SKILL_MAX_LENGTH + 10}
                          value={renameText} aria-invalid={Boolean(rowError)} onChange={(e) => { setRenameText(e.target.value); setRowError(""); }} />
                        <div className="flex gap-2">
                          <Button type="button" variant="ghost" disabled={busy} onClick={() => setMode(null)}>Cancel</Button>
                          <Button type="submit" disabled={busy}>Save</Button>
                        </div>
                      </form>
                    )}

                    {editing && mode.kind === "merge" && (
                      <div className="mt-3 flex flex-col gap-2">
                        <p className="text-xs text-muted-foreground">
                          Everyone with <strong>{s.name}</strong> will get the skill you choose, and {s.name} will be removed.
                        </p>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <NativeSelect aria-label={`Merge ${s.name} into`} className="w-full" value={mergeTarget}
                            onChange={(e) => { setMergeTarget(e.target.value); setRowError(""); }}>
                            <NativeSelectOption value="">Merge into…</NativeSelectOption>
                            {(skills ?? []).filter((x) => x.id !== s.id).map((x) => (
                              <NativeSelectOption key={x.id} value={String(x.id)}>{x.name}</NativeSelectOption>
                            ))}
                          </NativeSelect>
                          <div className="flex gap-2">
                            <Button type="button" variant="ghost" disabled={busy} onClick={() => setMode(null)}>Cancel</Button>
                            <Button type="button" disabled={busy || !mergeTarget} onClick={() => merge(s)}>Merge</Button>
                          </div>
                        </div>
                      </div>
                    )}
                    {editing && rowError && <p className="mt-2 text-xs text-destructive">{rowError}</p>}
                  </li>
                );
              })}
            </ul>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this skill?"
        description={`${deleting?.name ?? ""} isn't used by any student or company. It will be removed from the list.`}
        confirmLabel="Delete"
        loading={busy}
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
