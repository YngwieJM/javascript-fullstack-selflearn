# API Performance Smoke/Baseline (k6)

## Coverage
- `POST /auth/login` (auth flow)
- `GET /menu` (high-read flow)
- `POST /orders` + `PATCH /orders/:id/close` (main order workflow)
- `GET /tables` (protected route requiring authorization)

## Prerequisites
- API server running locally (`npm start`), default `http://localhost:3000`
- `k6` installed and available in `PATH`
- Database has at least one table row (or pass `ORDER_TABLE_ID`)

## Quick Run
- Smoke:
  - `npm run perf:smoke`
- Baseline (average-load):
  - `npm run perf:baseline`

## Direct k6 Commands
- Smoke:
  - `k6 run tests/performance/k6.api.smoke.js`
- Baseline:
  - `k6 run tests/performance/k6.api.baseline.js`

## Optional Environment Variables
- `BASE_URL` (default: `http://localhost:3000`)
- `PERF_PASSWORD` (default: `perfpass123`)
- `ORDER_TABLE_ID` (optional explicit table id for order create)

Example:
- `k6 run -e BASE_URL=http://localhost:3000 -e ORDER_TABLE_ID=1 tests/performance/k6.api.smoke.js`

## Notes
- Each run auto-creates a unique WAITER user via `POST /auth/register` during setup.
- If no table is found and `ORDER_TABLE_ID` is not provided, the run fails fast with a clear setup message.
- These are lightweight regression/perf checks, not stress/spike/soak tests.
