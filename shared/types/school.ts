import { FoodItem } from "./foods";
import { MealItem } from "./meals";
import { Env } from "./env";

/**
 * The fully-parsed data for one dining hall returned by `pullRawData()`. This is
 * a read-only diagnostic snapshot of everything the school extracted for a hall,
 * before any of it is written to D1.
 */
export interface HallData {
  /** Display name of the hall (same value used as {@link Menu.diningHall}/{@link Metadata.diningHall}). */
  hall: string;
  /** Every food parsed for this hall, deduped by {@link FoodItem.id}. */
  foods: FoodItem[];
  /**
   * Menu items grouped by meal time. Keys are the capitalized meal-time names
   * (`"Breakfast"`, `"Lunch"`, ...) and values are the items served then.
   */
  meals: Record<string, MealItem[]>;
  /**
   * Operating hours per meal time. Keys match {@link HallData.meals}; each value
   * is a JSON string of `{ Start, End }` (see {@link Menu.mealTimeHours}).
   */
  mealTimeHours: Record<string, string>;
  /** Location and schedule info for the hall (see {@link Metadata} for field meanings). */
  metadata: {
    address: string;
    latitude: string;
    longitude: string;
    schedule: string;
  };
}

/**
 * Per-hall outcome of `pullRawData()`. Each hall either succeeds (`ok: true`,
 * carrying its {@link HallData}) or fails in isolation (`ok: false` with an
 * `error` message) — one bad hall must never reject the whole batch.
 */
export type HallResult = ({ ok: true } & HallData) | { ok: false; hall: string; error: string };

export abstract class School {
  private schoolCode: string;
  private diningHalls: string[];
  private govCode: number;

  constructor(schoolCode: string, diningHalls: string[], govCode: number) {
    this.schoolCode = schoolCode;
    this.diningHalls = diningHalls;
    this.govCode = govCode;
  }

  protected dateFromOffset(dateOffset: number, timeZone: string): string {
    const now = new Date();
    now.setTime(now.getTime() + dateOffset * 24 * 60 * 60 * 1000);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone,
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
    const parts = formatter.formatToParts(now);
    const month = parts.find((p) => p.type === "month")?.value ?? "01";
    const day = parts.find((p) => p.type === "day")?.value ?? "01";
    const year = parts.find((p) => p.type === "year")?.value ?? "1970";
    return `${year}-${month}-${day}`;
  }

  public getSchoolCode() {
    return this.schoolCode;
  }

  public getGovCode() {
    return this.govCode;
  }

  getDiningHalls() {
    return this.diningHalls;
  }

  toString() {
    return this.schoolCode;
  }

  abstract pullRawData(date: string): Promise<HallResult[]>;

  // Production ingest entry point: the backend cron trigger and the
  // ?fetchMenus admin route call this directly. Every school must implement it.
  abstract processMenus(env: Env, dateOffset: number, isRecursive?: boolean): Promise<boolean[][]>;

  async fetchMetadata(_env: Env): Promise<void> {}

  // Called by the backend's ?fetchSodas admin route on every school; schools
  // without static drink items can rely on this default no-op.
  async addSodasIfMissing(_env: Env): Promise<void> {}
}
