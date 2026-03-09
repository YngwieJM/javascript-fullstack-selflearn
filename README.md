# javascript-fullstack-selflearn

Express + PostgreSQL backend for restaurant management APIs.

## Required installations

- Node.js 20+ (LTS recommended)
- npm 10+ (included with Node.js)
- Database: PostgreSQL 16+ (required)
- Docker Desktop (optional, but recommended to run PostgreSQL quickly)

Check installed versions:

```bash
node -v
npm -v
docker -v
```

## 1) Install dependencies

```bash
npm install
```

## 2) Configure environment

Copy `config/.env.example` to `config/.env` and adjust values if needed.

`config/.env` example values for local Docker Postgres:

```env
JWT_SECRET=dev-only-change-me
PASSWORD_RESET_MINUTES=15

DB_USER=postgres
DB_HOST=localhost
DB_NAME=restaurant_db
DB_PASSWORD=postgres
DB_PORT=5432

PORT=3000
```

## 3) Setup database (choose one)

### Option A: Docker (recommended)

```bash
npm run db:up
```

Notes:
- First startup runs SQL in `db/init/` automatically (`001_schema.sql`, `002_seed.sql`).
- If you need a clean reset, run:

```bash
npm run db:reset
```

### Option B: Native PostgreSQL install

1. Install PostgreSQL 16+ on your machine.
2. Create database `restaurant_db`.
3. Execute SQL files in order:
   - `db/init/001_schema.sql`
   - `db/init/002_seed.sql`
4. Update `config/.env` with your local PostgreSQL credentials:

```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=restaurant_db
DB_PASSWORD=your_password
DB_PORT=5432
```

## 4) Start API

```bash
npm start
```

Server runs on `http://localhost:3000` by default.

## 5) Run tests

```bash
npm test
```

## Default seeded users

Seeded users are created in `db/init/002_seed.sql`:
- `manager@example.com` (MANAGER)
- `john@example.com` (WAITER)
- `anna@example.com` (BARTENDER)
- default password for all seeded users: `123456`

Use `/auth/login` to get a JWT token.

## Useful commands

```bash
npm run db:up
npm run db:logs
npm run db:down
```

## Quick run (new PC)

```bash
npm install
npm run db:up
npm start
```
