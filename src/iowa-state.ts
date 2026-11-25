export { IowaState, VENUE_IDS };
import { storeFoodsInD1, storeMealsInD1, storeMetadataInD1 } from "@uplate/d1/index";
import { School, HallResult, HallData } from "@uplate/types/school";
import { Env } from "@uplate/types/env";
import { FoodItem } from "@uplate/types/foods";
import { MealItem } from "@uplate/types/meals";
import { Menu } from "@uplate/types/menu";
import { Metadata } from "@uplate/types/metadata";
import generalSchedules from "./generalSchedules.json";
import { ApiHoursWindow, MEAL_TIMES, MealTime, Slot, buildSlots, canonicalMealName, localIso } from "./hours";

const SCHOOL_ID = "iowa-state";
// College Scorecard id for Iowa State University.
const SCHOOL_GOV_CODE = 153603;
const TIME_ZONE = "America/Chicago";
const API_BASE = "https://dining.iastate.edu/api/venue";
const USER_AGENT = "BoilerFuel-Worker/1.0";

interface HallInfo {
  /** ISU Dining venue id used by /api/venue/{id}/menu/{date}. */
  venueId: number;
  address: string;
  latitude: string;
  longitude: string;
  type: "Dining Halls" | "Retail";
}

// Hand-maintained from each location page on dining.iastate.edu/locations
// (address + the page's map pin). Venues inside the same building share the
// building's address and coordinates. The Special Diet Kitchen has no location
// page; it is part of Union Drive Marketplace.
const MEMORIAL_UNION = { address: "2229 Lincoln Way, Ames, IA 50014", latitude: "42.0235144", longitude: "-93.6456354" };
const UNION_DRIVE = { address: "207 Beyer Ct, Ames, IA 50012", latitude: "42.0249565", longitude: "-93.6515007" };
const MWL_COMMONS = { address: "224 Beach Rd, Ames, IA 50013", latitude: "42.0238084", longitude: "-93.6382529" };
const HUB = { address: "605 Morrill Rd, Ames, IA 50011", latitude: "42.0272385", longitude: "-93.6484556" };
const STATE_GYM = { address: "2642 Union Dr, Ames, IA 50011", latitude: "42.0246748", longitude: "-93.6538021" };

const HALLS: Record<string, HallInfo> = {
  Conversations: {
    venueId: 1,
    type: "Dining Halls",
    address: "455 Richardson Ct, Ames, IA 50013",
    latitude: "42.0251392",
    longitude: "-93.6403311",
  },
  "Friley Windows": {
    venueId: 30,
    type: "Dining Halls",
    address: "212 Beyer Ct, Ames, IA 50012",
    latitude: "42.0239234",
    longitude: "-93.65045",
  },
  "Richardson Court Marketplace": { venueId: 23, type: "Dining Halls", ...MWL_COMMONS },
  "Union Drive Marketplace": { venueId: 39, type: "Dining Halls", ...UNION_DRIVE },
  "Special Diet Kitchen": { venueId: 61, type: "Dining Halls", ...UNION_DRIVE },
  "South Side Eats": {
    venueId: 60,
    type: "Dining Halls",
    address: "926 Hayward Ave, Ames, IA 50013",
    latitude: "42.0140269",
    longitude: "-93.6508287",
  },
  Hawthorn: {
    venueId: 8,
    type: "Retail",
    address: "2129 Hawthorn Court Dr, Ames, IA 50011",
    latitude: "42.0339213",
    longitude: "-93.6429145",
  },
  "Memorial Union Food Court": { venueId: 11, type: "Retail", ...MEMORIAL_UNION },
  "Charging Station": { venueId: 10, type: "Retail", ...MEMORIAL_UNION },
  "Lance and Ellie's": { venueId: 19, type: "Retail", ...MEMORIAL_UNION },
  "Lance and Ellie's Express": { venueId: 20, type: "Retail", ...MEMORIAL_UNION },
  "The Roasterie": { venueId: 21, type: "Retail", ...HUB },
  "Heaping Plato": { venueId: 22, type: "Retail", ...HUB },
  "Clyde's": { venueId: 38, type: "Retail", ...UNION_DRIVE },
  "West Side Market": { venueId: 56, type: "Retail", ...UNION_DRIVE },
  "West Side Market Express": { venueId: 57, type: "Retail", ...UNION_DRIVE },
  "East Side Market": { venueId: 58, type: "Retail", ...MWL_COMMONS },
  "East Side Market Express": { venueId: 59, type: "Retail", ...MWL_COMMONS },
  "Bookends Cafe": {
    venueId: 48,
    type: "Retail",
    address: "701 Morrill Rd, Ames, IA 50011",
    latitude: "42.0281648",
    longitude: "-93.6487947",
  },
  "Business Cafe": {
    venueId: 49,
    type: "Retail",
    address: "2167 Union Dr, Ames, IA 50011",
    latitude: "42.0254011",
    longitude: "-93.6444688",
  },
  "Courtyard Cafe": {
    venueId: 50,
    type: "Retail",
    address: "901 Stange Rd, Ames, IA 50011",
    latitude: "42.0297367",
    longitude: "-93.6456391",
  },
  "Design Cafe": {
    venueId: 51,
    type: "Retail",
    address: "715 Bissell Rd, Ames, IA 50011",
    latitude: "42.0285641",
    longitude: "-93.6531506",
  },
  "Gentle Doctor Cafe": {
    venueId: 52,
    type: "Retail",
    address: "1800 Christensen Dr, Ames, IA 50011",
    latitude: "42.0067073",
    longitude: "-93.6323694",
  },
  "Whirlybird's": { venueId: 54, type: "Retail", ...STATE_GYM },
  "Whirlybird's Express": { venueId: 55, type: "Retail", ...STATE_GYM },
};

