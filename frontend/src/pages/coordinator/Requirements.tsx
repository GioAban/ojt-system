import { useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Archive,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import api from "@/lib/api";
import { postBulk } from "@/lib/bulk";
import { formatPeriod } from "@/lib/dates";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useSemester } from "@/contexts/semesterContext";
import { useSectionData } from "@/hooks/useTracking";
import type { RequirementType } from "@/types/tracking";
import type {
  DocumentItem,
  DtrItem,
  RequirementKind,
  WeeklyItem,
} from "@/types/requirements";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EditRequirementDialog } from "@/components/requirements/EditRequirementDialog";
import { ItemCard } from "@/components/requirements/ItemCard";
import { RequirementFormDialog } from "@/components/requirements/RequirementFormDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const TYPE_TABS: { value: RequirementType; label: string }[] = [
  { value: "initial", label: "Initial" },
  { value: "pre", label: "Pre-deployment" },
  { value: "post", label: "Post-deployment" },
];

const EVALUATION_SECTIONS = [
  { key: "MIDTERM_EVALUATION", title: "Midterm evaluation", view: "midterm" },
  { key: "FINAL_EVALUATION", title: "Final evaluation", view: "final" },
] as const;

type AnyItem = DocumentItem | WeeklyItem | DtrItem;

interface FormTarget {
  kind: RequirementKind;
  item: AnyItem | null;
}

interface ConfirmTarget {
  kind: RequirementKind;
  id: number;
  label: string;
  action: "archive" | "restore";
}

