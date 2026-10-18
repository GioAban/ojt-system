import {
  File as FileIcon,
  FileText,
  Image as ImageIcon,
  Link2,
  X,
} from "lucide-react";
import { formatFileSize } from "@/lib/files";

interface MaterialChipProps {
  kind: "FILE" | "LINK";
  name: string;
  url?: string | null;
  size?: number | null;
  contentType?: string | null;
  badge?: string;
  onOpen?: () => void;
  onRemove?: () => void;
}

function pickIcon(
  kind: "FILE" | "LINK",
  contentType: string | null | undefined,
  name: string,
) {
  if (kind === "LINK") return Link2;
  const lower = name.toLowerCase();
  if (
    (contentType ?? "").startsWith("image/") ||
    /\.(png|jpe?g|gif|webp)$/.test(lower)
  ) {
    return ImageIcon;
  }
  if (contentType === "application/pdf" || /\.(pdf|docx?|txt)$/.test(lower)) {
    return FileText;
  }
  return FileIcon;
}

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "Link";
  }
}

export function MaterialChip({
  kind,
  name,
  url,
  size,
  contentType,
  badge,
  onOpen,
  onRemove,
}: MaterialChipProps) {
  const Icon = pickIcon(kind, contentType, name);
  const subtitle =
    kind === "LINK"
      ? url
        ? hostOf(url)
        : "Link"
      : formatFileSize(size) || "File";

  const body = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {subtitle}
        </span>
      </span>
    </>
  );

  return (
    <div className="flex w-full min-w-0 items-center gap-1 rounded-lg border bg-background">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5">
          {body}
        </div>
      )}

      {badge && (
        <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          {badge}
        </span>
      )}

      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          title="Remove"
          onClick={onRemove}
          className="mr-1 shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