const DINING_HALLS = Object.keys(HALLS);
const VENUE_IDS: Record<string, number> = Object.fromEntries(DINING_HALLS.map((h) => [h, HALLS[h].venueId]));

// When a named menu's own meal time isn't open that day, try these instead
// (e.g. a "Lunch" menu at a hall that only runs Brunch on weekends).
const MENU_FALLBACKS: Record<MealTime, MealTime[]> = {
  Breakfast: ["Brunch"],
  Brunch: ["Breakfast", "Lunch"],
  Lunch: ["Brunch", "Late Lunch"],
  "Late Lunch": ["Lunch"],
  Dinner: [],
};

interface ApiMenuResponse {
  hours?: Record<string, ApiHoursWindow[]>;
  meals?: Record<string, ApiMeal> | ApiMeal[];
}
interface ApiMeal {
  meal: string;
  menu_displays?: Record<string, ApiStation> | ApiStation[];
}
interface ApiStation {
  name: string;
  categories?: Record<string, ApiCategory> | ApiCategory[];
}
interface ApiCategory {
  name: string;
  items?: Record<string, ApiItem> | ApiItem[];
}
type ApiItem = Record<string, any>;

// Bars are published as "-- Salad Bar --"; show them as "Salad Bar".
const cleanName = (name: unknown): string =>
  String(name ?? "")
    .replace(/^[\s-]+|[\s-]+$/g, "")
    .trim();
// Some menus carry a notice as a fake item, e.g.
// "*Nutritional Info not available online; Please ask a staff member for details."
const isDisclaimer = (name: unknown): boolean =>
  /nutritional info not available|please ask a staff member/i.test(String(name ?? ""));

const values = <T>(o: Record<string, T> | T[] | null | undefined): T[] => (o ? Object.values(o) : []);

class IowaState extends School {
  constructor() {
    super(SCHOOL_ID, DINING_HALLS, SCHOOL_GOV_CODE);
  }

