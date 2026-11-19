import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export interface ComboboxOption {
  value: string
  label: string
  /** Hindi mapipili; ipinapakita pa rin kasama ang dahilan */
  disabled?: boolean
  /** Maliit na paliwanag sa ilalim ng label (hal. "2 of 3 slots used") */
  hint?: string
}

interface SearchableSelectProps {
  id?: string
  options: ComboboxOption[]
  /** null = walang napili */
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  emptyText?: string
  invalid?: boolean
  disabled?: boolean
  "aria-label"?: string
}

/**
 * Dropdown na may paghahanap (Base UI Combobox). Ang value ay ang `value` ng option;
 * walang malayang teksto: isa lang sa mga option ang mapipili.
 */
export function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder = "Search...",
  emptyText = "No matches.",
  invalid,
  disabled,
  "aria-label": ariaLabel,
}: SearchableSelectProps) {
  const selected = options.find((o) => o.value === value) ?? null

  return (
    <ComboboxPrimitive.Root<ComboboxOption>
      items={options}
      value={selected}
      onValueChange={(item) => onChange(item ? item.value : null)}
      itemToStringLabel={(item) => item.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
      disabled={disabled}
    >
      <div className="relative">
        <ComboboxPrimitive.Input
          id={id}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          placeholder={placeholder}
          className={cn(
            "h-9 w-full min-w-0 rounded-md border border-input bg-transparent py-1 pr-9 pl-3 text-base shadow-xs outline-none transition-[color,box-shadow] pointer-coarse:h-11 md:text-sm",
            "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            "aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
        <ComboboxPrimitive.Trigger
          aria-label="Show options"
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground pointer-coarse:w-11"
        >
          <ChevronDownIcon className="h-4 w-4" />
        </ComboboxPrimitive.Trigger>
      </div>

      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner sideOffset={4} className="z-[60] outline-none">
          <ComboboxPrimitive.Popup
            className={cn(
              "max-h-[min(20rem,var(--available-height))] w-[var(--anchor-width)] min-w-56 overflow-y-auto overscroll-contain rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md",
              "data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0",
            )}
          >
            <ComboboxPrimitive.Empty className="px-2 py-3 text-center text-sm text-muted-foreground empty:hidden">
              {emptyText}
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List>
              {(item: ComboboxOption) => (
                <ComboboxPrimitive.Item
                  key={item.value}
                  value={item}
                  disabled={item.disabled}
                  className={cn(
                    "flex cursor-default items-start gap-2 rounded-sm px-2 py-1.5 outline-none select-none pointer-coarse:py-2.5",
                    "data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
                  )}
                >
                  <span className="mt-0.5 w-4 shrink-0" aria-hidden>
                    {selected?.value === item.value && <CheckIcon className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words">{item.label}</span>
                    {item.hint && <span className="block text-xs text-muted-foreground">{item.hint}</span>}
                  </span>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  )
}
