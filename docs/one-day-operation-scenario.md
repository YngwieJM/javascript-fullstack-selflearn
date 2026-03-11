# One-Day Operation Scenario

This scenario seeds one day of restaurant operations (`09:00` to `23:00`) and prints sales report output for that date.
Generation is randomized on every run using the scenario data bank in `scripts/scenario.data-bank.js`.

## Run

Optional: start from clean minimal baseline first:

```bash
npm run db:reset-initial
```

```bash
npm run scenario:one-day
```

Run for a specific date:

```bash
# Windows (cmd)
set OPS_DATE=2026-03-12&& npm run scenario:one-day
```

`OPS_DATE` format: `YYYY-MM-DD`

Use a fixed random seed (for reproducible runs):

```bash
# Windows (cmd)
set OPS_SEED=my-seed-value&& npm run scenario:one-day
```

## Cleanup Scenario Orders

Remove `CLOSED` orders created in the operation window (`09:00-23:00`) for a specific date.

```bash
npm run scenario:cleanup-one-day
```

Full cleanup (orders + scenario-added staff/menu if unreferenced):

```bash
npm run scenario:cleanup-one-day:full
```

Specific date:

```bash
# Windows (cmd)
set OPS_DATE=2026-03-12&& npm run scenario:cleanup-one-day
```

Specific date + full cleanup:

```bash
# Windows (cmd)
set OPS_DATE=2026-03-12&& npm run scenario:cleanup-one-day:full
```

## What It Does

- Normalizes core staff IDs `2-6` to:
  - `2` Anna (`BARTENDER`)
  - `3` Michael (`WAITER`)
  - `4` Admin (`MANAGER`)
  - `5` Jordan (`WAITER`)
  - `6` Lisa (`WAITER`)
- Resets core staff password to `123456`.
- Deletes placeholder staff names `Mgr` and `Waiter`.
- Adds random staff (WAITER/BARTENDER) with scenario email pattern: `scn.<run-tag>...@test.local`.
- Randomizes table naming/capacity using zones:
  - `VIP`
  - `Terrace`
  - `Table`
- Inserts random menu items (IDR pricing) with scenario marker in the name: `(SCN-<run-tag>)`.
- Creates random closed orders and random order items in the operation window (`09:00-23:00`).
- Prints same-day sales report:
  - Daily sales
  - Hourly sales
  - Sales by staff
  - Top menu
