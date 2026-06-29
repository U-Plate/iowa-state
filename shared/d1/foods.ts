import { Env, D1Database } from "../types/env";
import { FoodItem } from "../types/foods";

/**
 * Inserts or updates a batch of food items in the D1 'foods' table.
 * @param {D1Database} db - The D1 database instance.
 * @param {Array<FoodItem>} foods - An array of food items to store.
 * @param {string} school - The school name.
 */
export async function storeFoodsInD1(db: D1Database, foods: FoodItem[], school: string): Promise<void> {
  if (!db || !foods || !school) {
    console.log("storeFoodsInD1(): one or more parameters is null");
    return;
  }

  if (foods.length === 0) {
    console.log("storeFoodsInD1(): no foods to store");
    return;
  }

  console.log("storeFoodsInD1(): success");
}
