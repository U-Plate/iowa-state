import { MealItem } from "./meals";

/**
 * One dining hall's menu for a single meal time on a single date — the unit
 * `storeMealsInD1` writes. Build one of these per (hall × date × meal time) and
 * pass it to `storeMealsInD1(env, menu)`.
 *
 * The `meals` table is append-only version history keyed on
 * (`diningHall`, `date`, `mealTime`); a new version is written only when the
 * item set actually changes, so the same input two runs in a row is a no-op.
 */
export interface Menu {
  /**
   * Display name of the dining hall, e.g. `"Earhart"`. This is the user-facing
   * name, NOT a URL slug, and it MUST match the `diningHall` used in the hall's
   * {@link Metadata} row — meals and metadata are joined on this string.
   */
  diningHall: string;
  /** Calendar date of the menu, formatted `YYYY-MM-DD`. The read path and cache keys assume this format. */
  date: string;
  /** The items served at this hall for this meal time. May be empty (the hall is closed/has no menu). */
  meals: MealItem[];
  /** The school code this menu belongs to. Must equal the school's `getSchoolCode()`. */
  school: string;
  /**
   * The meal time, capitalized: `"Breakfast"`, `"Lunch"`, `"Dinner"`, etc.
   * Used as part of the storage key, so be consistent run-to-run.
   */
  mealTime: string;
  /**
   * Operating hours for this meal time as a JSON string of `{ Start, End }`,
   * where Start/End are `Date`-parseable timestamps (ISO 8601 with offset, e.g.
   * `'{"Start":"2026-06-28T08:00-04:00","End":"2026-06-28T10:00-04:00"}'`).
   * Use `"{}"` when hours are unknown.
   */
  mealTimeHours: string;
}
