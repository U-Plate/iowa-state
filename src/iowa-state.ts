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
const DINING_HALLS = [
  "Conversations",
  "Hawthorn",
  "Charging Station",
  "Memorial Union Food Court",
  "Lance and Ellie's",
  "Lance and Ellie's Express",
  "The Roasterie",
  "Heaping Plato",
  "Richardson Court Marketplace",
  "Friley Windows",
  "Clyde's",
  "Union Drive Marketplace",
  "Bookends Cafe",
  "Business Cafe",
  "Courtyard Cafe",
  "Design Cafe",
  "Gentle Doctor Cafe",
  "Whirlybird's",
  "Whirlybird's Express",
  "West Side Market",
  "West Side Market Express",
  "East Side Market",
  "East Side Market Express",
  "South Side Eats",
  "Special Diet Kitchen",
];

const diningHallIds: Record<string, number> = {
  Conversations: 1,
  Hawthorn: 8,
  "Charging Station": 10,
  "Memorial Union Food Court": 11,
  "Lance and Ellie's": 19,
  "Lance and Ellie's Express": 20,
  "The Roasterie": 21,
  "Heaping Plato": 22,
  "Richardson Court Marketplace": 23,
  "Friley Windows": 30,
  "Clyde's": 38,
  "Union Drive Marketplace": 39,
  "Bookends Cafe": 48,
  "Business Cafe": 49,
  "Courtyard Cafe": 50,
  "Design Cafe": 51,
  "Gentle Doctor Cafe": 52,
  "Whirlybird's": 54,
  "Whirlybird's Express": 55,
  "West Side Market": 56,
  "West Side Market Express": 57,
  "East Side Market": 58,
  "East Side Market Express": 59,
  "South Side Eats": 60,
  "Special Diet Kitchen": 61,
};

class IowaState extends School {
  constructor() {
    super(SCHOOL_ID, DINING_HALLS, SCHOOL_GOV_CODE);
  }

  // required, this function probably shouldn't be changed unless needed
  async processMenus(env: Env, dateOffset: number, isRecursive = false): Promise<boolean[][]> {
    const date = this.dateFromOffset(dateOffset, TIME_ZONE);
    const futures = DINING_HALLS.map(async (hall) => {
      const raw = await this.fetchAndParseHall(hall, date);
      return this.processAndStoreDiningCourtMenuData(env, hall, date, raw);
    });
    const responses = await Promise.all(futures);
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

    const sourceNutrition = sourceItem.nutrients || {};

    // map your source's nutrition fields onto `food`.
    food.calories = sourceNutrition.kcal?.quantity ?? null;
    food.protein = sourceNutrition.pro?.quantity ?? null;
    food.carbs = sourceNutrition.cho?.quantity ?? null;
    food.totalFat = sourceNutrition.fat?.quantity ?? null;
    food.servingSize = sourceItem.unit_of_measure_name ?? null;
    food.cholesterol = sourceNutrition.chol?.quantity ?? null;
    food.sodium = sourceNutrition.na?.quantity ?? null;
    food.sugar = sourceNutrition.sugar?.quantity ?? null;
    food.addedSugars = sourceNutrition.addsgr?.quantity ?? null;
    food.calcium = sourceNutrition.ca?.quantity ?? null;
    food.iron = sourceNutrition.fe?.quantity ?? null;
    food.dietaryFiber = sourceNutrition.fibtg?.quantity ?? null;
    food.saturatedFat = sourceNutrition.sfa?.quantity ?? null;

    // Ingredients as a single plain string (not JSON).
    food.ingredients = sourceItem.ingredients || "";

    // Allergens/traits as a JSON-encoded array of strings, e.g. '["Vegan"]'.
    if (sourceItem.traits) {
      const rawLabels = Object.values(sourceItem.traits.allergen ?? []).concat(
        Object.values(sourceItem.traits.requirement ?? []),
      ); // Concat requirement and allergen traits into one array
      const labels: string[] = (rawLabels ?? []).map((t: any) => t.name ?? t);
      food.labels = JSON.stringify(labels);
    } else {
      food.labels = JSON.stringify([]);
    }

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

  // Parses a time number in the format HHMM into a string in the ISO format
  private parseTimeNumber(time: number, dateString: string = "1970-01-01"): string {
    // Pad the number to ensure it's 4 digits (e.g., '0830' instead of '830')
    const timeStr = time.toString().padStart(4, "0");

    const hours = timeStr.substring(0, 2);
    const minutes = timeStr.substring(2, 4);

    // Combine with a full ISO date (defaults to Unix epoch) for valid Date parsing
    const isoString = `${dateString}T${hours}:${minutes}-05:00`;

    return new Date(isoString).toISOString();
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
    // Calls your source API. For example:
    //   const resp = await fetch(`https://dining.example.edu/menu?hall=${loc}&date=${date}`);
    //   if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    //   const json = await resp.json();
    //
    // Throw on failure — pullRawData()/processMenus() handle each hall in
    // isolation, so one bad hall won't take down the rest.
    const url = `https://dining.iastate.edu/api/venue/${diningHallIds[loc]}/menu/${date}`;
    const options = { method: "GET" };

    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    const data = (await response.json()) as APIMenuFormat;

    // Throw error if the API response is empty or doesn't contain meals for the given date.
    // NOTE: If an error is thrown here, it will be caught in the processMenus() method and CAUSE the other halls to fail.
    // if (!data || !data.meals) {
    //     throw new Error(`No meals found for ${loc} on ${date}`);
    // }

    // Extract the raw meals from the deserialized data.
    const rawMeals: any[] = data && data.meals ? Object.values(data.meals) : [];

    const meals: Record<string, MealItem[]> = {};
    const mealTimeHours: Record<string, string> = {};
    const foodItemsMap = new Map<string, any>();

    // 2) Walk the source menu, grouping items by meal time and collecting the
    //    distinct foods to store. Adapt the field access to your API's shape.

    const rawMealTimeHours = data.hours[date];
    for (const mealTime of rawMealTimeHours) {
      mealTimeHours[mealTime.comment] = JSON.stringify({
        Start: this.parseTimeNumber(mealTime.starthours, date),
        End: this.parseTimeNumber(mealTime.endhours, date),
      });
    }

    for (const meal of rawMeals) {
      const mealName: string = meal.meal;
      if (!MEAL_TIMES.includes(mealName)) continue;

      meals[mealName] ??= [];

      const stations: any[] = Object.values(meal.menu_displays);
      for (const station of stations ?? []) {
        // Run through each course category (e.g. entrees and sides and condiments)
        // and then add each food item to the meals list for this meal time.
        const categories: any[] = Object.values(station.categories);
        for (const category of categories ?? []) {
          const items: any[] = Object.values(category.items);
          for (const item of items ?? []) {
            const id = String(item.id);
            meals[mealName].push({ id, station: station.name });
            if (!foodItemsMap.has(id)) foodItemsMap.set(id, item);
          }
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
        let latitude = "";
        let longitude = "";
        const schedule = JSON.stringify((generalSchedules as Record<string, any>)[hall] ?? {});

        if (latitude == null || longitude == null) {
          const geoSecret = env.GEO_CONVERSION_KEY;
          console.log("Fetching geocode for address:", address);
          const response = await fetch(`https://geocode.maps.co/search?q=${address}&api_key=${geoSecret}`);
          const geoData = (await response.json()) as any;

          latitude = geoData[0].lat;
          longitude = geoData[0].lon;
        }

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

interface APIMenuFormat {
  meals?: string;
  hours?: string;
}
