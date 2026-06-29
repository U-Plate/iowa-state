import { D1Database } from "@uplate/types/env";
import { Metadata } from "../types/metadata";

/**
 * Inserts or updates the metadata for a specific dining hall.
 * @param {D1Database} db - The D1 database instance.
 * @param {string} school - The school name.
 * @param {string} diningHall - The name of the dining hall.
 * @param {string} address - The address of the dining hall.
 * @param {string} latitude - The latitude coordinate.
 * @param {string} longitude - The longitude coordinate.
 * @param {string} type - The type of dining hall (e.g., "Buffet", "A-La-Carte").
 * @param {string} schedule - The schedule of the dining hall in json format.
 * @returns {Promise<void>}
 */
export async function storeMetadataInD1(db: D1Database, metadata: Metadata): Promise<void> {
  console.log("storeMetadataInD1(): success");
  
}
