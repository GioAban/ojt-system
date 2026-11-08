import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

export interface PickerColumn {
  key: string;
  label: string;
}

interface ColumnPickerProps {
  columns: PickerColumn[];
  selected: string[];
  onToggle: (key: string, on: boolean) => void;
  /** Hindi maaalis (hal. pangalan ng student) */
  required?: string[];
  /** null = walang pamagat (iisang grupo sa popover) */
  legend?: string | null;
}

/** Mga checkbox ng column; ang huling natitirang column ay hindi maaalis */
export function ColumnPicker({ columns, selected, onToggle, required = [], legend = "Columns" }: ColumnPickerProps) {
  const shown = columns.filter((c) => selected.includes(c.key)).length;
  return (
    <fieldset className="min-w-0">
      {legend !== null && <legend className="block text-xs font-medium text-muted-foreground">{legend}</legend>}
      <div className="mt-1 flex flex-col">
        {columns.map((col) => {
          const on = selected.includes(col.key);
          return (
            <label key={col.key} className="flex items-center gap-2 py-1 text-sm pointer-coarse:min-h-11">
              <input
                type="checkbox"
                className="h-4 w-4 pointer-coarse:h-5 pointer-coarse:w-5"
                checked={on}
                disabled={required.includes(col.key) || (on && shown === 1)}
                onChange={(e) => onToggle(col.key, e.target.checked)}
              />
              {col.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Ang picker sa toolbar ng mga report na may papel na editor */
export function ColumnPickerButton({ groups }: { groups: ColumnPickerProps[] }) {
  return (
    <Popover>
      <PopoverTrigger render={<Button type="button" variant="ghost" size="sm" aria-label="Choose columns" />}>
        <Columns3 className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Columns</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[70dvh] w-72 overflow-y-auto">
        <PopoverTitle>Columns</PopoverTitle>
        <div className="flex flex-col gap-3">
          {groups.map((g, i) => <ColumnPicker key={i} {...g} />)}
        </div>
      </PopoverContent>
    </Popover>
  );
}
