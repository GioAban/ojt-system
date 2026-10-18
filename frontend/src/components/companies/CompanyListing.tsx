import {
  Archive,
  ArchiveRestore,
  CheckCircle2,
  Ellipsis,
  Mail,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isApproved } from "@/lib/company";
import type { CompanyItem, DepartmentItem, ListingRow } from "@/types/company";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CompanyListingProps {
  rows: ListingRow[];
  offset: number;
  onEditCompany: (company: CompanyItem) => void;
  onArchiveCompany: (company: CompanyItem) => void;
  onAddDepartment: (company: CompanyItem) => void;
  onEditDepartment: (company: CompanyItem, department: DepartmentItem) => void;
  onToggleApproval: (company: CompanyItem, department: DepartmentItem) => void;
  onArchiveDepartment: (
    company: CompanyItem,
    department: DepartmentItem,
  ) => void;
  onManageMoa: (company: CompanyItem, department: DepartmentItem) => void;
}

const CELL = "whitespace-normal align-top";

export function CompanyListing({
  rows,
  offset,
  onEditCompany,
  onArchiveCompany,
  onAddDepartment,
  onEditDepartment,
  onToggleApproval,
  onArchiveDepartment,
  onManageMoa,
}: CompanyListingProps) {
  return (
    <Table className="min-w-[1200px] text-sm">
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Department</TableHead>
          <TableHead>Supervisor</TableHead>
          <TableHead>MOA</TableHead>
          <TableHead>Signed MOA</TableHead>
          <TableHead>Slots</TableHead>
          <TableHead className="w-12 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {rows.map((row, index) => {
          const { company, department: d } = row;
          const dimmed = company.archived || Boolean(d?.archived);
          const editable = Boolean(d) && !d!.archived && !company.archived;
          const frozen = company.archived || Boolean(d?.archived);
          const fileCount = d?.moaFiles.length ?? 0;

          return (
            <TableRow key={row.key} className={cn(dimmed && "opacity-60")}>
              <TableCell className={cn(CELL, "text-muted-foreground")}>
                {offset + index + 1}
              </TableCell>

              {/* Company */}
              <TableCell className={CELL}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{company.name}</span>
                  {company.nature && (
                    <Badge variant="secondary">{company.nature}</Badge>
                  )}
                  {company.archived && <ArchivedBadge />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {company.address}
                </p>
                <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {company.contactNumber}
                </p>
              </TableCell>

              {/* Department */}
              <TableCell className={CELL}>
                {d ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {d.name ?? "Unnamed department"}
                    </span>
                    <ApprovalBadge status={d.status} />
                    {d.archived && <ArchivedBadge />}
                  </div>
                ) : (
                  <div className="flex flex-col items-start gap-2">
                    <span className="text-xs text-muted-foreground">
                      No departments yet
                    </span>
                    {!company.archived && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onAddDepartment(company)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add department
                      </Button>
                    )}
                  </div>
                )}
              </TableCell>

              {/* Supervisor */}
              <TableCell className={CELL}>
                {d ? (
                  <div className="flex flex-col gap-1 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {d.supervisorFullname ?? "—"}
                    </span>
                    {d.supervisorPosition && (
                      <span className="text-muted-foreground">
                        {d.supervisorPosition}
                      </span>
                    )}
                    {d.supervisorContactNumber && (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3 w-3 shrink-0" />
                        {d.supervisorContactNumber}
                      </span>
                    )}
                    {d.supervisorEmail && (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="h-3 w-3 shrink-0" />
                        {d.supervisorEmail}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {company.supervisorName}
                    </span>
                    <span className="text-muted-foreground">
                      {company.supervisorPosition}
                    </span>
                    <span className="text-muted-foreground">
                      Company supervisor
                    </span>
                  </div>
                )}
              </TableCell>

              {/* MOA */}
              <TableCell className={CELL}>
                {d ? (
                  <MoaInfo start={d.moaStart} expiration={d.moaExpiration} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>

              {/* Signed MOA */}
              <TableCell className={CELL}>
                {!d || (frozen && fileCount === 0) ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant={fileCount > 0 ? "outline" : "ghost"}
                    title={d.moaFiles.map((f) => f.name).join("\n")}
                    onClick={() => onManageMoa(company, d)}
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    {fileCount > 0
                      ? `${fileCount} file${fileCount === 1 ? "" : "s"}`
                      : "Upload"}
                  </Button>
                )}
              </TableCell>

              {/* Slots */}
              <TableCell className={CELL}>
                {d ? (
                  <SlotsMeter filled={d.filled} slots={d.slots} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>

              {/* Actions */}
              <TableCell className="text-right align-top">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className={buttonVariants({
                      variant: "ghost",
                      size: "icon",
                    })}
                    aria-label="Row actions"
                  >
                    <Ellipsis className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {d && editable && (
                      <>
                        <DropdownMenuItem
                          className="gap-2"
                          onClick={() => onEditDepartment(company, d)}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit department
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2"
                          onClick={() => onToggleApproval(company, d)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {isApproved(d.status) ? "Mark as pending" : "Approve"}
                        </DropdownMenuItem>
                      </>
                    )}

                    {d && (
                      <DropdownMenuItem
                        className="gap-2"
                        onClick={() => onManageMoa(company, d)}
                      >
                        <Paperclip className="h-4 w-4" />
                        Signed MOA files
                      </DropdownMenuItem>
                    )}

                    {d && !company.archived && (
                      <DropdownMenuItem
                        className="gap-2"
                        onClick={() => onArchiveDepartment(company, d)}
                      >
                        {d.archived ? (
                          <ArchiveRestore className="h-4 w-4" />
                        ) : (
                          <Archive className="h-4 w-4" />
                        )}
                        {d.archived
                          ? "Restore department"
                          : "Archive department"}
                      </DropdownMenuItem>
                    )}

                    {d && <DropdownMenuSeparator />}

                    {!company.archived && (
                      <>
                        <DropdownMenuItem
                          className="gap-2"
                          onClick={() => onAddDepartment(company)}
                        >
                          <Plus className="h-4 w-4" />
                          Add department
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2"
                          onClick={() => onEditCompany(company)}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit company
                        </DropdownMenuItem>
                      </>
                    )}

                    <DropdownMenuItem
                      className="gap-2"
                      onClick={() => onArchiveCompany(company)}
                    >
                      {company.archived ? (
                        <ArchiveRestore className="h-4 w-4" />
                      ) : (
                        <Archive className="h-4 w-4" />
                      )}
                      {company.archived ? "Restore company" : "Archive company"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
