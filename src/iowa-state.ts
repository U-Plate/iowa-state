export { IowaState };
import { storeFoodsInD1, storeMealsInD1, storeMetadataInD1 } from "@uplate/d1/index";
import { School, HallResult, HallData } from "@uplate/types/school";
import generalSchedules from "./generalSchedules.json";
import { Env } from "@uplate/types/env";
import { FoodItem } from "@uplate/types/foods";
import { MealItem } from "@uplate/types/meals";
import { Menu } from "@uplate/types/menu";

// ---------------------------------------------------------------------------
// Fill these in for your school. This is the ONLY block most schools need to
// edit besides fetchAndParseHall() and parseItem() below.
// ---------------------------------------------------------------------------

// Your school's code. Lowercase, no spaces. Used as the key for everything this
// school stores and must equal what the backend registers it under.
// ex: "purdue"
const SCHOOL_ID = "iowa-state";

// Your school's College Scorecard "id" (a.k.a. gov code). Look it up at
// https://collegescorecard.ed.gov — used to attach official school info.
// ex: 243780
const SCHOOL_GOV_CODE = 153603;

// IANA timezone the dining halls operate in, e.g. "America/New_York".
const TIME_ZONE = "America/Chicago";

// Meal times your school serves. "Brunch" and "Late Lunch" are also supported,
// but most schools only offer the big three. These strings are the storage keys
// and must match what fetchAndParseHall() returns in `meals`/`mealTimeHours`.
const MEAL_TIMES = ["Breakfast", "Brunch", "Lunch", "Dinner", "Late Night"];

// Display names of your dining halls. Must match the names used in metadata and
// in src/generalSchedules.json so meals and metadata join correctly.
//
// If your school uses slugs like "example-dining-hall", make sure to create a
// separate array for those and deal with them yourself,
// as UPlate's backend exclusively uses display names
const DINING_HALLS = ["Example Dining Hall"];

class IowaState extends School {
  constructor() {
    super(SCHOOL_ID, DINING_HALLS, SCHOOL_GOV_CODE);
  }

  // required, this function probably shouldn't be changed unless needed
  async processMenus(env: Env, dateOffset: number, isRecursive = false): Promise<boolean[][]> {
    const date = this.dateFromOffset(dateOffset, TIME_ZONE);
    let futures = DINING_HALLS.map(async (hall) => {
      const raw = await this.fetchAndParseHall(hall, date);
      return this.processAndStoreDiningCourtMenuData(env, hall, date, raw);
    });
    let responses = await Promise.all(futures);
    if (isRecursive) {
      console.log("Performing recursive fetch for next 2 days");
      for (const extra of [1, 2]) {
        const nextDate = this.dateFromOffset(dateOffset + extra, TIME_ZONE);
        const next = await Promise.all(
          DINING_HALLS.map(async (hall) => {
            const raw = await this.fetchAndParseHall(hall, nextDate);
            return this.processAndStoreDiningCourtMenuData(env, hall, nextDate, raw);
          }),
        );
        responses.push(...next);
      }
    }
    return responses;
  }

  // required, again, probably shouldn't be changed if not needed
  async processAndStoreDiningCourtMenuData(env: Env, loc: string, date: string, hallData: HallData) {
    console.log(`Processing menu data for ${loc} on ${date}`);

    // hallData comes pre-parsed from fetchAndParseHall: foods extracted and meal
    // items grouped per meal time.
    const { foods, meals, mealTimeHours } = hallData;

    if (foods.length > 0) {
      await storeFoodsInD1(env.DB, foods, SCHOOL_ID);
      console.log(`Stored ${foods.length} food items for ${loc}.`);
    }

    console.log(`Storing meal data for ${loc} on ${date} in D1.`);

    const updated = await Promise.all(
      MEAL_TIMES.map((mealTime) => {
        const menu: Menu = {
          diningHall: loc,
          date: date,
          meals: meals[mealTime] ?? [],
          school: SCHOOL_ID,
          mealTime: mealTime,
          mealTimeHours: mealTimeHours[mealTime] ?? "{}",
        };
        return storeMealsInD1(env, menu);
      }),
    );

    return updated;
  }

