import { useEffect, useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";
import { useEditor } from "@/components/reports/editor/editorContext";
import { ZWSP, caretOf, focusSibling, readText as read, setCaret } from "@/components/reports/editor/caret";

/** Pareho sa edit at sa print: block, may isang linyang pinakamaliit na taas, at sumusunod sa line break */
const BASE: CSSProperties = { minHeight: "1.3em", whiteSpace: "pre-wrap", overflowWrap: "anywhere" };

let plaintextSupport: boolean | null = null;
function supportsPlaintextOnly() {
  if (plaintextSupport === null) {
    const el = document.createElement("div");
    el.contentEditable = "plaintext-only";
    plaintextSupport = el.contentEditable === "plaintext-only";
  }
  return plaintextSupport;
}

export interface TextControl {
  el: HTMLElement;
  text: string;
  caret: number;
  /** Palitan ang laman sa DOM nang hindi nagko-commit (hal. bago hatiin ang bullet) */
  setText: (value: string) => void;
}

export interface SheetTextProps {
  /** Matatag na id (ginagamit sa focus, Tab, at bottom sheet) */
  id: string;
  value: string;
  editable: boolean;
  label: string;
  onCommit?: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  style?: CSSProperties;
  /** May tuldok: iba sa nasa system (sa editor lang, hindi sa print) */
  edited?: boolean;
  /** Sa paglabas lang sa cell magko-commit (kapag nakakagalaw ng row ang pagbabago, hal. pag-ayos) */
  blurOnly?: boolean;
  /** Sariling key handling (hal. bullet); ibalik ang true kung naasikaso na */
  onKey?: (e: KeyboardEvent<HTMLDivElement>, ctl: TextControl) => boolean;
}

/**
 * Teksto sa papel. Sa print/preview: simpleng div. Sa editor: plain-text na contentEditable na
 * HINDI kinokontrol ng React habang nagta-type (hindi nagre-render ang laman sa ilalim ng cursor).
 * Kino-commit pagkalipas ng 250 ms at paglabas sa cell.
 */
export function SheetText(props: SheetTextProps) {
  const { id, value, editable, style } = props;
  const editor = useEditor();
  if (!editable || !editor) {
    return <div style={{ ...BASE, ...style }}>{value}</div>;
  }
  if (editor.touch) {
    return (
      <div
        data-cell-id={id}
        data-edited={props.edited ? "" : undefined}
        data-ph={props.placeholder ?? "Tap to type"}
        role="button"
        tabIndex={0}
        aria-label={`${props.label}: ${value || "empty"}`}
        style={{ ...BASE, ...style, cursor: "pointer" }}
        onClick={() => editor.openSheet(id)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); editor.openSheet(id); } }}
      >
        {value}
      </div>
    );
  }
  return <LiveText {...props} />;
}

function LiveText({ id, value, label, onCommit, multiline = false, placeholder, style, onKey, edited, blurOnly }: SheetTextProps) {
  const editor = useEditor()!;
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const committed = useRef(value);
  const commitRef = useRef(onCommit);
  const onKeyRef = useRef(onKey);

  useEffect(() => {
    commitRef.current = onCommit;
    onKeyRef.current = onKey;
  });

  // Isinusulat lang ang laman kapag hindi ito ang ine-edit (hal. undo, reload); hindi ginagalaw habang nagta-type
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if (read(el) !== value) el.textContent = value;
    committed.current = value;
  }, [value]);

  // Pagka-mount: kung ito ang ine-edit bago na-remount, ibalik ang focus at cursor
  useLayoutEffect(() => {
    const el = ref.current;
    const a = editor.getActive();
    if (!el || !a || a.id !== id) return;
    const free = !document.activeElement || document.activeElement === document.body;
    if (!free) return;
    if (a.text !== undefined && read(el) !== a.text) el.textContent = a.text;
    el.focus();
    setCaret(el, a.caret);
  }, [editor, id]);

  const flush = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    const el = ref.current;
    if (!el) return;
    const v = read(el);
    if (v !== committed.current) {
      committed.current = v;
      commitRef.current?.(v);
    }
  };

  // Kapag na-unmount habang may hindi pa naco-commit, i-commit pa rin
  useEffect(() => () => {
    if (timer.current !== undefined) {
      window.clearTimeout(timer.current);
      const el = ref.current;
      if (el) {
        const v = read(el);
        if (v !== committed.current) commitRef.current?.(v);
      }
    }
  }, []);

  const remember = () => {
    const el = ref.current;
    if (!el) return;
    editor.setActive({ id, caret: caretOf(el), text: read(el) });
  };

  const insert = (text: string) => {
    document.execCommand("insertText", false, text);
  };

  return (
    <div
      ref={ref}
      data-cell-id={id}
      data-edited={edited ? "" : undefined}
      data-ph={placeholder ?? "Type here"}
      contentEditable={supportsPlaintextOnly() ? "plaintext-only" : "true"}
      role="textbox"
      aria-multiline={multiline}
      aria-label={label}
      spellCheck
      style={{ ...BASE, ...style }}
      onFocus={(e) => {
        const el = e.currentTarget;
        const row = el.closest("tr[data-unit-key]");
        const page = el.closest("[data-page-index]");
        editor.onCellFocus({
          id,
          rowKey: row?.getAttribute("data-unit-key") ?? null,
          page: Number(page?.getAttribute("data-page-index") ?? 0),
        });
        remember();
      }}
      onBlur={(e) => {
        const el = e.currentTarget;
        flush();
        // Kung naiba ang laman mula sa labas habang naka-focus (hal. hinati ang bullet), isabay na ngayon
        window.setTimeout(() => {
          if (!el.isConnected) return; // na-remount: hayaang ibalik ng bagong kopya ang focus
          if (editor.getActive()?.id === id && document.activeElement !== el) editor.setActive(null);
          editor.onCellBlur(id);
        }, 0);
      }}
      onInput={(e) => {
        const el = e.currentTarget;
        if (read(el) === "" && el.childNodes.length > 0) el.textContent = "";
        remember();
        window.clearTimeout(timer.current);
        if (!blurOnly) timer.current = window.setTimeout(flush, 250);
      }}
      onKeyUp={remember}
      onMouseUp={remember}
      onPaste={(e) => {
        e.preventDefault();
        let text = e.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n");
        if (!multiline) text = text.replace(/\s*\n\s*/g, " ");
        insert(text);
      }}
      onDrop={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        const el = e.currentTarget;
        if (onKeyRef.current) {
          const ctl: TextControl = {
            el,
            text: read(el),
            caret: caretOf(el),
            setText: (v) => { el.textContent = v; committed.current = v; },
          };
          if (onKeyRef.current(e, ctl)) return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          flush();
          el.blur();
          editor.focusControls();
          return;
        }
        if (e.key === "Enter" && !(e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          if (multiline && !e.altKey) {
            // Sa dulo ng teksto, kailangan ng pansamantalang titik para makita ang bagong linya
            const atEnd = caretOf(el) >= read(el).length && !read(el).endsWith("\n");
            insert(atEnd ? "\n" + ZWSP : "\n");
          } else {
            flush();
            focusSibling(el, 1);
          }
        }
      }}
    />
  );
}
