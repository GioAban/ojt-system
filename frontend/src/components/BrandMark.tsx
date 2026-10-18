import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold tracking-tight text-primary-foreground",
        className,
      )}
    >
      {brand.shortName}
    </div>
  );
}