  /**
   * Map one item from your source API into a {@link FoodItem}.
   *
   * `id` must be the same string every run for the same food (the foods table
   * upserts on it and meal entries point back to it). Omit any nutrition field
   * the source doesn't provide — the storage layer fills in a "missing"
   * sentinel. Do NOT store 0 for an unknown value. See shared/types/foods.ts
   * for units and full field docs.
   *
   * The example below assumes a generic `{ name, calories, ... }` shape; adapt
   * the field names to match whatever your API returns.
   */
  parseItem(sourceItem: Record<string, any>, id: string): FoodItem | null {
    if (!sourceItem || !sourceItem.name) return null;

    const food: FoodItem = { id, name: sourceItem.name };

    // TODO: map your source's nutrition fields onto `food`. Examples:
    // food.calories = sourceItem.calories;
    // food.protein = sourceItem.protein;
    // food.carbs = sourceItem.totalCarbohydrate;
    // food.totalFat = sourceItem.totalFat;
    // food.servingSize = sourceItem.servingSize;

    // Ingredients as a single plain string (not JSON).
    food.ingredients = sourceItem.ingredients || "";

    // Allergens/traits as a JSON-encoded array of strings, e.g. '["Vegan"]'.
    const labels: string[] = (sourceItem.traits || []).map((t: any) => t.name ?? t);
    food.labels = JSON.stringify(labels);

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

    // Parses a time number in the format HHMM into a string in the format "HH:MM".
    private parseTimeNumber(time: number): string {
        let hours = Math.floor(time / 100);
        let minutes = time % 100;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

  /**
   * Fetch one hall's menu for one date from your source and return it in the
   * shape the rest of this class expects ({@link HallData}). This is the heart
   * of a school integration — almost all school-specific logic lives here.
   *
   * You must produce:
   *   - foods:          every distinct FoodItem served, deduped by id.
   *   - meals:          MealItem[] per meal time, keyed by the MEAL_TIMES names.
   *                     Each entry is { id, station } where id matches a food.
   *   - mealTimeHours:  per meal time, a JSON string {"Start": ISO, "End": ISO}.
   *   - metadata:       address / coordinates / schedule for the hall.
   */
  private async fetchAndParseHall(loc: string, date: string): Promise<HallData> {
    // 1) Fetch your school's menu for this hall + date.
    //
    // TODO: call your source API. For example:
    //   const resp = await fetch(`https://dining.example.edu/menu?hall=${loc}&date=${date}`);
    //   if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    //   const json = await resp.json();
    //
    // Throw on failure — pullRawData()/processMenus() handle each hall in
      // isolation, so one bad hall won't take down the rest.
	const url = `https://dining.iastate.edu/api/venue/${loc}/menu/${date}`;
	const options = { method: 'GET' };

	let rawData: any;
	try {
		const response = await fetch(url, options);
		const data = await response.json();
		rawData = data; // Store the raw data for later processing
	} catch (error) {
        throw new Error(error.message);
	}

    // Deserialize the raw data into a usable object.
    let deserializedData = JSON.parse(rawData);

    // Extract the raw meals from the deserialized data.
    const rawMeals: any[] = deserializedData.meals.values(); 

    const meals: Record<string, MealItem[]> = {};
    const mealTimeHours: Record<string, string> = {};
    const foodItemsMap = new Map<string, any>();

    // 2) Walk the source menu, grouping items by meal time and collecting the
    //    distinct foods to store. Adapt the field access to your API's shape.

    let rawMealTimeHours = deserializedData.hours[date];
    for (const mealTime of rawMealTimeHours) {
        mealTimeHours[mealTime.comment] = JSON.stringify({ Start: this.parseTimeNumber(mealTime.starthours), End: this.parseTimeNumber(mealTime.endhours) });
    }

    for (const meal of rawMeals) {
      const mealName: string = meal.meal;
      if (!MEAL_TIMES.includes(mealName)) continue;

      meals[mealName] ??= [];

      let stations = meal.menu_displays.values();
      for (const station of stations ?? []) {
        for (const item of station.items ?? []) {
          const id = String(item.id);
          meals[mealName].push({ id, station: station.name });
          if (!foodItemsMap.has(id)) foodItemsMap.set(id, item);
        }
      }
    }

    // 3) Dedupe meal items on the id|station key the storage layer merges on.
    for (const mealName in meals) {
      const seen = new Map<string, MealItem>();
      for (const item of meals[mealName]) {
        const k = `${item.id}|${item.station}`;
        if (!seen.has(k)) seen.set(k, item);
      }
      meals[mealName] = Array.from(seen.values());
    }

    // 4) Turn the collected source items into FoodItems.
    const foods: FoodItem[] = [];
    for (const [id, item] of foodItemsMap) {
      const parsed = this.parseItem(item, id);
      if (parsed) foods.push(parsed);
    }

    // 5) Hall metadata. Pull address/coordinates from your API if available;
    //    fall back to the hand-maintained schedule in generalSchedules.json.
    const metadata = {
      address: "", // TODO
      latitude: "", // TODO
      longitude: "", // TODO
      schedule: JSON.stringify((generalSchedules as Record<string, any>)[loc] ?? {}),
    };

    return { hall: loc, foods, meals, mealTimeHours, metadata };
  }

  async fetchMetadata(env: Env): Promise<void> {
    await Promise.all(
      DINING_HALLS.map(async (hall) => {
        // TODO: fetch address / coordinates for the hall if your API exposes
        // them. The schedule comes from the hand-maintained generalSchedules.json.
        const address = "";
        const latitude = "";
        const longitude = "";
        const schedule = JSON.stringify((generalSchedules as Record<string, any>)[hall] ?? {});

        await storeMetadataInD1(env.DB, {
          school: SCHOOL_ID,
          diningHall: hall,
          address,
          latitude,
          longitude,
          type: "",
          schedule,
        });
      }),
    );
  }
}
