# Restaurant API

Backend API for restaurant operations using Node.js, Express, PostgreSQL, JWT auth, and Zod validation.

## Features

- Auth: register, login, forgot password, reset password
- Role-based access control (`MANAGER`, `WAITER`, `BARTENDER`)
- CRUD modules:
  - Staff
  - Menu
  - Orders and order items
  - Restaurant tables
  - Sales reports
- Request validation with Zod
- Centralized error handling
- Pagination on list endpoints
- Postman collection and environment for quick testing

## Tech Stack

- Node.js (CommonJS)
- Express
- PostgreSQL (`pg`)
- JWT (`jsonwebtoken`)
- Password hashing (`bcrypt`)
- Validation (`zod`)
- Testing (`jest`, `supertest`)

## Requirements

- Node.js 18+ (recommended)
- PostgreSQL 14+ (recommended)
- npm

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file from template:

```bash
copy config\\.env.example config\\.env
```

3. Update values in `config/.env`:

```env
JWT_SECRET=replace-with-your-jwt-secret
PASSWORD_RESET_MINUTES=15

DB_USER=postgres
DB_HOST=localhost
DB_NAME=restaurant_db
DB_PASSWORD=replace-with-your-db-password
DB_PORT=5432

PORT=3000
```

4. Ensure your PostgreSQL database exists and includes required tables:

- `staff`
- `restaurant_tables`
- `menu_items`
- `orders`
- `order_items`
- `password_reset_tokens`

Note: this repo currently does not include DB migration files.

## Run

```bash
npm start
```

Default server URL: `http://localhost:3000`

## Test

```bash
npm test
```

## API Modules

- `/auth`
  - `POST /auth/register`
  - `POST /auth/login`
  - `POST /auth/forgot-password`
  - `POST /auth/reset-password`
- `/staff`
- `/menu`
- `/orders`
- `/tables`
- `/reports`

OpenAPI files are available in `docs/` (e.g. `docs/openapi.json`).

## Documentation

- Scenario guide: `docs/one-day-operation-scenario.md`
- Release/setup runbook: `docs/release-runbook.md`
- OpenAPI: `docs/openapi.json` (plus split module files in `docs/`)

## Postman

Import:

- `postman/restaurant-api-models.postman_collection.json`
- `postman/restaurant-api-local.postman_environment.json`

## Scenario and Utility Scripts

### One-day operation scenario

Creates randomized operation data from `09:00` to `23:00`, including random staff/menu/tables/orders and report output.
The data source (data bank) is in `scripts/scenario.data-bank.js`.

```bash
npm run scenario:one-day
```

Run for specific date (`YYYY-MM-DD`, Windows cmd):

```bash
set OPS_DATE=2026-03-12&& npm run scenario:one-day
```

Run with a fixed random seed (reproducible run):

```bash
set OPS_SEED=my-seed-value&& npm run scenario:one-day
```

### Cleanup scenario data

Cleanup orders and order items in the one-day operation window (`09:00-23:00`):

```bash
npm run scenario:cleanup-one-day
```

Full cleanup (also removes scenario-added staff/menu when not referenced):

```bash
npm run scenario:cleanup-one-day:full
```

Specific date (Windows cmd):

```bash
set OPS_DATE=2026-03-12&& npm run scenario:cleanup-one-day
set OPS_DATE=2026-03-12&& npm run scenario:cleanup-one-day:full
```

### Convert menu prices to IDR

Converts existing menu prices to Indonesian Rupiah scale.

```bash
npm run menu:price-idr
```

### Reset DB to minimal initial data (for new PC)

Clears transactional/test data, resets ID sequences, and seeds a small baseline dataset.

```bash
npm run db:reset-initial
```

Seeded login accounts (default password: `123456`):

- `admin@test.com` (`MANAGER`)
- `anna@test.com` (`BARTENDER`)
- `michael@test.com` (`WAITER`)

## Notes

- Menu prices are now handled as IDR numeric values (e.g. `35000`).
- If you run scenario scripts multiple times, use cleanup commands per date to keep data tidy.
- Full cleanup removes scenario-marked random staff/menu data when no transaction references remain.
