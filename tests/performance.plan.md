# API Performance Test Plan

## Scope
- Modules: `auth`, `staff`, `menu`, `orders`, `tables`
- Goal: catch latency regressions, throughput bottlenecks, and error-rate spikes under realistic concurrency

## Tooling
- Primary: `k6` HTTP load scripts (recommended for CI repeatability)
- Secondary: `autocannon` for quick local spot checks
- Environment: dedicated staging DB with production-like schema and indexes

## Implemented Lightweight Pack
- Smoke script: `tests/performance/k6.api.smoke.js`
- Baseline script: `tests/performance/k6.api.baseline.js`
- Shared helpers: `tests/performance/k6.common.js`
- Run guide: `tests/performance/README.md`

## Global SLO Targets
- Read endpoints p95 latency: <= 250 ms
- Write endpoints p95 latency: <= 400 ms
- Error rate under target load: < 1%
- No connection-pool exhaustion or unhandled promise rejection

## Workloads By Module
- `auth`
  - `POST /auth/login`: 10 -> 100 RPS ramp, mixed valid/invalid credentials
  - `POST /auth/register`: burst test for duplicate email contention
  - `POST /auth/forgot-password`: sustained load to verify generic response timing consistency
- `staff`
  - `GET /staff` and `GET /staff/:id`: manager-only read load
  - `PATCH /staff/:id`: mixed self-update and manager-reset scenarios
- `menu`
  - `GET /menu`: highest expected read traffic baseline
  - `PATCH /menu/:id` and `/availability`: manager write concurrency
- `orders`
  - `POST /orders`: concurrent waiter creation load
  - `POST /orders/:id/items`: high-concurrency transactional hotspot
  - `PATCH /orders/:id/close`: retry and repeated-close behavior under race conditions
- `tables`
  - `GET /tables`: waiter + manager mixed role load
  - `PUT /tables/:id` and `DELETE /tables/:id`: write contention and conflict handling

## Test Types
- Baseline: single-user, warm cache, measure median/p95
- Load: sustained expected peak for 10-15 minutes
- Stress: ramp beyond peak until SLO violation
- Spike: sudden jump to 2-3x peak for 2 minutes
- Soak: 60-minute run at 60-70% peak to catch leaks

## Data Integrity Checks During Perf
- Compare row counts before/after invalid/forbidden write bursts
- Verify retry storms do not create duplicate records where uniqueness applies
- Validate order-item transaction failure paths leave no partial inserts

## CI/CD Integration (Recommended)
- Nightly: baseline + short load profile
- Pre-release: full load + stress + integrity checks
- Fail build when p95/error-rate thresholds regress by > 15% from baseline
