import { storeFoodsInD1 as originalStoreFoods } from "./foods.ts";
import { storeMealsInD1 as originalStoreMeals } from "./meals.ts";
import { storeMetadataInD1 as originalStoreMetadata } from "./metadata.ts";

export const hooks = {
  storeFoodsInD1: null as null | typeof originalStoreFoods,
  storeMealsInD1: null as null | typeof originalStoreMeals,
  storeMetadataInD1: null as null | typeof originalStoreMetadata,
};

export async function storeFoodsInD1(...args: Parameters<typeof originalStoreFoods>): Promise<void> {
  if (hooks.storeFoodsInD1) {
    return hooks.storeFoodsInD1(...args);
  }
  return originalStoreFoods(...args);
}

export async function storeMealsInD1(...args: Parameters<typeof originalStoreMeals>): Promise<boolean> {
  if (hooks.storeMealsInD1) {
    return hooks.storeMealsInD1(...args);
  }
  return originalStoreMeals(...args);
}

export async function storeMetadataInD1(...args: Parameters<typeof originalStoreMetadata>): Promise<void> {
  if (hooks.storeMetadataInD1) {
    return hooks.storeMetadataInD1(...args);
  }
  return originalStoreMetadata(...args);
}

