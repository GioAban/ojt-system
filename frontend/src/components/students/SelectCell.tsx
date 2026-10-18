import { useState } from "react";
import { Loader2 } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

interface SelectCellProps {
  value: string | null;
  label: string;
  options: readonly string[];
  onSave: (value: string) => Promise<void>;
}

/** Dropdown na nagse-save agad kapag pumili ng ibang halaga (walang modal) */
export function SelectCell({ value, label, options, onSave }: SelectCellProps) {
  const [saving, setSaving] = useState(false);

  async function change(next: string) {
    if (next === (value ?? "")) return;
    setSaving(true);
    try {
      await onSave(next);
    } catch (err) {
      notify.error(`${label}: ${getErrorMessage(err, "Couldn't save the change.")}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
    <NativeSelect
      aria-label={label}
      value={value ?? ""}
      disabled={saving}
      onChange={(e) => void change(e.target.value)}
      className="h-8 border-transparent bg-transparent px-2 hover:bg-muted"
    >
      {!value && <NativeSelectOption value="">—</NativeSelectOption>}
      {options.map((o) => (
        <NativeSelectOption key={o} value={o}>
          {o}
        </NativeSelectOption>
      ))}
    </NativeSelect>
    {saving && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-label="Saving" />}
    </div>
  );
}
