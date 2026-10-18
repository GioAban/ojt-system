import { useMemo, useState } from "react";
import api from "@/lib/api";
import { PHONE_PATTERN } from "@/lib/company";
import { formatLongDate } from "@/lib/dates";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useSectionData } from "@/hooks/useTracking";
import type {
  CompanyInfoData,
  CompanyInfoEditResult,
  CompanyInfoRow,
} from "@/types/companyInfo";
import { DataTablePagination } from "@/components/DataTablePagination";
import { EditableCell } from "@/components/tracking/EditableCell";
import { formatStudentName } from "@/components/tracking/StudentColumns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const BASE = "/coordinator/tracking/company-info";

const COL = {
  num: 48,
  studentId: 112,
  name: 176,
  code: 88,
  company: 280,
  address: 280,
  contact: 150,
  supervisor: 200,
  position: 180,
  started: 160,
  location: 150,
} as const;

const MIN_WIDTH = Object.values(COL).reduce((sum, w) => sum + w, 0);

// Sticky na kaliwang mga column
const LEFT = {
  num: 0,
  studentId: COL.num,
  name: COL.num + COL.studentId,
} as const;

const STICKY_HEAD = "sticky z-[1] bg-card px-2";
const STICKY_CELL = "sticky z-[1] bg-card px-2 py-2 align-top";
const CELL = "whitespace-normal px-1 py-1 align-top";

type CompanyField = "name" | "address" | "contactNumber" | "location";
type DepartmentField = "name" | "supervisorName" | "supervisorPosition";

interface CompanyInfoPanelProps {
  semesterId: number;
  search: string;
}

function required(label: string) {
  return (value: string) => (value ? null : `${label} is required.`);
}

function phone(value: string) {
  if (!value) return "Contact number is required.";
  if (!PHONE_PATTERN.test(value)) {
    return "Use digits, spaces, +, -, or parentheses (7 to 20 characters).";
  }
  return null;
}

