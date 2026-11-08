import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Ilan ang ipinapakita bago pindutin ang "View all" */
const PREVIEW = 5;

function studentLink(id: number) {
  return `/coordinator/students?student=${id}`;
}

interface StudentListProps<T extends { id: number; name: string }> {
  rows: T[];
  /** Kanang bahagi ng row (hal. porsiyento) */
  aside: (row: T) => ReactNode;
  /** Maliit na text sa ilalim ng pangalan */
  detail?: (row: T) => ReactNode;
}

/** Listahan ng student na may link sa detalye; limang una, may "View all" kapag mas marami */
export function StudentList<T extends { id: number; name: string }>({ rows, aside, detail }: StudentListProps<T>) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, PREVIEW);

  return (
    <div className="flex flex-col">
      <ul className="-mx-2 flex flex-col">
        {shown.map((row) => (
          <li key={row.id}>
            <Link
              to={studentLink(row.id)}
              className="flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 outline-none transition hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{row.name}</span>
                {detail && <span className="block text-xs text-muted-foreground">{detail(row)}</span>}
              </span>
              <span className="shrink-0 text-sm tabular-nums">{aside(row)}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      {rows.length > PREVIEW && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1 self-start"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : `View all (${rows.length})`}
        </Button>
      )}
    </div>
  );
}
