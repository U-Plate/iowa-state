/**
 * One entry in a dining hall's menu for a single meal time — i.e. a food that
 * is being served, plus where it's served. Stored inside a {@link Menu}.
 *
 * A meal entry is just a pointer to a {@link FoodItem} (by `id`) tagged with a
 * station; the nutrition lives on the food row, not here. The storage layer
 * dedupes and version-merges entries keyed on `id|station`, so both fields must
 * be present and stable across runs for the merge to behave.
 */
export interface MealItem {
  /**
   * The {@link FoodItem.id} of the food being served. Must be a non-empty string
   * that matches a food stored for this school in the same run, otherwise the app
   * has no nutrition to show for it.
   */
  id: string;
  /**
   * Station / section the item is served at, e.g. `"Grill"`, `"Salad Bar"`.
   * Part of the `id|station` merge key, so keep it stable run-to-run. Use `""`
   * if the source has no station concept rather than leaving it undefined.
   */
  station: string;
  /**
   * Set by the storage layer's merge, NOT by school code: it marks an item that
   * was present before but is missing from the latest fetch so it can be carried
   * forward as removed. Schools should leave this unset.
   */
  deleted?: boolean;
  /**
   * Schools may attach extra source-specific fields; they are stored as-is.
   * Typed `unknown` so consumers must narrow before use — the known fields
   * above keep their concrete types.
   */
  [key: string]: unknown;
}
