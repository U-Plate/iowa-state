/**
 * A single food item as stored in the D1 `foods` table.
 *
 * The `foods` table is an upsert-by-`id` table: each item is written once and
 * updated in place on later runs. Meal entries ({@link MealItem}) reference
 * foods by `id`, so the app joins the two to show nutrition for a menu item.
 *
 * Numeric fields are optional: omit them (or leave them `undefined`) when the
 * source API doesn't provide a value — the storage layer substitutes a sentinel
 * default (`-1`, or `"Unknown"` for `servingSize`) which the app treats as
 * "missing". Do NOT store `0` for an unknown value; `0` means "measured as zero".
 */
export interface FoodItem {
  /**
   * Stable, non-empty unique identifier for this food. The `foods` table upserts
   * on this key and {@link MealItem.id} points back to it, so it MUST be the same
   * string every run for the same food. Unstable ids grow the table and strand
   * older meal references. Usually the source API's food id, coerced to a string.
   */
  id: string;
  /** Human-readable display name shown in the app. Must be a non-empty string. */
  name: string;
  /** Total carbohydrates, in grams. */
  carbs?: number;
  /** Protein, in grams. */
  protein?: number;
  /** Total sugars, in grams. */
  sugar?: number;
  /** Total fat, in grams. */
  totalFat?: number;
  /** Energy, in kilocalories (the number a user reads as "calories"). */
  calories?: number;
  /** Serving size as a display string, e.g. `"1 cup"` or `"4 oz"`. */
  servingSize?: string;
  /** Saturated fat, in grams. */
  saturatedFat?: number;
  /** Added sugars, in grams. */
  addedSugars?: number;
  /** Full ingredients list as a single plain string (not JSON). */
  ingredients?: string;
  /**
   * Traits/allergens as a JSON-encoded string array, e.g. `'["Vegan","Gluten-Free"]'`.
   * The app `JSON.parse`s this and renders each entry as a tag, so it must parse
   * to an array of strings. Use `"[]"` (or omit) when there are none.
   */
  labels?: string;
  /** Sodium, in milligrams (mg), not grams. */
  sodium?: number;
  /** Dietary fiber, in grams. */
  dietaryFiber?: number;
  /** Cholesterol, in milligrams (mg), not grams. */
  cholesterol?: number;
  /** Calories from fat, in kilocalories. */
  caloriesFromFat?: number;
  /** Calcium, in milligrams (mg). */
  calcium?: number;
  /** Iron, in milligrams (mg). */
  iron?: number;
  /**
   * Whether users may favorite this item. Defaults to `true` when omitted; set
   * `false` only for items that shouldn't be favoritable (e.g. condiments).
   */
  isFavoritable?: boolean;
}