function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  /** Nasa kanan ng pamagat, hal. mga button ng evaluation */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-2 border-b pb-2">
        <h2 className="text-xl font-medium">{title}</h2>
        {count !== undefined && (
          <span className="text-sm text-muted-foreground">{count}</span>
        )}
        {action && (
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            {action}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

interface CreateButtonProps {
  type: RequirementType;
  disabled: boolean;
  onCreate: (kind: RequirementKind) => void;
}

function CreateButton({ type, disabled, onCreate }: CreateButtonProps) {
  const pill = "h-10 rounded-full px-5 shadow-sm";

  if (type !== "pre") {
    return (
      <Button
        type="button"
        variant="outline"
        className={pill}
        disabled={disabled}
        onClick={() => onCreate("document")}
      >
        <Plus className="h-4 w-4" />
        Create
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(buttonVariants({ variant: "outline" }), pill)}
      >
        <Plus className="h-4 w-4" />
        Create
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          className="gap-2"
          onClick={() => onCreate("document")}
        >
          <ClipboardList className="h-4 w-4" />
          Requirement
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onClick={() => onCreate("weekly")}>
          <CalendarRange className="h-4 w-4" />
          Weekly report
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onClick={() => onCreate("dtr")}>
          <Clock className="h-4 w-4" />
          DTR month
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface EvaluationActionsProps {
  item: DocumentItem;
  onOpen: () => void;
  onEdit: () => void;
  onClose: () => void;
}

/** Status at mga button ng isang evaluation; galing ang status sa mga bukas na student */
function EvaluationActions({
  item,
  onOpen,
  onEdit,
  onClose,
}: EvaluationActionsProps) {
  const open = item.openCount ?? 0;
  const total = item.studentCount ?? 0;
  const label =
    total === 0
      ? "No students yet"
      : open === 0
        ? "Closed"
        : open === total
          ? "Open"
          : `Open for ${open} of ${total}`;

  return (
    <>
      <span
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-md border px-2 text-xs font-medium",
          open > 0
            ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
            : "bg-muted text-muted-foreground",
        )}
      >
        {open > 0 ? (
          <LockOpen className="h-3 w-3" />
        ) : (
          <Lock className="h-3 w-3" />
        )}
        {label}
      </span>
      {(open > 0 || total === 0) && (
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      )}
      {total > 0 && open < total && (
        <Button type="button" size="sm" onClick={onOpen}>
          <LockOpen className="h-3.5 w-3.5" />
          Open evaluation
        </Button>
      )}
      {open > 0 && (
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <Lock className="h-3.5 w-3.5" />
          Close evaluation
        </Button>
      )}
    </>
  );
}

export default function Requirements() {
  const navigate = useNavigate();
  const { semesterId, semester, loaded, error: semesterError } = useSemester();

  const location = useLocation();
  const [type, setType] = useState<RequirementType>(() => {
    const requested = (location.state as { type?: string } | null)?.type;
    return requested === "pre" ||
      requested === "post" ||
      requested === "initial"
      ? requested
      : "initial";
  });
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<FormTarget | null>(null);
  const [builtIn, setBuiltIn] = useState<{
    item: DocumentItem;
    opening: boolean;
  } | null>(null);
  const [closing, setClosing] = useState<DocumentItem | null>(null);
  const [confirm, setConfirm] = useState<ConfirmTarget | null>(null);
  const [confirming, setConfirming] = useState(false);

  const archived = String(showArchived);
  const isPre = type === "pre";
  const [refreshKey, setRefreshKey] = useState(0);

  const docs = useSectionData<DocumentItem[]>(
    "/coordinator/requirements",
    semesterId,
    {
      type,
      archived,
    },
  );
  const weekly = useSectionData<WeeklyItem[]>(
    "/coordinator/requirements/weekly",
    isPre ? semesterId : null,
    { archived },
  );
  const dtr = useSectionData<DtrItem[]>(
    "/coordinator/requirements/dtr",
    isPre ? semesterId : null,
    { archived },
  );

  const loading = docs.loading || weekly.loading || dtr.loading;
  const error = semesterError || docs.error || weekly.error || dtr.error;

  function reloadAll() {
    docs.reload();
    weekly.reload();
    dtr.reload();
  }

  const q = search.trim().toLowerCase();
  const allDocs = (docs.data ?? []).filter(
    (i) => !q || i.title.toLowerCase().includes(q),
  );
  // Sariling section ang mga built-in, hindi kasama sa plain Requirements
  const docItems = allDocs.filter((i) => !i.systemKey);
  const evaluationSections = isPre && !showArchived
    ? EVALUATION_SECTIONS.map((section) => ({
        ...section,
        items: allDocs.filter((i) => i.systemKey === section.key),
      }))
    : [];
  const evaluationCount = evaluationSections.reduce(
    (sum, section) => sum + section.items.length,
    0,
  );
  const weeklyItems = isPre
    ? (weekly.data ?? []).filter(
        (i) =>
          !q || formatPeriod(i.dateFrom, i.dateTo).toLowerCase().includes(q),
      )
    : [];
  const dtrItems = isPre
    ? (dtr.data ?? []).filter((i) => !q || i.month.toLowerCase().includes(q))
    : [];

  const totalCount =
    docItems.length + evaluationCount + weeklyItems.length + dtrItems.length;
  const noSemester = loaded && semesterId === null && !semesterError;

  const confirmCopy = confirm
    ? confirm.action === "archive"
      ? {
          title: "Archive this item?",
          description: `"${confirm.label}" will be hidden from Tracking. Submitted files and statuses are kept, and you can restore it anytime.`,
          label: "Archive",
        }
      : {
          title: "Restore this item?",
          description: `"${confirm.label}" will appear in Tracking again.`,
          label: "Restore",
        }
    : null;

  async function handleConfirm() {
    if (!confirm) return;

    const { kind, id, label, action } = confirm;
    const base =
      kind === "document"
        ? "/coordinator/requirements"
        : `/coordinator/requirements/${kind}`;

    setConfirming(true);
    try {
      await api.patch(`${base}/${id}/${action}`);
      notify.success(
        `${label} was ${action === "archive" ? "archived" : "restored"}.`,
      );
      reloadAll();
    } catch (err) {
      notify.error(getErrorMessage(err, "Action failed."));
    } finally {
      setConfirming(false);
      setConfirm(null);
    }
  }

  function setAccessForAll(item: DocumentItem, semester: number, open: boolean) {
    return postBulk(
      "evaluation-access/all",
      { semesterId: semester, key: item.systemKey, open },
      `${item.title} ${open ? "opened" : "closed"}`,
    );
  }

  async function handleClose() {
    if (!closing || semesterId === null) return;
    setConfirming(true);
    try {
      await setAccessForAll(closing, semesterId, false);
      reloadAll();
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't close the evaluation."));
    } finally {
      setConfirming(false);
      setClosing(null);
    }
  }

  const openTracking = () => navigate("/coordinator/tracking");

  const existingMonths = showArchived
    ? []
    : (dtr.data ?? [])
        .filter((m) => m.id !== form?.item?.id)
        .map((m) => m.month);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Requirements"
          description={
            semester
              ? `Create and manage what your students must submit in ${semester.semester}.`
              : "Create and manage what your students must submit."
          }
        />

        <nav
          className="mb-5 flex gap-1 overflow-x-auto overscroll-x-contain border-b"
          aria-label="Requirement types"
        >
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setType(tab.value);
                setSearch("");
              }}
              className={cn(
                "-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium outline-none sm:px-4 pointer-coarse:py-3 transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                type === tab.value
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <CreateButton
            type={type}
            disabled={semesterId === null}
            onCreate={(kind) => setForm({ kind, item: null })}
          />

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant={showArchived ? "secondary" : "ghost"}
              onClick={() => setShowArchived((v) => !v)}
            >
              <Archive className="h-4 w-4" />
              Archived
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              {error}
              <Button variant="outline" size="sm" onClick={reloadAll}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {noSemester && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No active semester found. Ask the director to add one.
          </p>
        )}

        {loading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!loading && semesterId !== null && !error && totalCount === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-20 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <ClipboardList className="h-7 w-7 text-muted-foreground" />
            </span>
            <div>
              <p className="font-medium">
                {q
                  ? "Nothing matches your search"
                  : showArchived
                    ? "No archived items"
                    : "This is where you'll create requirements"}
              </p>
              {!q && !showArchived && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Add what students must submit, then track it in the Tracking
                  page.
                </p>
              )}
            </div>
            {!q && !showArchived && (
              <CreateButton
                type={type}
                disabled={false}
                onCreate={(kind) => setForm({ kind, item: null })}
              />
            )}
          </div>
        )}

        {!loading && !error && (
          <>
            {(docItems.length > 0 || (isPre && totalCount > 0)) && (
              <Section
                title={
                  isPre
                    ? "Requirements"
                    : TYPE_TABS.find((t) => t.value === type)!.label
                }
                count={docItems.length}
              >
                {docItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nothing here yet.
                  </p>
                )}
                {docItems.map((i) => (
                  <ItemCard
                    key={`doc-${i.id}`}
                    icon={ClipboardList}
                    title={i.title}
                    posted={i.createdAt}
                    dueDate={i.dueDate}
                    archived={i.archived}
                    stats={i.stats}
                    mode="documents"
                    instructions={i.instructions}
                    requirementId={i.id}
                    refreshKey={refreshKey}
                    onOpenSubmissions={() =>
                      navigate(
                        `/coordinator/document-requirements/${i.id}/submissions`,
                      )
                    }
                    onEdit={() => setForm({ kind: "document", item: i })}
                    onToggleArchive={() =>
                      setConfirm({
                        kind: "document",
                        id: i.id,
                        label: i.title,
                        action: i.archived ? "restore" : "archive",
                      })
                    }
                    onOpenTracking={openTracking}
                  />
                ))}
              </Section>
            )}

            {isPre && totalCount > 0 && (
              <Section title="Weekly reports" count={weeklyItems.length}>
                {weeklyItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nothing here yet.
                  </p>
                )}
                {weeklyItems.map((i) => {
                  const label = formatPeriod(i.dateFrom, i.dateTo);
                  return (
                    <ItemCard
                      key={`weekly-${i.id}`}
                      icon={CalendarRange}
                      title={label}
                      posted={i.createdAt}
                      dueDate={i.dueDate}
                      archived={i.archived}
                      stats={i.stats}
                      mode="weekly"
                      onEdit={() => setForm({ kind: "weekly", item: i })}
                      onToggleArchive={() =>
                        setConfirm({
                          kind: "weekly",
                          id: i.id,
                          label,
                          action: i.archived ? "restore" : "archive",
                        })
                      }
                      onOpenTracking={openTracking}
                      onOpenSubmissions={() =>
                        navigate(
                          `/coordinator/document-requirements/weekly/${i.id}/submissions`,
                        )
                      }
                    />
                  );
                })}
              </Section>
            )}

            {isPre && totalCount > 0 && (
              <Section title="DTR" count={dtrItems.length}>
                {dtrItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nothing here yet.
                  </p>
                )}
                {dtrItems.map((i) => (
                  <ItemCard
                    key={`dtr-${i.id}`}
                    icon={Clock}
                    title={i.month}
                    posted={i.createdAt}
                    dueDate={i.dueDate}
                    archived={i.archived}
                    stats={i.stats}
                    mode="dtr"
                    onEdit={() => setForm({ kind: "dtr", item: i })}
                    onToggleArchive={() =>
                      setConfirm({
                        kind: "dtr",
                        id: i.id,
                        label: i.month,
                        action: i.archived ? "restore" : "archive",
                      })
                    }
                    onOpenTracking={openTracking}
                    onOpenSubmissions={() =>
                      navigate(
                        `/coordinator/document-requirements/dtr/${i.id}/submissions`,
                      )
                    }
                  />
                ))}
              </Section>
            )}

            {totalCount > 0 &&
              evaluationSections.map((section) => (
                <Section
                  key={section.key}
                  title={section.title}
                  action={
                    section.items[0] && (
                      <EvaluationActions
                        item={section.items[0]}
                        onOpen={() =>
                          setBuiltIn({ item: section.items[0], opening: true })
                        }
                        onEdit={() =>
                          setBuiltIn({ item: section.items[0], opening: false })
                        }
                        onClose={() => setClosing(section.items[0])}
                      />
                    )
                  }
                >
                  {section.items.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nothing here yet.
                    </p>
                  )}
                  {section.items.map((i) => (
                    <ItemCard
                      key={`doc-${i.id}`}
                      icon={ClipboardCheck}
                      title={i.title}
                      posted={i.createdAt}
                      dueDate={i.dueDate}
                      archived={i.archived}
                      stats={i.stats}
                      mode="documents"
                      instructions={i.instructions}
                      requirementId={i.id}
                      refreshKey={refreshKey}
                      builtIn
                      emptyStatsText="Not open for any student yet. Open it in Tracking."
                      onOpenSubmissions={() =>
                        navigate(
                          `/coordinator/document-requirements/${i.id}/submissions`,
                        )
                      }
                      onEdit={
                        (i.openCount ?? 0) > 0 || (i.studentCount ?? 0) === 0
                          ? () => setBuiltIn({ item: i, opening: false })
                          : undefined
                      }
                      onOpenTracking={() =>
                        navigate("/coordinator/tracking", {
                          state: { type: "pre", view: section.view },
                        })
                      }
                    />
                  ))}
                </Section>
              ))}
          </>
        )}
      </div>

      {form && semesterId !== null && (
        <RequirementFormDialog
          key={`${form.kind}-${form.item?.id ?? "new"}`}
          open
          onOpenChange={(open) => {
            if (!open) {
              setForm(null);
              setRefreshKey((k) => k + 1);
              reloadAll();
            }
          }}
          kind={form.kind}
          type={type}
          semesterId={semesterId}
          semesterName={semester?.semester ?? ""}
          item={form.item}
          existingMonths={existingMonths}
          onSaved={(message) => notify.success(message)}
        />
      )}

      {builtIn && semesterId !== null && (
        <EditRequirementDialog
          key={builtIn.item.id}
          kind="document"
          requirementId={builtIn.item.id}
          title={builtIn.item.title}
          instructions={builtIn.item.instructions}
          dueDate={builtIn.item.dueDate}
          builtIn
          openAction={
            builtIn.opening
              ? {
                  label: "Open for all students",
                  note: "Everything here is optional.",
                  run: async () => {
                    await setAccessForAll(builtIn.item, semesterId, true);
                  },
                }
              : undefined
          }
          onOpenChange={(open) => {
            if (!open) setBuiltIn(null);
          }}
          onSaved={() => {
            setRefreshKey((k) => k + 1);
            reloadAll();
          }}
        />
      )}

      <ConfirmDialog
        open={closing !== null}
        title={`Close ${closing?.title ?? "this evaluation"}?`}
        description={`${closing?.openCount ?? 0} student${closing?.openCount === 1 ? "" : "s"} won't be able to change it. Their work is kept, and it stops counting in their progress until it's reopened.`}
        confirmLabel="Close evaluation"
        loading={confirming}
        onConfirm={() => void handleClose()}
        onCancel={() => setClosing(null)}
      />

      <ConfirmDialog
        open={confirm !== null}
        title={confirmCopy?.title ?? ""}
        description={confirmCopy?.description ?? ""}
        confirmLabel={confirmCopy?.label ?? ""}
        loading={confirming}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </DashboardLayout>
  );
}
