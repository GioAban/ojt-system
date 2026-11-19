import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Contact number na ipinapakita: malayang teksto (puwedeng higit sa isang numero, hal. "0917 555 6666 / 0998 123 4567").
 * Bumabalot kahit mahaba o walang espasyo, at hindi sinisira ang layout. Walang "tel:" link (puwedeng maraming numero).
 */
export function ContactText({
  value,
  className,
  iconClassName = "h-3 w-3",
}: {
  value: string | null | undefined;
  className?: string;
  iconClassName?: string;
}) {
  if (!value) return null;
  return (
    <span className={cn("flex min-w-0 items-start gap-1.5", className)}>
      <Phone className={cn("mt-0.5 shrink-0", iconClassName)} aria-hidden="true" />
      <span className="min-w-0 whitespace-pre-line wrap-anywhere">{value}</span>
    </span>
  );
}
