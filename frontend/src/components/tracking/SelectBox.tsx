import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface SelectBoxProps {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function SelectBox({
  checked,
  indeterminate = false,
  label,
  onChange,
  className,
}: SelectBoxProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className={cn(
        "h-4 w-4 cursor-pointer rounded border-input accent-primary",
        className,
      )}
    />
  );
}
