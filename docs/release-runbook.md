# Release Runbook (Clean No-QA Branch)

This document describes how to run and publish the `release-clean-no-qa` branch.

## Scope

Included in this branch:

- Runtime API code updates (reports API, pagination integration, validators, services/routes/controllers)
- Documentation (`README.md`, OpenAPI files, scenario docs)
- Postman collection/environment
- Utility scripts:
  - one-day randomized scenario generation
  - scenario cleanup
  - IDR price conversion
  - DB reset to minimal baseline

Excluded from this branch:

- QA and test suites under `tests/`

## New PC Initialization

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

- Copy `config/.env.example` to `config/.env`
- Set DB and JWT values

3. Start with clean baseline data:

```bash
npm run db:reset-initial
```

Seeded users (default password: `123456`):

- `admin@test.com` (`MANAGER`)
- `anna@test.com` (`BARTENDER`)
- `michael@test.com` (`WAITER`)

4. Run API:

```bash
npm start
```

API docs endpoints:

- Swagger UI: `http://localhost:3000/api-docs`
- OpenAPI JSON: `http://localhost:3000/openapi.json`

## Optional Data Utilities

- Generate randomized one-day data (`09:00-23:00`):

```bash
npm run scenario:one-day
```

- Cleanup one-day transactional data:

```bash
npm run scenario:cleanup-one-day
```

- Full cleanup (transactional + unreferenced scenario master data):

```bash
npm run scenario:cleanup-one-day:full
```

- Convert menu prices to IDR scale:

```bash
npm run menu:price-idr
```

## Publish Flow

Push branch:

```bash
git push -u origin release-clean-no-qa
```

Then open a PR from `release-clean-no-qa` to `main`.

## Safety Notes

- `db:reset-initial` is destructive: it truncates operational tables and reseeds baseline data.
- Do not run reset/scenario scripts in production unless explicitly intended.
- Keep production database separate from development/testing databases.
