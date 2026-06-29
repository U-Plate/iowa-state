/**
 * Descriptive info about one dining hall — the unit `storeMetadataInD1` writes.
 * Stored in the `metadata` table, which upserts on (`school`, `diningHall`).
 * Powers the app's hall list, map pins, and schedule display.
 */
export interface Metadata {
  /** The school code this hall belongs to. Must equal the school's `getSchoolCode()`. */
  school: string;
  /**
   * Display name of the dining hall, e.g. `"Earhart"`. MUST be the same string
   * used as {@link Menu.diningHall} for this hall — meals and metadata are
   * joined on it, so a slug/display-name mismatch strands one from the other.
   */
  diningHall: string;
  /** Street address shown in the app. Use `""` if unknown. */
  address: string;
  /** Latitude as a numeric string, e.g. `"40.4259"`. Must parse as a number for the map; use `""` if unknown. */
  latitude: string;
  /** Longitude as a numeric string, e.g. `"-86.9081"`. Must parse as a number for the map; use `""` if unknown. */
  longitude: string;
  /** Category label for the hall, e.g. `"Dining Halls"`. Free-form; `""` is acceptable. */
  type: string;
  /**
   * Weekly general operating schedule as a JSON string in the canonical generalSchedule
   * format — an object keyed by meal time, each mapping day names to hours:
   *
   * ```json
   * {
   *   "Breakfast": {
   *     "Sunday": { "Start": "08:00", "End": "10:00" },
   *     "Monday": null
   *   },
   *   "Lunch": null
   * }
   * ```
   *
   * A meal time maps to `null` when never served; a day maps to `null` when
   * closed. Do NOT store the raw API hours array here — convert it first. Use
   * `"{}"` if no schedule is available.
   *
   * Note: This will be the fallback if the mealtime doesn't have any hours, this will NOT be updated often
   */
  schedule: string;
}
