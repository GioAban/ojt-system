import { useEffect, useState } from "react";
import { ExternalLink, Link2 } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { openExternalLink, openProtectedFile } from "@/lib/files";
import { notify } from "@/lib/notify";
import { isSignedCopyName } from "@/lib/evaluationForm";
import type { SubmissionFile } from "@/types/requirements";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  requirementId: number;
  files: SubmissionFile[];
}

/** Ipinapakita ang signed copy sa tabi ng mga score. Kinukuha gamit ang login, kaya blob ang gamit. */
export function SignedCopyViewer({ requirementId, files }: Props) {
  const documents = files.filter((f) => f.kind === "FILE");
  const links = files.filter((f) => f.kind === "LINK");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = documents.find((f) => f.id === selectedId) ?? documents.find((f) => isSignedCopyName(f.name)) ?? documents[0];
  const path = selected ? `/coordinator/requirements/${requirementId}/submissions/${selected.id}/file` : null;

  const [preview, setPreview] = useState<{ path: string; url: string | null; type: string; error: string } | null>(null);
  const current = preview && preview.path === path ? preview : null;

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    let created: string | null = null;
    api
      .get<Blob>(path, { responseType: "blob" })
      .then((res) => {
        if (cancelled) return;
        created = URL.createObjectURL(res.data);
        setPreview({ path, url: created, type: res.data.type, error: "" });
      })
      .catch((err) => {
        if (!cancelled) {
          setPreview({ path, url: null, type: "", error: getErrorMessage(err, "Couldn't load the signed copy.") });
        }
      });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [path]);

  async function open() {
    if (!path || !selected) return;
    try {
      await openProtectedFile(path, selected.name);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Couldn't open the file.");
    }
  }

  return (
    <section aria-label="Signed copy" className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Signed copy</h3>
        {selected && (
          <Button type="button" variant="outline" size="sm" onClick={() => void open()}>
            <ExternalLink className="h-3.5 w-3.5" />
            Open
          </Button>
        )}
      </div>

      {documents.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {documents.map((f) => (
            <Button
              key={f.id}
              type="button"
              size="sm"
              variant={f.id === selected?.id ? "default" : "outline"}
              className="max-w-48"
              onClick={() => setSelectedId(f.id)}
            >
              <span className="truncate">{f.name}</span>
            </Button>
          ))}
        </div>
      )}

      {!selected && (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          No signed copy has been uploaded yet.
        </p>
      )}
      {selected && !current && <Skeleton className="h-[50vh] w-full" />}
      {current?.error && <p className="text-sm text-destructive">{current.error}</p>}
      {current?.url && current.type.startsWith("image/") && (
        <img
          src={current.url}
          alt={`Signed copy: ${selected?.name}`}
          className="max-h-[70vh] w-full rounded-lg border bg-muted/30 object-contain"
        />
      )}
      {current?.url && current.type === "application/pdf" && (
        <iframe title={`Signed copy: ${selected?.name}`} src={current.url} className="h-[70vh] w-full rounded-lg border" />
      )}
      {current?.url && !current.type.startsWith("image/") && current.type !== "application/pdf" && (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          This file can't be previewed here. Use Open to view it.
        </p>
      )}

      {links.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => {
            if (!l.url || !openExternalLink(l.url)) notify.error("That link can't be opened.");
          }}
          className="inline-flex min-w-0 items-center gap-1.5 text-left text-sm text-primary underline"
        >
          <Link2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{l.name}</span>
        </button>
      ))}
    </section>
  );
}
