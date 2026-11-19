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
  Plus,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ContactText } from "@/components/ContactText";
import { SkillChips } from "@/components/skills/SkillChips";
import { isApproved, supervisorMissing } from "@/lib/company";
import { DepartmentSupervisorLines } from "@/components/companies/parts";
import type { CompanyItem, DepartmentItem } from "@/types/company";
import {
  ApprovalBadge,
  ArchivedBadge,
  MoaInfo,
  SlotsMeter, SupervisorMissingBadge } from "@/components/companies/parts";
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
                <span className="inline-flex h-5 items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                  {pending} pending
                </span>
              )}
            </span>
            <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{company.address}</span>
            </span>
            {company.skills.length > 0 && (
              // Buod lang sa header (button ito); buong chips sa loob kapag binuksan
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                Skills: {company.skills.slice(0, 3).join(", ")}
                {company.skills.length > 3 ? ` +${company.skills.length - 3} more` : ""}
              </span>
            )}
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
              <ContactText value={company.contactNumber} className="gap-2" iconClassName="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="flex flex-col gap-2 text-sm">
              <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                Immediate supervisor
                {supervisorMissing(company) && <SupervisorMissingBadge />}
              </p>
              <span className="inline-flex items-center gap-2">
                <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                {company.supervisorName ? (
                  <span>
                    {company.supervisorName}
                    <span className="block text-xs text-muted-foreground">
                      {company.supervisorPosition}
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">None set</span>
                )}
              </span>
              <ContactText value={company.supervisorContactNumber} className="gap-2 text-xs text-muted-foreground"
                iconClassName="h-3.5 w-3.5" />
              {company.supervisorEmail && (
                <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  {company.supervisorEmail}
                </span>
              )}
              {(company.idType || company.idNumber) && (
                <span className="text-xs text-muted-foreground">
                  {company.idType ?? "ID"}: {company.idNumber ?? "—"}
                </span>
              )}
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Skills needed
            </p>
            <SkillChips skills={company.skills} collapseAfter={12}
              emptyText="None listed yet. Add skills so this company is suggested to students." />
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

                      <DepartmentSupervisorLines company={company} d={d} />

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
