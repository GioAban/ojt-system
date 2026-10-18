import { cn } from "@/lib/utils";
import { SelectBox } from "@/components/tracking/SelectBox";
import { TableCell, TableHead } from "@/components/ui/table";

export const SELECT_COL = 36;
export const STUDENT_COLS = {
  num: 32,
  student: 112,
  name: 176,
  code: 92,
} as const;
export const STUDENT_COLS_WIDTH =
  STUDENT_COLS.num +
  STUDENT_COLS.student +
  STUDENT_COLS.name +
  STUDENT_COLS.code;

function offsets(selectable: boolean) {
  const base = selectable ? SELECT_COL : 0;
  return {
    num: base,
    student: base + STUDENT_COLS.num,
    name: base + STUDENT_COLS.num + STUDENT_COLS.student,
  };
}

export interface StudentIdentity {
  studentNumber: string;
  firstname: string;
  lastname: string;
  middleInitial: string | null;
  subjectCode: string;
}

export interface HeadSelection {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
}

export interface RowSelectionProps {
  checked: boolean;
  onChange: () => void;
}

export function formatStudentName(s: StudentIdentity) {
  const initial = s.middleInitial ? ` ${s.middleInitial}.` : "";
  return `${s.lastname}, ${s.firstname}${initial}`;
}

export function StudentColGroup({
  selectable = false,
}: {
  selectable?: boolean;
}) {
  return (
    <>
      {selectable && <col style={{ width: SELECT_COL }} />}
      <col style={{ width: STUDENT_COLS.num }} />
      <col style={{ width: STUDENT_COLS.student }} />
      <col style={{ width: STUDENT_COLS.name }} />
      <col style={{ width: STUDENT_COLS.code }} />
    </>
  );
}

interface StudentHeadCellsProps {
  className?: string;
  selection?: HeadSelection;
}

export function StudentHeadCells({
  className,
  selection,
}: StudentHeadCellsProps) {
  const left = offsets(Boolean(selection));
  const base = "sticky z-[1] bg-card px-2 pb-2 align-bottom";

  return (
    <>
      {selection && (
        <TableHead className={cn(base, className)} style={{ left: 0 }}>
          <SelectBox
            checked={selection.checked}
            indeterminate={selection.indeterminate}
            label="Select all students on this page"
            onChange={selection.onChange}
          />
        </TableHead>
      )}
      <TableHead className={cn(base, className)} style={{ left: left.num }}>
        #
      </TableHead>
      <TableHead className={cn(base, className)} style={{ left: left.student }}>
        Student
      </TableHead>
      <TableHead
        className={cn(base, "shadow-[1px_0_0_0_var(--border)]", className)}
        style={{ left: left.name }}
      >
        Name
      </TableHead>
      <TableHead className={cn("px-2 pb-2 align-bottom", className)}>
        Code
      </TableHead>
    </>
  );
}

interface StudentCellsProps {
  number: number;
  student: StudentIdentity;
  selection?: RowSelectionProps;
}

export function StudentCells({
  number,
  student,
  selection,
}: StudentCellsProps) {
  const left = offsets(Boolean(selection));
  const name = formatStudentName(student);
  const bg = selection?.checked ? "bg-muted" : "bg-card";

  return (
    <>
      {selection && (
        <TableCell
          className={cn("sticky z-[1] px-2 py-0", bg)}
          style={{ left: 0 }}
        >
          <SelectBox
            checked={selection.checked}
            label={`Select ${name}`}
            onChange={selection.onChange}
          />
        </TableCell>
      )}
      <TableCell
        className={cn("sticky z-[1] px-2 py-0 text-muted-foreground", bg)}
        style={{ left: left.num }}
      >
        {number}
      </TableCell>
      <TableCell
        className={cn("sticky z-[1] truncate px-2 py-0", bg)}
        style={{ left: left.student }}
        title={student.studentNumber}
      >
        {student.studentNumber}
      </TableCell>
      <TableCell
        className={cn(
          "sticky z-[1] truncate px-2 py-0 font-medium shadow-[1px_0_0_0_var(--border)]",
          bg,
        )}
        style={{ left: left.name }}
        title={name}
      >
        {name}
      </TableCell>
      <TableCell className="truncate px-2 py-0" title={student.subjectCode}>
        {student.subjectCode}
      </TableCell>
    </>
  );
}
