# Adding a new school

This repo is the template for a school integration. The backend
(`boiler_fuel_backend`) loads each school through `schools/registry.ts` and
talks to it **only** through the `School` contract below. The test harness in
`tests/run.ts` drives your implementation through the exact same calls the
production worker makes, against a faithful in-memory simulation of the
production D1 layer — if the harness is green, the school will work when wired
into the backend.

## The School contract

Your school class must extend `School` (`shared/types/school.ts`) and provide:

| Method | Called by | Notes |
| --- | --- | --- |
| `processMenus(env, dateOffset, isRecursive?)` | cron trigger + `?fetchMenus` route | **The production ingest entry point.** Fetch, parse, and store everything via the `@uplate/d1/index` functions. Returns `boolean[][]` (per hall, per meal time store statuses). |
| `pullRawData(date)` | test harness / diagnostics | Fetch + parse only, **no D1 writes**. Returns one `HallResult` per dining hall so failures are reported per hall. |
| `fetchMetadata(env)` | metadata refresh | Store hall address/coordinates/schedule via `storeMetadataInD1`. |
| `addSodasIfMissing(env)` | `?fetchSodas` admin route | Default no-op is fine if the school has no static drink items. |
| `getSchoolCode()` / `getDiningHalls()` | routing, school list | Set via the `super(...)` constructor. |

Nutrislice-backed schools should extend `Nutrislice`
(`shared/types/nutrislice.ts`), which implements all of this; custom-API
schools implement it directly — see the worked template in `src/example.ts`.

## Storage rules the harness enforces

These mirror how the production D1 layer and read paths behave:

- **Store through `@uplate/d1/index`** (`storeFoodsInD1`, `storeMealsInD1`,
  `storeMetadataInD1`) — never invent your own storage. The harness hooks these
  to capture writes.
- **School code** passed to every store call must equal `getSchoolCode()`.
- **Dates** are `YYYY-MM-DD`.
- **Meal items** are `{ id: string, station: string }`. Production's
  versioning merge keys on `id|station` — ids must be unique per station
  within a slot (dedupe before storing) and every id should reference a row
  you stored in `foods`.
- **Meal hours** are a JSON string `{"Start": <ISO datetime>, "End": <ISO datetime>}`.
- **Hall names** must be consistent between meals and metadata — the app joins
  them by name (don't store meals under a slug and metadata under a display
  name).
- **Schedules** (`metadata.schedule`) use the canonical generalSchedule format:

  ```json
  { "Breakfast": { "Sunday": { "Start": "08:00", "End": "10:00" }, "Monday": null, ... },
    "Brunch": null, ... }
  ```

  Never store raw API responses here. If the upstream API publishes no hours,
  add a hand-maintained `src/generalSchedules.json` (see Purdue / IU).
- **Idempotency**: running `processMenus` twice with unchanged upstream data
  must not write new meal versions — production runs this on a cron and the
  version history grows forever otherwise. (If you store through the shared
  d1 functions this comes for free.)

## Running the harness

```
npm install
npm test
```

The harness:

1. Statically checks the contract (methods present, school code, halls).
2. Calls `pullRawData()` for per-hall fetch/parse diagnostics.
3. Calls `processMenus(env, 0, false)` — the production path — capturing all
   D1 writes into an in-memory replica (including sentinel defaults, the
   append-only meal version history, deleted-item merge, and KV cache
   invalidation).
4. Calls `processMenus` a second time and fails if any unchanged slot wrote a
   new version.
5. Calls `fetchMetadata()` and `addSodasIfMissing()`.
6. Validates everything stored (formats, referential integrity, data quality)
   and writes `tests/report.html`.

Exit code is non-zero when any error-level issue is found, so it can gate CI.
A contract-check failure means production would break; data-quality errors
(e.g. "hall has no items") can also be legitimate — a closed hall over summer
looks the same as a broken parser, so check the report.