export function CompanyInfoPanel({
  semesterId,
  search,
}: CompanyInfoPanelProps) {
  const { data, error, loading, reload, update } =
    useSectionData<CompanyInfoData>(BASE, semesterId);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [prevSearch, setPrevSearch] = useState(search);

  if (prevSearch !== search) {
    setPrevSearch(search);
    setPage(1);
  }

  const filtered = useMemo(() => {
    const rows = data?.students ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((s) =>
      [
        s.studentNumber,
        s.lastname,
        s.firstname,
        s.subjectCode,
        s.companyName,
        s.departmentName,
        s.address,
        s.contactNumber,
        s.supervisorName,
        s.supervisorPosition,
        s.location,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * pageSize;
  const pageRows = filtered.slice(offset, offset + pageSize);

  function patchWhere(
    match: (s: CompanyInfoRow) => boolean,
    patch: Partial<CompanyInfoRow>,
  ) {
    update((d) => ({
      ...d,
      students: d.students.map((s) => (match(s) ? { ...s, ...patch } : s)),
    }));
  }

  function alsoUpdated(affected: number, where: string) {
    if (affected > 1) {
      notify.success(
        `Saved. Also updated for ${affected - 1} other student(s) placed in this ${where}.`,
      );
    }
  }

  async function saveCompany(
    row: CompanyInfoRow,
    field: CompanyField,
    value: string,
  ) {
    const res = await api.patch<CompanyInfoEditResult>(
      `${BASE}/company/${row.companyId}`,
      {
        field,
        value,
      },
    );
    const saved = res.data.value ?? "";

    const patch: Partial<CompanyInfoRow> =
      field === "name"
        ? { companyName: saved }
        : field === "address"
          ? { address: saved }
          : field === "contactNumber"
            ? { contactNumber: saved }
            : { location: saved };

    patchWhere((s) => s.companyId === row.companyId, patch);
    alsoUpdated(res.data.affected, "company");
  }

  async function saveDepartment(
    row: CompanyInfoRow,
    field: DepartmentField,
    value: string,
  ) {
    const res = await api.patch<CompanyInfoEditResult>(
      `${BASE}/department/${row.departmentId}`,
      {
        field,
        value,
      },
    );
    const saved = res.data.value ?? "";

    const patch: Partial<CompanyInfoRow> =
      field === "name"
        ? { departmentName: saved }
        : field === "supervisorName"
          ? { supervisorName: saved }
          : { supervisorPosition: saved };

    patchWhere((s) => s.departmentId === row.departmentId, patch);
    alsoUpdated(res.data.affected, "department");
  }

  async function saveStartDate(row: CompanyInfoRow, value: string) {
    const res = await api.patch<CompanyInfoEditResult>(
      `${BASE}/student/${row.id}/start-date`,
      {
        value,
      },
    );
    patchWhere((s) => s.id === row.id, { startDate: res.data.value });
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          Click a cell to edit. Enter or click away to save, Esc to cancel.
        </span>
        <span className="text-muted-foreground/70">
          · Company details apply to every student in that company, and the
          department and supervisor to every student in that department.
        </span>
        {data && (
          <span className="ml-auto">
            {filtered.length} of {data.students.length} students
          </span>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription className="flex items-center justify-between gap-4">
            {error}
            <Button variant="outline" size="sm" onClick={reload}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="isolate rounded-xl border bg-card">
        {loading && (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        )}

        {data && data.students.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No students have been assigned to a company yet. Assign them in the
            Initial tab.
          </p>
        )}

        {data && data.students.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <Table
                className="table-fixed text-sm"
                style={{ minWidth: MIN_WIDTH }}
              >
                <colgroup>
                  <col style={{ width: COL.num }} />
                  <col style={{ width: COL.studentId }} />
                  <col style={{ width: COL.name }} />
                  <col style={{ width: COL.code }} />
                  <col style={{ width: COL.company }} />
                  <col style={{ width: COL.address }} />
                  <col style={{ width: COL.contact }} />
                  <col style={{ width: COL.supervisor }} />
                  <col style={{ width: COL.position }} />
                  <col style={{ width: COL.started }} />
                  <col style={{ width: COL.location }} />
                </colgroup>

                <TableHeader>
                  <TableRow>
                    <TableHead
                      className={STICKY_HEAD}
                      style={{ left: LEFT.num }}
                    >
                      #
                    </TableHead>
                    <TableHead
                      className={STICKY_HEAD}
                      style={{ left: LEFT.studentId }}
                    >
                      Student Id
                    </TableHead>
                    <TableHead
                      className={cn(
                        STICKY_HEAD,
                        "shadow-[1px_0_0_0_var(--border)]",
                      )}
                      style={{ left: LEFT.name }}
                    >
                      Name
                    </TableHead>
                    <TableHead className="px-2">Code</TableHead>
                    <TableHead className="px-2">
                      Company name - Department
                    </TableHead>
                    <TableHead className="px-2">Company address</TableHead>
                    <TableHead className="px-2">Contact No.</TableHead>
                    <TableHead className="px-2">Supervisor name</TableHead>
                    <TableHead className="px-2">Position</TableHead>
                    <TableHead className="px-2">Date started</TableHead>
                    <TableHead className="px-2">Location</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {pageRows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={11}
                        className="py-10 text-center text-muted-foreground"
                      >
                        No students found.
                      </TableCell>
                    </TableRow>
                  )}

                  {pageRows.map((s, index) => {
                    const name = formatStudentName(s);

                    return (
                      <TableRow key={s.id}>
                        <TableCell
                          className={cn(STICKY_CELL, "text-muted-foreground")}
                          style={{ left: LEFT.num }}
                        >
                          {offset + index + 1}
                        </TableCell>

                        <TableCell
                          className={cn(STICKY_CELL, "truncate")}
                          style={{ left: LEFT.studentId }}
                          title={s.studentNumber}
                        >
                          {s.studentNumber}
                        </TableCell>

                        <TableCell
                          className={cn(
                            STICKY_CELL,
                            "truncate font-medium shadow-[1px_0_0_0_var(--border)]",
                          )}
                          style={{ left: LEFT.name }}
                          title={name}
                        >
                          {name}
                        </TableCell>

                        <TableCell className="px-2 py-2 align-top">
                          {s.subjectCode}
                        </TableCell>

                        <TableCell className={CELL}>
                          <div className="flex flex-col">
                            <EditableCell
                              label="Company name"
                              value={s.companyName}
                              maxLength={255}
                              validate={required("Company name")}
                              display={(v) => (
                                <span className="font-medium">{v}</span>
                              )}
                              onSave={(v) => saveCompany(s, "name", v)}
                            />
                            <EditableCell
                              label="Department"
                              value={s.departmentName}
                              placeholder="Add department name"
                              maxLength={255}
                              validate={required("Department name")}
                              display={(v) => (
                                <span className="text-xs text-muted-foreground">
                                  – {v}
                                </span>
                              )}
                              onSave={(v) => saveDepartment(s, "name", v)}
                            />
                          </div>
                        </TableCell>

                        <TableCell className={CELL}>
                          <EditableCell
                            label="Company address"
                            kind="multiline"
                            value={s.address}
                            maxLength={255}
                            validate={required("Address")}
                            onSave={(v) => saveCompany(s, "address", v)}
                          />
                        </TableCell>

                        <TableCell className={CELL}>
                          <EditableCell
                            label="Contact number"
                            kind="tel"
                            value={s.contactNumber}
                            validate={phone}
                            onSave={(v) => saveCompany(s, "contactNumber", v)}
                          />
                        </TableCell>

                        <TableCell className={CELL}>
                          <EditableCell
                            label="Supervisor name"
                            value={s.supervisorName}
                            maxLength={255}
                            validate={required("Supervisor name")}
                            onSave={(v) =>
                              saveDepartment(s, "supervisorName", v)
                            }
                          />
                        </TableCell>

                        <TableCell className={CELL}>
                          <EditableCell
                            label="Position"
                            value={s.supervisorPosition}
                            maxLength={255}
                            onSave={(v) =>
                              saveDepartment(s, "supervisorPosition", v)
                            }
                          />
                        </TableCell>

                        <TableCell className={CELL}>
                          <EditableCell
                            label="Date started"
                            kind="date"
                            value={s.startDate}
                            display={(v) => formatLongDate(v)}
                            onSave={(v) => saveStartDate(s, v)}
                          />
                        </TableCell>

                        <TableCell className={CELL}>
                          <EditableCell
                            label="Location"
                            value={s.location}
                            maxLength={255}
                            onSave={(v) => saveCompany(s, "location", v)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <DataTablePagination
              page={currentPage}
              pageSize={pageSize}
              total={filtered.length}
              pageSizeOptions={[10, 20, 50]}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </div>
    </>
  );
}
