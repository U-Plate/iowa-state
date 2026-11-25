// Regenerates src/generalSchedules.json from ISU Dining's published hours.
//
// The API only exposes per-date hours, and holidays/breaks show up as closed,
// so pick a normal in-session week and run:
//
//   npm run build:schedules -- 2026-11-30
//
// The 7 consecutive days starting at that date are fetched for every venue and
// written as the canonical generalSchedule format. Re-run each semester (or
// whenever hours change) and review the diff before committing.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import school from "../src/school";
import { MEAL_TIMES, buildSlots, minutesToHHMM } from "../src/hours";
import { VENUE_IDS } from "../src/iowa-state";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const start = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(start ?? "")) {
  console.error("usage: tsx scripts/build-general-schedules.ts YYYY-MM-DD");
  process.exit(1);
}
const dates = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(`${start}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + i);
  return d.toISOString().slice(0, 10);
});

type Day = { Start: string; End: string } | null;
const out: Record<string, Record<string, Record<string, Day> | null>> = {};

for (const hall of school.getDiningHalls()) {
  const schedule: Record<string, Record<string, Day>> = {};
  for (const m of MEAL_TIMES) schedule[m] = Object.fromEntries(DAY_NAMES.map((d) => [d, null]));
  for (const date of dates) {
    const resp = await fetch(`https://dining.iastate.edu/api/venue/${VENUE_IDS[hall]}/menu/${date}`, {
      headers: { Accept: "application/json", "User-Agent": "BoilerFuel-Worker/1.0" },
    });
    if (!resp.ok) throw new Error(`${hall} ${date}: HTTP ${resp.status}`);
    const json = (await resp.json()) as any;
    const dayName = DAY_NAMES[new Date(`${date}T12:00:00Z`).getUTCDay()];
    for (const [meal, slot] of buildSlots(json?.hours?.[date])) {
      schedule[meal][dayName] = { Start: minutesToHHMM(slot.start), End: minutesToHHMM(slot.end) };
    }
  }
  out[hall] = Object.fromEntries(
    MEAL_TIMES.map((m) => [m, Object.values(schedule[m]).some((d) => d) ? schedule[m] : null]),
  );
  console.log(`✔ ${hall}`);
}

const target = fileURLToPath(new URL("../src/generalSchedules.json", import.meta.url));
writeFileSync(target, JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${target} (reference week ${dates[0]} .. ${dates[6]})`);
