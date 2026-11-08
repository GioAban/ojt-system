// Paghahati ng mga row sa mga pahina ayon sa sukat (hindi kailanman hinahati ang isang row).

export interface PageUnit {
  /** Pangkat (hal. isang HTE); magkakasunod na unit ng iisang pangkat ay iisang "segment" sa pahina */
  group: number;
  height: number;
  /** Heading ng pangkat: hindi iniiwang mag-isa sa dulo ng pahina */
  keepNext?: boolean;
}

/** Pinakamaliit na taas ng segment: kapag unang lumabas ang pangkat, at kapag karugtong sa susunod na pahina */
export interface GroupMin {
  first: number;
  cont: number;
}

export interface PagingInput {
  units: PageUnit[];
  groupMin: GroupMin[];
  /** Taas na magagamit ng mga row sa unang pahina (wala na ang pamagat at header ng table) */
  firstAvailable: number;
  /** Taas na magagamit sa mga susunod na pahina */
  nextAvailable: number;
  /** 0 = awtomatiko; kung hindi, pinakamaraming row bawat pahina */
  rowsPerPage: number;
  /** Taas ng pirmahan (laging sa huling pahina, buo) */
  signHeight: number;
  /**
   * Habang nagta-type: ang row na ito ay mananatili sa pahinang ito (para hindi mawala ang cursor).
   * Kung lumampas, hahaba muna ang pahina sa screen; aayos ito paglabas sa cell.
   */
  pin?: { unit: number; page: number } | null;
}

export interface PageSlice {
  start: number;
  /** hindi kasama */
  end: number;
  signatories: boolean;
  /** Lumampas sa taas ng papel dahil sa naka-pin na row (sa screen lang nangyayari) */
  overflow?: boolean;
}

/** Maliit na palugit para sa pagkakaiba ng pag-round ng browser */
const SAFETY = 6;

export function paginate({ units, groupMin, firstAvailable, nextAvailable, rowsPerPage, signHeight, pin }: PagingInput): PageSlice[] {
  const pages: PageSlice[] = [];
  const started = new Set<number>();
  let start = 0;
  let used = 0;
  let count = 0;
  let cap = firstAvailable - SAFETY;
  let segGroup = -1;
  let segSum = 0;
  let segMin = 0;

  const minFor = (g: number) => {
    const m = groupMin[g];
    if (!m) return 0;
    return started.has(g) ? m.cont : m.first;
  };

  const breakAt = (i: number) => {
    pages.push({ start, end: i, signatories: false, overflow: used > cap });
    start = i;
    used = 0;
    count = 0;
    cap = nextAvailable - SAFETY;
    segGroup = -1;
  };

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const pinned = pin && pin.unit === i;

    // Naka-pin pero nauna ang pahina (hal. may binurang row sa itaas): ilipat sa pahinang dati nitong kinalalagyan
    if (pinned && count > 0 && pages.length < pin.page) breakAt(i);

    let fresh = u.group !== segGroup;
    let min = fresh ? minFor(u.group) : segMin;
    let add = fresh ? Math.max(u.height, min) : Math.max(segSum + u.height, segMin) - Math.max(segSum, segMin);

    const next = u.keepNext ? (units[i + 1]?.height ?? 0) : 0;
    const tooTall = used + add + next > cap;
    const tooMany = rowsPerPage > 0 && count >= rowsPerPage;
    const keepHere = pinned && pages.length >= pin.page;
    if (count > 0 && (tooTall || tooMany) && !keepHere) {
      breakAt(i);
      fresh = true;
      min = minFor(u.group);
      add = Math.max(u.height, min);
    }

    if (fresh) {
      segGroup = u.group;
      segSum = u.height;
      segMin = min;
    } else {
      segSum += u.height;
    }
    used += add;
    count++;
    started.add(u.group);
  }
  pages.push({ start, end: units.length, signatories: false, overflow: used > cap });

  // Pirmahan: sa huling pahina kung kasya, kung hindi ay sa bagong pahina (hindi hinahati)
  const last = pages[pages.length - 1];
  if (signHeight > 0) {
    if (used + signHeight <= cap) last.signatories = true;
    else pages.push({ start: units.length, end: units.length, signatories: true });
  }
  return pages;
}