  /**
   * Scrapes and stores every hall for one date. Halls are isolated from each
   * other: one that throws is logged and skipped instead of rejecting the batch.
   */
  private async processDate(env: Env, date: string): Promise<boolean[][]> {
    const settled = await Promise.allSettled(
      DINING_HALLS.map(async (hall) => {
        const raw = await this.fetchAndParseHall(hall, date);
        return this.processAndStoreDiningCourtMenuData(env, hall, date, raw);
      }),
    );
    return settled.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      console.error(`Failed to process ${DINING_HALLS[i]} on ${date}:`, r.reason);
      return [];
    });
  }

  async processMenus(env: Env, dateOffset: number, isRecursive = false): Promise<boolean[][]> {
    const date = this.dateFromOffset(dateOffset, TIME_ZONE);
    const responses = await this.processDate(env, date);
    if (isRecursive) {
      console.log("Performing recursive fetch for next 2 days");
      for (const extra of [1, 2]) {
        responses.push(...(await this.processDate(env, this.dateFromOffset(dateOffset + extra, TIME_ZONE))));
      }
    }
    return responses;
  }

  async processAndStoreDiningCourtMenuData(env: Env, loc: string, date: string, hallData: HallData) {
    console.log(`Processing menu data for ${loc} on ${date}`);
    const { foods, meals, mealTimeHours } = hallData;

    if (foods.length > 0) {
      await storeFoodsInD1(env.DB, foods, SCHOOL_ID);
      console.log(`Stored ${foods.length} food items for ${loc}.`);
    }

    return Promise.all(
      MEAL_TIMES.map((mealTime) => {
        const menu: Menu = {
          diningHall: loc,
          date,
          meals: meals[mealTime] ?? [],
          school: SCHOOL_ID,
          mealTime,
          mealTimeHours: mealTimeHours[mealTime] ?? "{}",
        };
        return storeMealsInD1(env, menu);
      }),
    );
  }

  /**
   * Content-derived food id. ISU's `id`/`oid` change every day and differ per
   * venue for the same recipe, so they can't be used: the foods table would
   * gain a duplicate row for every item on every scrape. Hashing only what
   * the user sees (name, portion, ingredients, nutrition, labels) keeps the id
   * stable across days and shares one row between venues serving the same item.
   */
  foodId(item: ApiItem): string {
    const nutrients = Object.entries(item.nutrients ?? {})
      .map(([k, v]: [string, any]) => `${k}=${v?.quantity ?? ""}`)
      .sort();
    const key = JSON.stringify([
      cleanName(item.name),
      item.unit_of_measure_name ?? "",
      item.ingredients ?? "",
      nutrients,
      this.labelsFor(item),
    ]);
    // cyrb53: 53-bit hash, plenty of headroom against collisions at this scale.
    let h1 = 0xdeadbeef,
      h2 = 0x41c6ce57;
    for (let i = 0; i < key.length; i++) {
      const ch = key.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  private labelsFor(item: ApiItem): string[] {
    const traits = item.traits ?? {};
    const names = [...values<any>(traits.allergen), ...values<any>(traits.requirement)]
      .map((t) => String(t?.name ?? t ?? "").trim())
      .filter((n) => n.length > 0);
    return [...new Set(names)].sort();
  }

  /** Maps one ISU menu item onto a {@link FoodItem}. Missing nutrients are omitted, never 0. */
  parseItem(item: ApiItem, id: string): FoodItem | null {
    if (!item?.name) return null;
    const n = item.nutrients ?? {};
    const num = (key: string): number | undefined => {
      const raw = n[key]?.quantity;
      if (raw === null || raw === undefined || raw === "") return undefined;
      const v = Number(raw);
      return Number.isFinite(v) ? v : undefined;
    };

    const food: FoodItem = { id, name: cleanName(item.name) };
    const set = <K extends keyof FoodItem>(k: K, v: FoodItem[K] | undefined) => {
      if (v !== undefined) food[k] = v;
    };
    set("calories", num("kcal"));
    set("protein", num("pro"));
    set("carbs", num("cho"));
    set("totalFat", num("fat"));
    set("saturatedFat", num("sfa"));
    set("cholesterol", num("chol"));
    set("sodium", num("na"));
    set("sugar", num("sugar"));
    set("addedSugars", num("addsgr"));
    set("dietaryFiber", num("fibtg"));
    set("calcium", num("ca"));
    set("iron", num("fe"));
    if (item.unit_of_measure_name) food.servingSize = String(item.unit_of_measure_name);
    food.ingredients = String(item.ingredients ?? "").trim();
    food.labels = JSON.stringify(this.labelsFor(item));
    return food;
  }

  async pullRawData(date: string): Promise<HallResult[]> {
    const results = await Promise.allSettled(DINING_HALLS.map((hall) => this.fetchAndParseHall(hall, date)));
    return results.map((r, i) =>
      r.status === "fulfilled"
        ? { ok: true as const, ...r.value }
        : { ok: false as const, hall: DINING_HALLS[i], error: String(r.reason) },
    );
  }

  /** Which open meal-time slots a menu's items belong to. */
  private targetsForMenu(menuName: string, slots: Map<MealTime, Slot>, hasBreakfastMenu: boolean): MealTime[] {
    const named = canonicalMealName(menuName);
    if (!named) {
      // "Daily Menu", "Grab and Go", "Bakery Menu", "Deli", ... are served
      // whenever the venue is open -- except that a venue publishing its own
      // Breakfast menu (Hawthorn, Clyde's) runs the "Daily Menu" grill only
      // after breakfast.
      if (slots.size === 0) return ["Lunch"];
      const all = [...slots.keys()];
      const lunchOnwards = all.filter((m) => m !== "Breakfast");
      return hasBreakfastMenu && /daily/i.test(menuName) && lunchOnwards.length > 0 ? lunchOnwards : all;
    }
    if (slots.size === 0 || slots.has(named)) return [named];
    const fallback = MENU_FALLBACKS[named].find((m) => slots.has(m));
    return fallback ? [fallback] : [];
  }

  private async fetchAndParseHall(loc: string, date: string): Promise<HallData> {
    const info = HALLS[loc];
    if (!info) throw new Error(`Unknown hall "${loc}"`);

    const resp = await fetch(`${API_BASE}/${info.venueId}/menu/${date}`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    const data = (await resp.json()) as ApiMenuResponse;

    const slots = buildSlots(data?.hours?.[date]);
    const meals: Record<string, MealItem[]> = {};
    const foodItemsMap = new Map<string, ApiItem>();

    const rawMeals = values(data?.meals);
    const hasBreakfastMenu = rawMeals.some((m) => canonicalMealName(String(m?.meal ?? "")) === "Breakfast");
    for (const meal of rawMeals) {
      const targets = this.targetsForMenu(String(meal?.meal ?? ""), slots, hasBreakfastMenu);
      if (targets.length === 0) continue;
      for (const station of values(meal.menu_displays)) {
        for (const category of values(station?.categories)) {
          // Retail venues name their single station after themselves; the
          // category ("Bagels", "Salads") is the useful grouping there.
          const stationName =
            station?.name && station.name !== loc ? String(station.name) : String(category?.name ?? station?.name ?? loc);
          for (const item of values(category?.items)) {
            if (!cleanName(item?.name) || isDisclaimer(item.name)) continue;
            const id = this.foodId(item);
            if (!foodItemsMap.has(id)) foodItemsMap.set(id, item);
            for (const t of targets) (meals[t] ??= []).push({ id, station: stationName });
          }
        }
      }
    }

    // Slots with hours but no menu of their own inherit from a slot carved
    // out of the same hours window (e.g. the 09:00-10:30 piece of an all-day
    // window), and Late Lunch ("Continuous Service") serves the lunch line.
    for (const [mealTime, slot] of slots) {
      if (meals[mealTime]?.length) continue;
      const donor =
        mealTime === "Late Lunch" && meals["Lunch"]?.length
          ? "Lunch"
          : [...slots.entries()].find(
              ([m, s]) => m !== mealTime && meals[m]?.length && [...s.windows].some((w) => slot.windows.has(w)),
            )?.[0];
      if (donor) meals[mealTime] = [...meals[donor]];
    }

    // Dedupe on the id|station key the storage layer merges on.
    for (const mealName in meals) {
      const seen = new Map<string, MealItem>();
      for (const item of meals[mealName]) {
        const k = `${item.id}|${item.station}`;
        if (!seen.has(k)) seen.set(k, item);
      }
      meals[mealName] = [...seen.values()];
    }

    const mealTimeHours: Record<string, string> = {};
    for (const [mealTime, slot] of slots) {
      mealTimeHours[mealTime] = JSON.stringify({
        Start: localIso(date, slot.start, TIME_ZONE),
        End: localIso(date, slot.end, TIME_ZONE),
      });
    }

    const foods: FoodItem[] = [];
    for (const [id, item] of foodItemsMap) {
      const parsed = this.parseItem(item, id);
      if (parsed) foods.push(parsed);
    }

    const metadata = {
      address: info.address,
      latitude: info.latitude,
      longitude: info.longitude,
      schedule: this.scheduleFor(loc),
    };

    return { hall: loc, foods, meals, mealTimeHours, metadata };
  }

  private scheduleFor(hall: string): string {
    return JSON.stringify((generalSchedules as Record<string, unknown>)[hall] ?? {});
  }

  async fetchMetadata(env: Env): Promise<void> {
    await Promise.allSettled(
      DINING_HALLS.map(async (hall) => {
        const info = HALLS[hall];
        const metadata: Metadata = {
          school: SCHOOL_ID,
          diningHall: hall,
          address: info.address,
          latitude: info.latitude,
          longitude: info.longitude,
          type: info.type,
          schedule: this.scheduleFor(hall),
        };
        await storeMetadataInD1(env.DB, metadata);
      }),
    );
  }
}
