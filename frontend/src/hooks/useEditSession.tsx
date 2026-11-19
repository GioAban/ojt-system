import { useEffect, useMemo, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";
import { notify } from "@/lib/notify";
import { pendingList, withPending, type CellSpec, type FieldSpec, type OverrideSpec } from "@/lib/reportFields";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CellEditor } from "@/components/reports/editor/CellEditor";
import { PendingChangesDialog, type ReviewMode } from "@/components/reports/editor/PendingChangesDialog";
import type { PendingChange, PendingMap, ReportOnlyNote, ReportSource } from "@/types/reports";

interface Options<C extends { pending?: PendingMap }> {
  reportId: number;
  source: ReportSource | null;
  get: () => C | null;
  mutate: (fn: (c: C) => C, key?: string) => void;
  /** Naisulat na sa database: palitan ang datos at i-refresh ang laman ng report (aalisin ng hook ang pending) */
  onCommitted: (fresh: ReportSource, changes: PendingChange[]) => void;
  /** Tuwing nagbabago ang Edit mode (hal. para isara ang mga control ng row) */
  onEditMode?: (on: boolean) => void;
}

const EMPTY: PendingChange[] = [];
/** Gaano katagal ipinapakita ang markang "saved" sa cell */
const SAVED_MARK_MS = 4000;

/**
 * Edit mode ng isang report. Lahat ng cell ay nae-edit:
 *  - nakakabit sa tunay na record: naghihintay sa laman ng report (hindi nawawala sa reload o offline) at
 *    isinusulat sa database gamit ang "Save changes to database" (may buod at Confirm);
 *  - sa report lang: diretsong nase-save sa report (auto-save), may marka at Reset to system value.
 * Ang pagpatay ng Edit mode, pag-alis sa page o pagbukas ng ibang report na may naghihintay ay nagtatanong muna:
 * Save changes to database, Discard, o Keep editing. Walang tahimik na naisusulat o nawawala.
 */
