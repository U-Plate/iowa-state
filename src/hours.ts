// Turns ISU Dining's per-day hours windows into the canonical meal-time slots
// the backend reads ("Breakfast", "Brunch", "Lunch", "Late Lunch", "Dinner").
//
// The API publishes `hours[date]` as an array of windows like
//   { starthours: 1030, endhours: 1400, comment: "Lunch", all_day: false }
// where `comment` is the meal name for dining centers, a combined name
// ("Lunch/Dinner") for some venues, and empty for retail locations that are
// simply open all day. This module is pure (no I/O) so both the scraper and
// scripts/build-general-schedules.ts share one interpretation of the hours.

export const MEAL_TIMES = ["Breakfast", "Brunch", "Lunch", "Late Lunch", "Dinner"] as const;
export type MealTime = (typeof MEAL_TIMES)[number];

export interface ApiHoursWindow {
  day?: number;
  all_day?: boolean;
  starthours: number;
  endhours: number;
  comment?: string | null;
}

/** A meal-time slot in minutes since local midnight, plus the source windows it came from. */
export interface Slot {
  start: number;
  end: number;
  windows: Set<number>;
}

// Boundaries used to split windows that don't name a meal (all-day retail).
const BREAKFAST_END = 10 * 60 + 30; // 10:30
const LUNCH_END = 16 * 60; // 16:00
// A split piece shorter than this is folded into its neighbour, so a cafe that
// opens at 10:15 doesn't get a 15-minute "Breakfast" and one closing at
// 17:00 doesn't get a one-hour "Dinner".
const MIN_PIECE = 90;

/** HHMM number (e.g. 1030) -> minutes since midnight. */
export function hhmmToMinutes(n: number): number {
  return Math.floor(n / 100) * 60 + (n % 100);
}

/** Minutes since midnight -> "HH:MM" (wraps past midnight). */
export function minutesToHHMM(m: number): string {
  const wrapped = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

/** Maps a single meal name (from an hours comment or a menu name) onto a canonical meal time. */
export function canonicalMealName(name: string): MealTime | null {
  const n = name.trim().toLowerCase();
  if (n === "breakfast") return "Breakfast";
  if (n === "brunch") return "Brunch";
  if (n === "lunch") return "Lunch";
  if (n === "dinner") return "Dinner";
  // Iowa State's mid-afternoon window between lunch and dinner.
  if (n === "continuous service") return "Late Lunch";
  // The backend has no late-night slot; fold it into Dinner (extending its hours).
  if (n === "late night" || n === "after hours") return "Dinner";
  return null;
}

function splitByBoundaries(start: number, end: number): { meal: MealTime; start: number; end: number }[] {
  const periods: [MealTime, number, number][] = [
    ["Breakfast", -Infinity, BREAKFAST_END],
    ["Lunch", BREAKFAST_END, LUNCH_END],
    ["Dinner", LUNCH_END, Infinity],
  ];
  let pieces = periods
    .map(([meal, ps, pe]) => ({ meal, start: Math.max(start, ps), end: Math.min(end, pe) }))
    .filter((p) => p.end > p.start);
  const kept = pieces.filter((p) => p.end - p.start >= MIN_PIECE);
  pieces = kept.length > 0 ? kept : pieces.slice(0, 1);
  pieces[0].start = start;
  pieces[pieces.length - 1].end = end;
  // Close gaps left by dropped pieces.
  for (let i = 1; i < pieces.length; i++) pieces[i].start = pieces[i - 1].end;
  return pieces;
}

/**
 * Converts one day's hours windows into canonical meal-time slots.
 *
 * - Named windows map directly ("Late Night" extends Dinner, "Continuous
 *   Service" becomes Late Lunch).
 * - Combined names ("Lunch/Dinner") are split evenly, like Purdue's OTG halls.
 * - Unnamed windows (all-day retail) are split at 10:30 and 16:00.
 */
export function buildSlots(windows: ApiHoursWindow[] | undefined | null): Map<MealTime, Slot> {
  const slots = new Map<MealTime, Slot>();
  const add = (meal: MealTime, start: number, end: number, w: number) => {
    const cur = slots.get(meal);
    if (cur) {
      cur.start = Math.min(cur.start, start);
      cur.end = Math.max(cur.end, end);
      cur.windows.add(w);
    } else {
      slots.set(meal, { start, end, windows: new Set([w]) });
    }
  };

  (windows ?? []).forEach((win, w) => {
    let start = win.all_day ? 0 : hhmmToMinutes(Number(win.starthours));
    let end = win.all_day ? 1440 : hhmmToMinutes(Number(win.endhours));
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;
    if (end <= start) end += 1440; // closes after midnight
    if (end === start) return;

    const comment = String(win.comment ?? "").trim();
    const parts = comment
      .split("/")
      .map((p) => canonicalMealName(p))
      .filter((p): p is MealTime => p !== null);

    if (comment && parts.length === 1) {
      add(parts[0], start, end, w);
    } else if (parts.length > 1) {
      const span = (end - start) / parts.length;
      parts.forEach((meal, i) => add(meal, Math.round(start + span * i), Math.round(start + span * (i + 1)), w));
    } else {
      for (const p of splitByBoundaries(start, end)) add(p.meal, p.start, p.end, w);
    }
  });

  // Keep canonical order.
  return new Map(MEAL_TIMES.filter((m) => slots.has(m)).map((m) => [m, slots.get(m)!]));
}

/** Formats the UTC offset of `timeZone` on `date` (YYYY-MM-DD) as "-06:00". */
export function utcOffsetFor(date: string, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" });
  const name = fmt.formatToParts(new Date(`${date}T12:00:00Z`)).find((p) => p.type === "timeZoneName")?.value ?? "";
  const m = /GMT([+-]\d{2}):?(\d{2})?/.exec(name);
  return m ? `${m[1]}:${m[2] ?? "00"}` : "+00:00";
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Local minutes on `date` -> ISO string with the zone's offset, e.g. "2026-12-01T10:30:00-06:00". */
export function localIso(date: string, minutes: number, timeZone: string): string {
  const day = addDays(date, Math.floor(minutes / 1440));
  return `${day}T${minutesToHHMM(minutes)}:00${utcOffsetFor(day, timeZone)}`;
}
