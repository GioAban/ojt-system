import { useEffect, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Ellipsis,
  ExternalLink,
  Pencil,
  Users,
  type LucideIcon,
} from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatFullDate, formatShortDate, isPastDue } from "@/lib/dates";
import { openExternalLink, openProtectedFile } from "@/lib/files";
import { notify } from "@/lib/notify";
import type { MaterialItem, RequirementStats } from "@/types/requirements";
import { MaterialChip } from "@/components/requirements/MaterialChip";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

type StatsMode = "documents" | "weekly" | "dtr";

const MODE_LABELS: Record<StatsMode, { done: string; pending: string }> = {
  documents: { done: "Turned in", pending: "Not submitted" },
  weekly: { done: "Evaluated", pending: "Not evaluated" },
  dtr: { done: "Hours recorded", pending: "No hours yet" },
};

interface ItemCardProps {
  icon: LucideIcon;
  title: string;
  posted: string | null;
  dueDate: string | null;
  archived: boolean;
  stats: RequirementStats;
  mode: StatsMode;
  instructions?: string | null;
  /** Para sa documents: pang-kuha ng mga attachment */
  requirementId?: number;
  /** Tumataas kapag may na-save, para ma-reload ang mga attachment */
  refreshKey?: number;
  onOpenSubmissions?: () => void;
  onEdit: () => void;
  onToggleArchive: () => void;
  onOpenTracking: () => void;
}

export function ItemCard({
  icon: Icon,
  title,
  posted,
  dueDate,
  archived,
  stats,
  mode,
  instructions,
  requirementId,
  refreshKey = 0,
  onOpenSubmissions,
  onEdit,
  onToggleArchive,
  onOpenTracking,
}: ItemCardProps) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<{
    token: number;
    data: MaterialItem[];
  } | null>(null);

  const materials = loaded && loaded.token === refreshKey ? loaded.data : null;

  useEffect(() => {
    if (
      !open ||
      mode !== "documents" ||
      requirementId === undefined ||
      materials !== null
    )
      return;
    let cancelled = false;

    api
      .get<MaterialItem[]>(
        `/coordinator/requirements/${requirementId}/materials`,
      )
      .then((res) => {
        if (!cancelled) setLoaded({ token: refreshKey, data: res.data });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ token: refreshKey, data: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [open, mode, requirementId, refreshKey, materials]);

  async function openMaterial(material: MaterialItem) {
    if (material.kind === "LINK") {
      if (!material.url || !openExternalLink(material.url)) {
        notify.error("That link can't be opened.");
      }
      return;
    }

    try {
      await openProtectedFile(
        `/coordinator/requirements/${requirementId}/materials/${material.id}/file`,
        material.name,
      );
    } catch (err) {
      notify.error(
        err instanceof Error ? err.message : "Couldn't open the file.",
      );
    }
  }

  const labels = MODE_LABELS[mode];
  const overdue = !archived && isPastDue(dueDate);
  const done =
    mode === "documents"
      ? stats.checked + stats.forChecking + stats.invalid
      : stats.checked;
  const pending = Math.max(0, stats.total - done);
  const pct = (n: number) => (stats.total === 0 ? 0 : (n / stats.total) * 100);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card transition-colors",
        open ? "shadow-sm" : "hover:bg-muted/40",
        archived && "opacity-70",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Icon className="h-4 w-4" />
          </span>

          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {title}
          </span>

          <span className="hidden shrink-0 flex-col items-end gap-0.5 text-xs sm:flex">
            {dueDate ? (
              <span
                className={cn(
                  overdue ? "font-medium text-destructive" : "text-foreground",
                )}
              >
                Due {formatShortDate(dueDate)}
              </span>
            ) : (
              <span className="text-muted-foreground">No due date</span>
            )}
            {posted && (
              <span className="text-muted-foreground">
                Posted {formatShortDate(posted)}
              </span>
            )}
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            className={buttonVariants({ variant: "ghost", size: "icon" })}
            aria-label="More actions"
          >
            <Ellipsis className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onOpenSubmissions && (
              <DropdownMenuItem className="gap-2" onClick={onOpenSubmissions}>
                <Users className="h-4 w-4" />
                View student work
              </DropdownMenuItem>
            )}
            {!archived && (
              <DropdownMenuItem className="gap-2" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="gap-2" onClick={onOpenTracking}>
              <ExternalLink className="h-4 w-4" />
              Open Tracking
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onClick={onToggleArchive}>
              {archived ? (
                <ArchiveRestore className="h-4 w-4" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
              {archived ? "Restore" : "Archive"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {open && (
        <div className="border-t px-4 py-4 sm:pl-16">
          {dueDate && (
            <p className="mb-3 text-sm">
              <span className="text-muted-foreground">Due </span>
              <span className={cn(overdue && "font-medium text-destructive")}>
                {formatFullDate(dueDate)}
              </span>
            </p>
          )}

          {mode === "documents" && (
            <>
              <p
                className={cn(
                  "mb-4 whitespace-pre-wrap text-sm",
                  !instructions && "text-muted-foreground",
                )}
              >
                {instructions || "No instructions."}
              </p>

              <div className="mb-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Attachments
                </p>
                {materials === null ? (
                  <Skeleton className="h-12 w-full sm:w-72" />
                ) : materials.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No attachments.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {materials.map((m) => (
                      <MaterialChip
                        key={m.id}
                        kind={m.kind}
                        name={m.name}
                        url={m.url}
                        size={m.size}
                        contentType={m.contentType}
                        onOpen={() => void openMaterial(m)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {stats.total === 0 ? (
            <p className="text-sm text-muted-foreground">
              No students in this semester yet.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-x-10 gap-y-3">
                <div>
                  <p className="text-3xl font-light leading-none">{done}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {labels.done}
                  </p>
                </div>
                <div>
                  <p className="text-3xl font-light leading-none">{pending}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {labels.pending}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="bg-emerald-500"
                  style={{ width: `${pct(stats.checked)}%` }}
                />
                <div
                  className="bg-amber-400"
                  style={{ width: `${pct(stats.forChecking)}%` }}
                />
                <div
                  className="bg-destructive"
                  style={{ width: `${pct(stats.invalid)}%` }}
                />
              </div>

              {mode === "documents" && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Checked {stats.checked}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    For checking {stats.forChecking}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-destructive" />
                    Invalid {stats.invalid}
                  </span>
                </div>
              )}
            </>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {onOpenSubmissions && (
              <Button type="button" size="sm" onClick={onOpenSubmissions}>
                <Users className="h-3.5 w-3.5" />
                View student work
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenTracking}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open Tracking
            </Button>
            {!archived && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onEdit}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
