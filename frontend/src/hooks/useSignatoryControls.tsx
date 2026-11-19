import { useState } from "react";
import { useManualSignatories } from "@/hooks/useManualSignatories";
import { newSignatoryId, type ManualSignatory } from "@/lib/manualSignatories";
import { ManageSignatoriesSheet } from "@/components/reports/ManageSignatoriesSheet";

/**
 * Iisang pamamahala ng pirmahan para sa lahat ng report: Add, Edit, Delete at Manage, mula sa sidebar
 * at sa papel. Naka-save sa device lang.
 */
export function useSignatoryControls(reportId: number, { hasBuiltIn, title }: { hasBuiltIn: boolean; title: string }) {
  const signs = useManualSignatories(reportId);
  const [open, setOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const items = signs.value.items;

  /** Bagong blangkong signatory, saka bubuksan ang panel sa form nito */
  const add = () => {
    const fresh: ManualSignatory = { id: newSignatoryId(), label: "", name: "", position: "", align: "left", dateLine: false };
    signs.update({ ...signs.value, items: [...items, fresh] });
    setFocusId(fresh.id);
    setOpen(true);
  };
  const edit = (id: string) => {
    setFocusId(id);
    setOpen(true);
  };
  const remove = (id: string) => signs.update({ ...signs.value, items: items.filter((s) => s.id !== id) });
  /** "Manage signatories": kapag wala pa, diretso sa form ng bagong signatory */
  const manage = () => {
    if (items.length === 0) {
      add();
      return;
    }
    setFocusId(null);
    setOpen(true);
  };

  const panel = (
    <ManageSignatoriesSheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setFocusId(null);
          signs.rememberUsed();
        }
      }}
      value={signs.value}
      onChange={signs.update}
      people={signs.people}
      onPeople={signs.setPeople}
      hasBuiltIn={hasBuiltIn}
      reportTitle={title}
      focusId={focusId}
    />
  );

  return {
    items,
    showBuiltIn: signs.value.showBuiltIn,
    setShowBuiltIn: (v: boolean) => signs.update({ ...signs.value, showBuiltIn: v }),
    add,
    edit,
    remove,
    manage,
    panel,
  };
}
