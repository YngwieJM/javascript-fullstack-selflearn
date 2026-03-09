# javascript-fullstack-selflearn

Express + PostgreSQL backend for restaurant management APIs.

## Prerequisites

- Node.js 20+ (LTS recommended)
- npm 10+
- Docker Desktop (recommended for local Postgres)

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

## 3) Start PostgreSQL locally

```bash
npm run db:up
```

Notes:
- First startup runs SQL in `db/init/` automatically (`001_schema.sql`, `002_seed.sql`).
- If you need a clean reset, run:

```bash
npm run db:reset
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
