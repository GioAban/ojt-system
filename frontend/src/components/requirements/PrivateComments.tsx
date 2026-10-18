import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import api from "@/lib/api";
import { formatDateTime } from "@/lib/dates";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import type { CommentItem } from "@/types/requirements";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const ROLE_LABELS: Record<CommentItem["senderType"], string> = {
  COORDINATOR: "Coordinator",
  COORDINATOR_STAFF: "Staff",
  STUDENT: "Student",
};

interface PrivateCommentsProps {
  /** Buong endpoint ng usapan, hal. /coordinator/requirements/4/submissions/12/comments */
  path: string;
  studentName: string;
}

export function PrivateComments({ path, studentName }: PrivateCommentsProps) {
  const [comments, setComments] = useState<CommentItem[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    api
      .get<CommentItem[]>(path)
      .then((res) => {
        if (cancelled) return;
        setComments(res.data);
        setLoadError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setComments([]);
        setLoadError(getErrorMessage(err, "Failed to load the comments."));
      });

    return () => {
      cancelled = true;
    };
  }, [path, reloadToken]);

  const count = comments?.length ?? 0;

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [count]);

  async function send(e?: FormEvent) {
    e?.preventDefault();

    const message = draft.trim();
    if (!message || sending) return;

    setSending(true);
    try {
      const res = await api.post<CommentItem>(path, { message });
      setComments((prev) => [...(prev ?? []), res.data]);
      setDraft("");
      notify.success(`Comment sent to ${studentName}.`);
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't send the comment."));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-8 border-t pt-5">
      <h3 className="text-sm font-medium">
        Private comments
        {count > 0 && (
          <span className="ml-2 font-normal text-muted-foreground">
            {count}
          </span>
        )}
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Only you and {studentName} can see these.
      </p>

      {comments === null ? (
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="ml-auto h-12 w-2/3" />
        </div>
      ) : (
        <div
          ref={listRef}
          className="mt-4 flex max-h-80 flex-col gap-3 overflow-y-auto pr-1"
        >
          {loadError && (
            <p className="text-sm text-destructive">
              {loadError}{" "}
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setComments(null);
                  setReloadToken((t) => t + 1);
                }}
              >
                Retry
              </button>
            </p>
          )}

          {!loadError && comments.length === 0 && (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          )}

          {comments.map((c) => (
            <div
              key={c.id}
              className={cn(
                "flex flex-col gap-1",
                c.mine ? "items-end" : "items-start",
              )}
            >
              <div className="flex items-baseline gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {c.mine ? "You" : c.senderName}
                </span>
                <span>{ROLE_LABELS[c.senderType]}</span>
                <span>{formatDateTime(c.createdAt)}</span>
              </div>
              <p
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm",
                  c.mine ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {c.message}
              </p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={send} className="mt-4 flex items-end gap-2">
        <Textarea
          rows={2}
          maxLength={2000}
          placeholder={`Add a private comment for ${studentName}...`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void send();
            }
          }}
          className="min-h-0 resize-none"
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send comment"
          title="Send (Ctrl+Enter)"
          disabled={sending || !draft.trim()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
