import type { ReactNode } from "react";
import { ManualSignatoriesBlock, type ManualSignatoriesProps } from "@/components/reports/ManualSignatoriesBlock";

/**
 * Ang laman ng dulo ng report ayon sa tuntunin:
 *  - walang manual na pirmahan: ang built-in (kung mayroon) gaya ng dati;
 *  - may manual: ang manual lang, o ang built-in muna at saka ang manual kapag naka-on ang "Also show the built-in section".
 */
export function signatoryArea(builtIn: ReactNode | null, manual: ManualSignatoriesProps | undefined): ReactNode {
  if (!manual) return builtIn;
  const hasManual = manual.items.length > 0;
  const showBuiltIn = builtIn !== null && (!hasManual || manual.showBuiltIn);
  const block = <ManualSignatoriesBlock items={manual.items} onAdd={manual.onAdd} onEdit={manual.onEdit} onDelete={manual.onDelete} />;
  if (!showBuiltIn) return hasManual || manual.onAdd ? block : null;
  return (
    <>
      {builtIn}
      {(hasManual || manual.onAdd) && block}
    </>
  );
}
