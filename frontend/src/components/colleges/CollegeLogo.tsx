import { useState } from "react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

/** Buong URL ng logo mula sa landas na ibinibigay ng server (hal. /public/colleges/1/logo?v=...) */
export function collegeLogoSrc(path: string | null | undefined): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const base = (api.defaults.baseURL ?? "").replace(/\/$/, "");
  return `${base}${path}`;
}

interface Props {
  path: string | null | undefined;
  label: string;
  className?: string;
}

/** Maliit na logo ng college; kung wala o hindi mabuksan, ang abbreviation ang ipapakita */
export function CollegeLogo({ path, label, className }: Props) {
  const [failed, setFailed] = useState(false);
  const src = collegeLogoSrc(path);
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white text-[10px] font-semibold text-muted-foreground",
        className,
      )}
    >
      {src && !failed ? (
        <img
          key={src} src={src} alt={`${label} logo`} className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{label.slice(0, 4)}</span>
      )}
    </div>
  );
}
