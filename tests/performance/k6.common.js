import http from "k6/http";
import { check, fail } from "k6";

const base = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const password = __ENV.PERF_PASSWORD || "perfpass123";
const orderTableIdEnv = __ENV.ORDER_TABLE_ID ? Number(__ENV.ORDER_TABLE_ID) : null;

function jsonHeaders(token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function asJson(res) {
  try {
    return res.json();
  } catch (_err) {
    return null;
  }
}

function randomPerfUser() {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  return {
    name: `PerfUser${suffix.slice(-6)}`,
    email: `perf_${suffix}@example.com`,
    password,
    role: "WAITER"
  };
}

function requireStatus(res, status, context) {
  if (res.status !== status) {
    fail(`${context} failed: expected ${status}, got ${res.status}, body=${res.body}`);
  }
}

function resolveTableId(token) {
  if (Number.isInteger(orderTableIdEnv) && orderTableIdEnv > 0) {
    return orderTableIdEnv;
  }

  const res = http.get(`${base}/tables`, {
    headers: jsonHeaders(token),
    tags: { endpoint: "tables.list", flow: "setup" }
  });

  requireStatus(res, 200, "Setup GET /tables");
  const tables = asJson(res);

  if (!Array.isArray(tables) || tables.length === 0 || !tables[0].id) {
    fail("No table found for order workflow. Seed at least one table row or pass ORDER_TABLE_ID.");
  }

  return Number(tables[0].id);
}

export function setupTestData() {
  const user = randomPerfUser();

  const registerRes = http.post(
    `${base}/auth/register`,
    JSON.stringify(user),
    { headers: jsonHeaders(), tags: { endpoint: "auth.register", flow: "setup" } }
  );
  requireStatus(registerRes, 201, "Setup POST /auth/register");

  const loginRes = http.post(
    `${base}/auth/login`,
    JSON.stringify({ email: user.email, password: user.password }),
    { headers: jsonHeaders(), tags: { endpoint: "auth.login", flow: "setup" } }
  );
  requireStatus(loginRes, 200, "Setup POST /auth/login");

  const token = loginRes.json("token");
  if (!token || typeof token !== "string") {
    fail("Setup login did not return a token.");
  }

  const tableId = resolveTableId(token);

  return { baseUrl: base, email: user.email, password: user.password, token, tableId };
}

export function runAuthLogin(data, scenario) {
  const res = http.post(
    `${data.baseUrl}/auth/login`,
    JSON.stringify({ email: data.email, password: data.password }),
    {
      headers: jsonHeaders(),
      tags: { endpoint: "auth.login", flow: scenario }
    }
  );

  check(res, {
    "login status is 200": (r) => r.status === 200,
    "login returns token": (r) => typeof r.json("token") === "string"
  });
}

export function runMenuList(data, scenario) {
  const res = http.get(`${data.baseUrl}/menu`, {
    headers: jsonHeaders(data.token),
    tags: { endpoint: "menu.list", flow: scenario }
  });

  check(res, {
    "menu list status is 200": (r) => r.status === 200,
    "menu list returns array": (r) => Array.isArray(asJson(r))
  });
}

export function runOrderWorkflow(data, scenario) {
  const createRes = http.post(
    `${data.baseUrl}/orders`,
    JSON.stringify({ table_id: data.tableId }),
    {
      headers: jsonHeaders(data.token),
      tags: { endpoint: "orders.create", flow: scenario }
    }
  );

  const createOk = check(createRes, {
    "order create status is 201": (r) => r.status === 201,
    "order create returns order id": (r) => Number.isInteger(Number(r.json("order.id")))
  });

  if (!createOk) return;

  const orderId = Number(createRes.json("order.id"));

  const closeRes = http.patch(`${data.baseUrl}/orders/${orderId}/close`, null, {
    headers: jsonHeaders(data.token),
    tags: { endpoint: "orders.close", flow: scenario }
  });

  check(closeRes, {
    "order close status is 200": (r) => r.status === 200
  });
}

export function runProtectedRoute(data, scenario) {
  const res = http.get(`${data.baseUrl}/tables`, {
    headers: jsonHeaders(data.token),
    tags: { endpoint: "tables.list", flow: scenario }
  });

  check(res, {
    "protected route status is 200": (r) => r.status === 200,
    "protected route returns array": (r) => Array.isArray(asJson(r))
  });
}
