import { useState } from "react";

/**
 * Pagpili ng mga row ng table.
 *
 * - `filteredIds`: lahat ng row na pasok sa kasalukuyang filter at search (lahat ng page).
 * - `pageIds`: ang mga row na nakikita sa kasalukuyang page.
 * - `scope`: kapag nagbago ito (tab, view, semester), nagre-reset ang pagpili.
 *
 * Ang mga row na nakatago ng filter o search ay hindi binibilang sa pagpili,
 * kaya walang mababago na hindi mo nakikita.
 */
export function useRowSelection(filteredIds: number[], pageIds: number[], scope: string) {
  const [raw, setRaw] = useState<Set<number>>(() => new Set());
  const [prevScope, setPrevScope] = useState(scope);

  if (prevScope !== scope) {
    setPrevScope(scope);
    setRaw(new Set());
  }

  const selectedIds = filteredIds.filter((id) => raw.has(id));
  const selected = new Set(selectedIds);

  const pageSelected = pageIds.filter((id) => selected.has(id)).length;
  const pageChecked = pageIds.length > 0 && pageSelected === pageIds.length;

  function toggle(id: number) {
    setRaw((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage(checked: boolean) {
    setRaw((prev) => {
      const next = new Set(prev);
      pageIds.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  function selectAllFiltered() {
    setRaw((prev) => new Set([...prev, ...filteredIds]));
  }

  function clear() {
    setRaw(new Set());
  }

  return {
    /** Mga napiling ID (pasok lang sa kasalukuyang filter) */
    selectedIds,
    count: selectedIds.length,
    isSelected: (id: number) => selected.has(id),
    toggle,
    togglePage,
    selectAllFiltered,
    clear,
    /** Napili ang lahat ng row sa kasalukuyang page */
    pageChecked,
    /** May napili sa page pero hindi lahat */
    pageIndeterminate: pageSelected > 0 && !pageChecked,
    /** Napili ang lahat ng row na pasok sa filter, sa lahat ng page */
    allFilteredSelected: filteredIds.length > 0 && selectedIds.length === filteredIds.length,
  };
}

export type RowSelection = ReturnType<typeof useRowSelection>;
