import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Lock, Send } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/requirementUi";
import type { CommentItem } from "@/types/studentProfile";
import { Button } from "@/components/ui/button";

interface Props {
  /** Saan kukunin at ipapadala ang comments */
  listUrl: string;
  listParams?: Record<string, string | number>;
  postUrl: string;
  /** Idinadagdag sa laman ng POST (hal. scope, studentId, itemId para sa coordinator) */
  postExtra?: Record<string, unknown>;
  /** Sino ang kausap: ipinapakita sa paliwanag */
  otherParty: string;
  className?: string;
}

/** Private na usapan ng student at coordinator tungkol sa isang isinumite */
export function PrivateComments({
  listUrl,
  listParams,
  postUrl,
  postExtra,
  otherParty,
  className,
}: Props) {
  const [items, setItems] = useState<CommentItem[] | null>(null);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const paramsKey = JSON.stringify(listParams ?? {});

  const load = useCallback(() => {
    api
      .get<CommentItem[]>(listUrl, { params: listParams })
      .then((res) => {
        setItems(res.data);
        setError("");
      })
      .catch((err) =>
        setError(getErrorMessage(err, "Couldn't load the comments.")),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listUrl, paramsKey]);

  useEffect(() => {
    load();
  }, [load]);

  // Para lumabas ang sagot ng kausap nang hindi nire-refresh ang page
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible" && !sending) load();
    }, 30000);
    return () => window.clearInterval(id);
  }, [load, sending]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [items?.length]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await api.post<CommentItem[]>(postUrl, {
        ...(postExtra ?? {}),
        body,
      });
      setItems(res.data);
      setText("");
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't send your comment."));
    } finally {
      setSending(false);
    }
  }

  return (
    <section
      aria-label="Private comments"
      className={cn("flex flex-col gap-2", className)}
    >
      <div className="flex items-center gap-1.5">
        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Private comments</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Only you and {otherParty} can see these.
      </p>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {items === null && !error && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      )}

      {items && items.length > 0 && (
        <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
          {items.map((c) => (
            <li
              key={c.id}
              className={cn(
                "flex flex-col",
                c.mine ? "items-end" : "items-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                  c.mine ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {c.body}
              </div>
              <span className="mt-0.5 px-1 text-[11px] text-muted-foreground">
                {c.mine ? "You" : c.authorName || otherParty} ·{" "}
                {timeAgo(c.createdAt)}
              </span>
            </li>
          ))}
          <div ref={endRef} />
        </ul>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          maxLength={2000}
          placeholder={`Add a private comment for ${otherParty}…`}
          className="min-h-[2.5rem] flex-1 resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button
          type="button"
          size="icon"
          disabled={sending || !text.trim()}
          aria-label="Send comment"
          onClick={() => void send()}
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </section>
  );
}
