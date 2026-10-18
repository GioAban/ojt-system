import { CalendarDays } from "lucide-react";
import { useSemester } from "@/contexts/semesterContext";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";

export function SemesterSwitcher() {
  const { semesters, semesterId, setSemesterId, loaded, error } = useSemester();

  if (!loaded) return <Skeleton className="h-9 w-48" />;

  if (error) {
    return (
      <span className="text-xs text-destructive" title={error}>
        Semesters unavailable
      </span>
    );
  }

  if (semesters.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">No active semester</span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <CalendarDays className="hidden h-4 w-4 text-muted-foreground sm:block" />
      <NativeSelect
        aria-label="Active semester"
        title="All data on this page is for the selected semester"
        value={semesterId === null ? "" : String(semesterId)}
        onChange={(e) => setSemesterId(Number(e.target.value))}
      >
        {semesters.map((s) => (
          <NativeSelectOption key={s.id} value={String(s.id)}>
            {s.semester}
            {s.isDefault ? " (default)" : ""}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