export function useEditSession<C extends { pending?: PendingMap }>(opts: Options<C>) {
  const { reportId, source, get, mutate, onCommitted, onEditMode } = opts;
  const [editMode, setEditModeState] = useState(false);
  const [review, setReview] = useState<{ changes: PendingChange[]; mode: ReviewMode } | null>(null);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, true>>({});
  const [openSpec, setOpenSpec] = useState<CellSpec | null>(null);
  const [notes, setNotes] = useState<Record<string, ReportOnlyNote>>({});
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const savedTimer = useRef<number | undefined>(undefined);

  const pending: PendingMap = get()?.pending ?? {};
  const count = Object.keys(pending).length;

  // Paglipat sa ibang page o report sa loob ng app habang may hindi pa naisusulat: tanungin muna
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    count > 0 && currentLocation.pathname !== nextLocation.pathname);
  const blocked = blocker.state === "blocked";
  // Iisang listahan bawat pagharang (para isang beses lang sinusuri ng server)
  const leaving = useMemo(
    () => (blocked ? { changes: pendingList(get()?.pending), mode: "leave" as const } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blocked],
  );
  const shown = review ?? leaving;

  // Pagsara ng tab: babala ng browser (naiiwan pa rin sa report ang mga pagbabago at may banner pagbalik)
  useEffect(() => {
    if (count === 0) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [count]);

  useEffect(() => () => window.clearTimeout(savedTimer.current), []);

  const setEditMode = (on: boolean) => {
    setEditModeState(on);
    if (!on) setNotes({});
    onEditMode?.(on);
  };

  /** Ang switch: kapag pinatay at may naghihintay, tanungin muna */
  const requestEditMode = (on: boolean) => {
    if (on) {
      setEditMode(true);
      return;
    }
    const list = pendingList(get()?.pending);
    if (list.length > 0) setReview({ changes: list, mode: "exit" });
    else setEditMode(false);
  };

  const reportOnlyCount = Object.keys(notes).length;

  /** "Save changes to database": buod na may Confirm at Cancel; kapag walang naghihintay, maikling paalala */
  const openSave = () => {
    const list = pendingList(get()?.pending);
    if (list.length > 0) {
      setReview({ changes: list, mode: "save" });
      return;
    }
    notify.info(reportOnlyCount > 0
      ? "No changes to save to the database. Report-only edits are already saved with this report."
      : "No changes to save to the database.");
  };

  const clearProblem = (key: string) => setProblems((p) => {
    if (!(key in p)) return p;
    const next = { ...p };
    delete next[key];
    return next;
  });

  const saveField = (spec: FieldSpec, value: string | null) => {
    mutate((c) => ({ ...c, pending: withPending(c.pending ?? {}, spec, value) }), `pending:${spec.key}`);
    spec.afterSave?.(value);
    clearProblem(spec.key);
  };

  /** Itinatala ang isang edit sa report lang para sa buod (tinatawag din ng teksto sa papel) */
  const noteReportOnly = (note: ReportOnlyNote) => {
    if (!editMode) return;
    setNotes((n) => {
      const next = { ...n };
      if (note.system !== null && note.value === note.system) delete next[note.key];
      else next[note.key] = note;
      return next;
    });
  };

  const saveOverride = (spec: OverrideSpec, value: string | null) => {
    spec.apply(value);
    noteReportOnly({ key: spec.key, label: spec.label, who: spec.who, system: spec.system, value: value ?? spec.system ?? "" });
  };

  const discardPending = () => {
    mutate((c) => ({ ...c, pending: {} }), "pending:discard");
    setProblems({});
  };

  const finishLeaving = (proceed: boolean) => {
    if (blocker.state !== "blocked") return;
    if (proceed) blocker.proceed();
    else blocker.reset();
  };

  const dialogs = source && (
    <>
      <CellEditor
        spec={openSpec}
        pending={pending}
        source={source}
        problems={problems}
        onSaveField={saveField}
        onSaveOverride={saveOverride}
        onClose={() => setOpenSpec(null)}
      />
      <PendingChangesDialog
        open={shown !== null}
        mode={shown?.mode ?? "save"}
        reportId={reportId}
        changes={shown?.changes ?? EMPTY}
        reportOnly={Object.values(notes)}
        onCancel={() => {
          setReview(null);
          finishLeaving(false);
        }}
        onDiscard={() => {
          const mode = shown?.mode;
          setReview(null);
          discardPending();
          if (mode === "exit") setEditMode(false);
          finishLeaving(true);
        }}
        onSaved={(fresh, done, left) => {
          const mode = shown?.mode;
          setReview(null);
          onCommitted(fresh, done);
          // Ang naisulat lang ang inaalis; ang may problema ay naiiwang naghihintay at may marka
          const keys = new Set(done.map((x) => x.key));
          mutate((c) => {
            const rest = { ...(c.pending ?? {}) };
            keys.forEach((k) => delete rest[k]);
            return { ...c, pending: rest };
          }, "pending:commit");
          setProblems(left);
          setSaved(Object.fromEntries(done.map((x) => [x.key, true as const])));
          window.clearTimeout(savedTimer.current);
          savedTimer.current = window.setTimeout(() => setSaved({}), SAVED_MARK_MS);

          const allSaved = Object.keys(left).length === 0;
          if (mode === "exit" && allSaved) setEditMode(false);
          if (mode === "exit" && !allSaved) setEditModeState(true);
          finishLeaving(allSaved);
        }}
      />
      <ConfirmDialog
        open={confirmDiscard}
        title={`Discard ${count} ${count === 1 ? "change" : "changes"} to the database?`}
        description="The changes to real records that you haven't saved will be removed. Report-only edits stay. Nothing in the database changes."
        confirmLabel="Discard changes"
        onConfirm={() => {
          setConfirmDiscard(false);
          discardPending();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );

  return {
    editMode,
    requestEditMode,
    /** "Save changes to database" */
    openSave,
    /** "Discard changes" (may kumpirmasyon) */
    requestDiscard: () => {
      if (count > 0) setConfirmDiscard(true);
      else notify.info("No changes to the database to discard.");
    },
    /** Mga edit sa report lang ngayong Edit mode (hindi kasama sa bilang ng database) */
    reportOnlyCount,
    pending,
    count,
    problems,
    saved,
    openSpec,
    setOpenSpec,
    noteReportOnly,
    dialogs,
  };
}
