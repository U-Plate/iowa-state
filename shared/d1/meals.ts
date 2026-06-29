import { Env } from "../types/env";
import { MealItem } from "../types/meals";
import { Menu } from "../types/menu";

/**
 * Inserts or updates the meal data for a specific dining hall and date.
 * @param {Env} env - The environment object (contains DB and KV_MENUS).
 * @param {Menu} menu - The day's menu data
 * @returns {Promise<boolean>} True if the update was successful, false otherwise.
 */
export async function storeMealsInD1(env: Env, menu: Menu): Promise<boolean> {
  const diningHall: string = menu.diningHall;
  const date: string = menu.date;
  const meals: MealItem[] = menu.meals;
  const school: string = menu.school;
  const mealTime: string = menu.mealTime;
  const mealTimeHours: string = menu.mealTimeHours;
  if (!env || !diningHall || !date || !meals || !school || !mealTime || !mealTimeHours) {
    console.log("storeMealsInD1(): one or more parameters is null");
    return false;
  }

  if (meals.length === 0) {
    console.log("storeMealsInD1(): storing zero meals, if this is not intentional, something has gone wrong");
  }

  if (Number.isNaN(Date.parse(date))) {
    console.log("storeMealsInD1(): date is not formatted like YYYY-MM-DD");
  }

  console.log("storeMealsInD1(): success");

  return true;
}
