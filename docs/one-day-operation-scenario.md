# One-Day Operation Scenario

This scenario seeds one day of restaurant operations (`06:00` to `12:00`) and prints sales report output for that date.

## Run

```bash
npm run scenario:one-day
```

Run for a specific date:

```bash
# Windows (cmd)
set OPS_DATE=2026-03-12&& npm run scenario:one-day
```

`OPS_DATE` format: `YYYY-MM-DD`

## Cleanup Scenario Orders

Remove `CLOSED` orders created in the operation window (`06:00-12:00`) for a specific date.

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
- Adds/updates realistic staff:
  - Rafi Nugroho (`WAITER`)
  - Nadia Putri (`BARTENDER`)
  - Kevin Pratama (`WAITER`)
- Repairs table format into:
  - `VIP 1-3`
  - `Terrace 1-3`
  - `Table 1-3`
- Adds/updates menu setup (food, drink, dessert) with prices in IDR and marks them available.
- Creates closed orders and order items in the operation window (`06:00-12:00`).
- Prints same-day sales report:
  - Daily sales
  - Hourly sales
  - Sales by staff
  - Top menu
