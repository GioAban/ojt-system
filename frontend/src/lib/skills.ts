// Skills: iisang tuntunin ng pagtutugma sa server at sa browser (walang AI).
// Key: maliliit na titik, walang espasyo, tuldok, gitling at underscore; nananatili ang + at # (C, C++ at C# ay magkaiba).

export const SKILL_MAX_LENGTH = 40;

/** Pangalang ipapakita: trim at iisang espasyo */
export const skillDisplay = (raw: string) => raw.trim().replace(/\s+/g, " ");

/** "React JS", "ReactJS", "react.js" -> "reactjs" */
export const skillKey = (raw: string) => skillDisplay(raw).toLowerCase().replace(/[\s._-]+/g, "");

/** Walang dobleng skill ayon sa key; ang unang pagkakasulat ang nananatili */
export function uniqueSkills(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const name = skillDisplay(raw);
    const key = skillKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export interface SkillMatch<T> {
  item: T;
  matched: string[];
  others: string[];
  /** Ilan sa skills ng company ang mayroon ang student */
  count: number;
  /** count / lahat ng skills ng company */
  ratio: number;
}

/**
 * Pagraranggo: dami ng tugmang skill, saka porsiyento ng skills ng company na mayroon ang student,
 * saka bakanteng slots, saka pangalan.
 */
export function rankBySkills<T>(
  items: T[],
  studentSkills: string[],
  skillsOf: (item: T) => string[],
  slotsOf: (item: T) => number,
  nameOf: (item: T) => string,
): SkillMatch<T>[] {
  const mine = new Set(studentSkills.map(skillKey));
  return items
    .map((item) => {
      const skills = skillsOf(item);
      const matched = skills.filter((s) => mine.has(skillKey(s)));
      const others = skills.filter((s) => !mine.has(skillKey(s)));
      return { item, matched, others, count: matched.length, ratio: skills.length ? matched.length / skills.length : 0 };
    })
    .sort((a, b) => b.count - a.count || b.ratio - a.ratio || slotsOf(b.item) - slotsOf(a.item)
      || nameOf(a.item).localeCompare(nameOf(b.item)));
}
