import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Download, HardDrive, Plus, Trash2, Upload } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { notify } from "@/lib/notify";
import {
  exportFile, newSignatoryId, parseFile, rememberPerson,
  type ManualSignatory, type ReportSignatories, type SignAlign, type SignatoryPerson,
} from "@/lib/manualSignatories";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ManageSignatoriesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: ReportSignatories;
  onChange: (next: ReportSignatories) => void;
  people: SignatoryPerson[];
  onPeople: (next: SignatoryPerson[]) => void;
  /** Annual at HTE lang: may built-in na pirmahan na pwedeng ipakita pa rin */
  hasBuiltIn: boolean;
  /** Para sa pangalan ng file na ie-export */
  reportTitle: string;
  /** Signatory na bubuksan agad (bagong idinagdag o ine-edit) */
  focusId?: string | null;
}

const LABELS = ["Prepared by:", "Reviewed by:", "Noted by:", "Approved by:", "Certified true and correct:"];
const POSITIONS = ["OJT Coordinator", "Program Head", "Dean", "Director", "Chairperson"];
const ALIGN_OPTIONS: { value: SignAlign; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

function AlignPicker({ value, onChange, name }: { value: SignAlign; onChange: (v: SignAlign) => void; name: string }) {
  return (
    <div role="radiogroup" aria-label="Alignment" className="inline-flex overflow-hidden rounded-md border">
      {ALIGN_OPTIONS.map((o) => (
        <label
          key={o.value}
          className={cn(
            "flex cursor-pointer items-center px-3 text-sm pointer-coarse:min-h-11 sm:h-8",
            value === o.value ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
          )}
        >
          <input
            type="radio"
            className="sr-only"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

/**
 * Pamamahala ng pirmahan sa dulo ng report: idagdag, baguhin, burahin, ayusin, at ang ayos (kaliwa, gitna, kanan).
 * Naka-save sa device lang. May Export at Import (JSON) para mailipat sa ibang device o browser.
 */
export function ManageSignatoriesSheet(p: ManageSignatoriesSheetProps) {
  const touch = useIsMobile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [imported, setImported] = useState<ManualSignatory[] | null>(null);
  const items = p.value.items;

  // Pagbukas sa isang signatory: i-scroll at i-focus ang pangalan nito
  useEffect(() => {
    if (!p.open || !p.focusId) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(`sig-${p.focusId}-name`);
      el?.scrollIntoView({ block: "center" });
      el?.focus();
    }, 150);
    return () => window.clearTimeout(t);
  }, [p.open, p.focusId]);

  const setItems = (next: ManualSignatory[]) => p.onChange({ ...p.value, items: next });
  const patch = (id: string, change: Partial<ManualSignatory>) =>
    setItems(items.map((s) => (s.id === id ? { ...s, ...change } : s)));
  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[index], next[j]] = [next[j], next[index]];
    setItems(next);
  };
  const add = () =>
    setItems([...items, { id: newSignatoryId(), label: "", name: "", position: "", align: items.length % 2 === 0 ? "left" : "right", dateLine: false }]);

  /** Pagpili ng kilalang pangalan: kinukuha ang posisyon at ayos nito */
  const setName = (s: ManualSignatory, name: string) => {
    const known = p.people.find((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase());
    patch(s.id, known && !s.position.trim() ? { name: known.name, position: known.position, align: known.align } : { name });
  };

  function doExport() {
    const url = URL.createObjectURL(exportFile(p.people, items));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(p.reportTitle || "Report").replace(/[\\/:*?"<>|]+/g, " ").trim()} - signatories.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function doImport(file: File) {
    const parsed = parseFile(await file.text());
    if (!parsed) {
      notify.error("That file isn't a signatories file exported from Reports.");
      return;
    }
    let people = p.people;
    for (const person of parsed.people) people = rememberPerson(people, person);
    p.onPeople(people);
    notify.success(`Imported ${parsed.people.length} saved ${parsed.people.length === 1 ? "person" : "people"}.`);
    if (parsed.signatories.length > 0) setImported(parsed.signatories);
  }

  const datalist = (id: string, values: string[]) => (
    <datalist id={id}>
      {[...new Set(values.filter(Boolean))].map((v) => <option key={v} value={v} />)}
    </datalist>
  );

  return (
    <>
      <Sheet open={p.open} onOpenChange={p.onOpenChange}>
        <SheetContent
          side={touch ? "bottom" : "right"}
          className={cn("gap-0 p-0", touch ? "max-h-[92dvh]" : "w-full sm:max-w-lg")}
        >
          <SheetHeader className="border-b p-4">
            <SheetTitle>Signatories</SheetTitle>
            <SheetDescription className="inline-flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 shrink-0" /> Saved on this device only.
            </SheetDescription>
          </SheetHeader>

          {datalist("sig-labels", LABELS)}
          {datalist("sig-names", p.people.map((x) => x.name))}
          {datalist("sig-positions", [...p.people.map((x) => x.position), ...POSITIONS])}

          <Tabs defaultValue="report" className="min-h-0 flex-1 overflow-y-auto p-4">
            <TabsList>
              <TabsTrigger value="report">This report</TabsTrigger>
              <TabsTrigger value="people">Saved people ({p.people.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="report" className="mt-4 flex flex-col gap-3">
              {p.hasBuiltIn && (
                <label className="flex items-start gap-2 rounded-lg border p-3 text-sm pointer-coarse:min-h-11">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 pointer-coarse:h-5 pointer-coarse:w-5"
                    checked={p.value.showBuiltIn}
                    onChange={(e) => p.onChange({ ...p.value, showBuiltIn: e.target.checked })}
                  />
                  <span>
                    Also show the built-in section
                    <span className="block text-xs text-muted-foreground">
                      Prepared by, Noted and Certified True and Correct appear first, then these signatories.
                      When off, these signatories replace the built-in section.
                    </span>
                  </span>
                </label>
              )}

              {items.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No signatories yet.{p.hasBuiltIn ? " The built-in section is shown." : " Nothing is printed at the bottom."}
                </p>
              )}

              {items.map((s, i) => (
                <fieldset key={s.id} className="flex flex-col gap-3 rounded-lg border p-3">
                  <legend className="px-1 text-xs font-medium text-muted-foreground">Signatory {i + 1}</legend>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`sig-${s.id}-label`}>Label <span className="font-normal text-muted-foreground">(optional)</span></Label>
                    <Input id={`sig-${s.id}-label`} list="sig-labels" maxLength={255} value={s.label}
                      placeholder="e.g. Prepared by:" onChange={(e) => patch(s.id, { label: e.target.value })} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`sig-${s.id}-name`}>Name</Label>
                      <Input id={`sig-${s.id}-name`} list="sig-names" maxLength={255} value={s.name}
                        onChange={(e) => setName(s, e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`sig-${s.id}-pos`}>Position</Label>
                      <Input id={`sig-${s.id}-pos`} list="sig-positions" maxLength={255} value={s.position}
                        onChange={(e) => patch(s.id, { position: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <AlignPicker name={`sig-${s.id}-align`} value={s.align} onChange={(v) => patch(s.id, { align: v })} />
                    <label className="flex items-center gap-2 text-sm pointer-coarse:min-h-11">
                      <input type="checkbox" className="h-4 w-4 pointer-coarse:h-5 pointer-coarse:w-5" checked={s.dateLine}
                        onChange={(e) => patch(s.id, { dateLine: e.target.checked })} />
                      Date line
                    </label>
                    <span className="flex-1" />
                    <Button type="button" variant="ghost" size="icon-sm" className="pointer-coarse:size-11" aria-label="Move up"
                      disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" className="pointer-coarse:size-11" aria-label="Move down"
                      disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" className="text-destructive pointer-coarse:size-11"
                      aria-label="Delete signatory" onClick={() => setItems(items.filter((x) => x.id !== s.id))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </fieldset>
              ))}

              <Button type="button" variant="outline" className="pointer-coarse:h-11" onClick={add}>
                <Plus className="h-4 w-4" /> Add signatory
              </Button>
              <p className="text-xs text-muted-foreground">
                Signatories with the same alignment go to the next row. For example Left and Right make one row, then
                Center starts a new one.
              </p>
            </TabsContent>

            <TabsContent value="people" className="mt-4 flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                People you've used before. They're suggested while you type a name.
              </p>
              {p.people.length === 0 && <p className="text-sm text-muted-foreground">No saved people yet.</p>}
              {p.people.map((person, i) => (
                <div key={`${person.name}-${i}`} className="flex flex-col gap-2 rounded-lg border p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input aria-label="Name" maxLength={255} value={person.name}
                      onChange={(e) => p.onPeople(p.people.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
                    <Input aria-label="Position" list="sig-positions" maxLength={255} value={person.position}
                      onChange={(e) => p.onPeople(p.people.map((x, k) => (k === i ? { ...x, position: e.target.value } : x)))} />
                  </div>
                  <div className="flex items-center gap-2">
                    <AlignPicker name={`person-${i}-align`} value={person.align}
                      onChange={(v) => p.onPeople(p.people.map((x, k) => (k === i ? { ...x, align: v } : x)))} />
                    <span className="flex-1" />
                    <Button type="button" variant="ghost" size="icon-sm" className="text-destructive pointer-coarse:size-11"
                      aria-label={`Delete ${person.name}`} onClick={() => p.onPeople(p.people.filter((_, k) => k !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>

          <SheetFooter className="flex-row flex-wrap gap-2 border-t p-4">
            <Button type="button" variant="outline" className="pointer-coarse:h-11" onClick={doExport}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button type="button" variant="outline" className="pointer-coarse:h-11" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Import
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void doImport(file);
              }}
            />
            <span className="flex-1" />
            <Button type="button" className="pointer-coarse:h-11" onClick={() => p.onOpenChange(false)}>Done</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={imported !== null}
        title="Use the imported signatories for this report?"
        description={`The file has ${imported?.length ?? 0} ${imported?.length === 1 ? "signatory" : "signatories"}. This replaces this report's signatories on this device.`}
        confirmLabel="Replace"
        onConfirm={() => {
          if (imported) setItems(imported);
          setImported(null);
        }}
        onCancel={() => setImported(null)}
      />
    </>
  );
}
