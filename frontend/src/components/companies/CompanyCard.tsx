import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Building2,
  CheckCircle2,
  ChevronDown,
  Ellipsis,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isApproved } from "@/lib/company";
import type { CompanyItem, DepartmentItem } from "@/types/company";
import {
  ApprovalBadge,
  ArchivedBadge,
  MoaInfo,
  SlotsMeter,
} from "@/components/companies/parts";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CompanyCardProps {
  company: CompanyItem;
  onEditCompany: () => void;
  onArchiveCompany: () => void;
  onAddDepartment: () => void;
  onEditDepartment: (department: DepartmentItem) => void;
  onToggleApproval: (department: DepartmentItem) => void;
  onArchiveDepartment: (department: DepartmentItem) => void;
}

export function CompanyCard({
  company,
  onEditCompany,
  onArchiveCompany,
  onAddDepartment,
  onEditDepartment,
  onToggleApproval,
  onArchiveDepartment,
}: CompanyCardProps) {
  const [open, setOpen] = useState(false);

  const departments = company.departments;
  const active = departments.filter((d) => !d.archived);
  const pending = active.filter((d) => !isApproved(d.status)).length;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card transition-colors",
        open ? "shadow-sm" : "hover:bg-muted/40",
        company.archived && "opacity-70",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium">
                {company.name}
              </span>
              {company.nature && (
                <Badge variant="secondary">{company.nature}</Badge>
              )}
              {company.archived && <ArchivedBadge />}
              {pending > 0 && !company.archived && (
                <span className="inline-flex h-5 items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                  {pending} pending
                </span>
              )}
            </span>
            <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{company.address}</span>
            </span>
          </span>

          <span className="hidden shrink-0 text-right text-xs sm:block">
            <span className="block font-medium">
              {active.length} department{active.length === 1 ? "" : "s"}
            </span>
            <span className="block text-muted-foreground">
              {company.placed}/{company.slots} placed
            </span>
          </span>

          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            className={buttonVariants({ variant: "ghost", size: "icon" })}
            aria-label="Company actions"
          >
            <Ellipsis className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!company.archived && (
              <>
                <DropdownMenuItem className="gap-2" onClick={onEditCompany}>
                  <Pencil className="h-4 w-4" />
                  Edit company
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" onClick={onAddDepartment}>
                  <Plus className="h-4 w-4" />
                  Add department
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem className="gap-2" onClick={onArchiveCompany}>
              {company.archived ? (
                <ArchiveRestore className="h-4 w-4" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
              {company.archived ? "Restore" : "Archive"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {open && (
        <div className="flex flex-col gap-5 border-t px-4 py-4 sm:pl-16">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 text-sm">
              <p className="text-xs font-medium text-muted-foreground">
                Contact
              </p>
              <span className="inline-flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  {company.address}
                  {company.location && (
                    <span className="block text-xs text-muted-foreground">
                      {company.location}
                    </span>
                  )}
                </span>
              </span>
              <span className="inline-flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                {company.contactNumber}
              </span>
            </div>

            <div className="flex flex-col gap-2 text-sm">
              <p className="text-xs font-medium text-muted-foreground">
                Immediate supervisor
              </p>
              <span className="inline-flex items-center gap-2">
                <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  {company.supervisorName}
                  <span className="block text-xs text-muted-foreground">
                    {company.supervisorPosition}
                  </span>
                </span>
              </span>
              {(company.idType || company.idNumber) && (
                <span className="text-xs text-muted-foreground">
                  {company.idType ?? "ID"}: {company.idNumber ?? "—"}
                </span>
              )}
            </div>
          </div>

          {company.description && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                About
              </p>
              <p className="whitespace-pre-wrap text-sm">
                {company.description}
              </p>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                Departments ({departments.length})
              </p>
              {!company.archived && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onAddDepartment}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add department
                </Button>
              )}
            </div>

            {departments.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No departments yet.
                </p>
                {!company.archived && (
                  <Button type="button" size="sm" onClick={onAddDepartment}>
                    <Plus className="h-3.5 w-3.5" />
                    Add the first department
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {departments.map((d) => (
                  <div
                    key={d.id}
                    className={cn(
                      "flex flex-col gap-3 rounded-lg border bg-background p-3 lg:flex-row lg:items-start",
                      d.archived && "opacity-60",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {d.name ?? "Unnamed department"}
                        </span>
                        <ApprovalBadge status={d.status} />
                        {d.archived && <ArchivedBadge />}
                      </div>

                      <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <UserRound className="h-3 w-3 shrink-0" />
                          {d.supervisorFullname ?? "—"}
                          {d.supervisorPosition
                            ? ` · ${d.supervisorPosition}`
                            : ""}
                        </span>
                        {d.supervisorContactNumber && (
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="h-3 w-3 shrink-0" />
                            {d.supervisorContactNumber}
                          </span>
                        )}
                        {d.supervisorEmail && (
                          <span className="inline-flex items-center gap-1.5">
                            <Mail className="h-3 w-3 shrink-0" />
                            {d.supervisorEmail}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-start gap-x-8 gap-y-3 lg:shrink-0">
                      <MoaInfo
                        start={d.moaStart}
                        expiration={d.moaExpiration}
                      />
                      <SlotsMeter filled={d.filled} slots={d.slots} />
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {!d.archived && !isApproved(d.status) && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={company.archived}
                          onClick={() => onToggleApproval(d)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className={buttonVariants({
                            variant: "ghost",
                            size: "icon",
                          })}
                          aria-label="Department actions"
                        >
                          <Ellipsis className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!d.archived && (
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => onEditDepartment(d)}
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {!d.archived && isApproved(d.status) && (
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => onToggleApproval(d)}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Mark as pending
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="gap-2"
                            onClick={() => onArchiveDepartment(d)}
                          >
                            {d.archived ? (
                              <ArchiveRestore className="h-4 w-4" />
                            ) : (
                              <Archive className="h-4 w-4" />
                            )}
                            {d.archived ? "Restore" : "Archive"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
