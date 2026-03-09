const fs = require("fs");
const path = require("path");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/env");
const { errorHandler } = require("../middleware/error.middleware");

jest.mock("../services/tables.service", () => ({
  createTable: jest.fn(),
  updateTable: jest.fn(),
  getAllTables: jest.fn(),
  getTableById: jest.fn(),
  deleteTable: jest.fn()
}));

const tableService = require("../services/tables.service");
const tablesRoutes = require("../routes/tables.routes");

const openapi = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "docs", "openapi.tables.json"), "utf8")
);

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/tables", tablesRoutes);
  app.use(errorHandler);
  return app;
}

function makeToken(role, id = 1) {
  return jwt.sign({ id, role }, jwtSecret, { expiresIn: "1h" });
}

function resolveRef(ref) {
  const parts = ref.replace(/^#\//, "").split("/");
  return parts.reduce((acc, part) => (acc ? acc[part] : undefined), openapi);
}

function getOperation(routePath, method) {
  return openapi.paths[routePath][method];
}

function getResponseSchema(routePath, method, statusCode) {
  const operation = getOperation(routePath, method);
  let response = operation.responses[String(statusCode)];
  if (!response) return null;
  if (response.$ref) response = resolveRef(response.$ref);
  return response.content?.["application/json"]?.schema || null;
}

function matchesType(expectedType, value) {
  if (expectedType === "integer") return Number.isInteger(value);
  if (expectedType === "number") return typeof value === "number" && !Number.isNaN(value);
  if (expectedType === "string") return typeof value === "string";
  if (expectedType === "boolean") return typeof value === "boolean";
  if (expectedType === "array") return Array.isArray(value);
  if (expectedType === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  return true;
}

function validateSchema(schema, value, currentPath = "body") {
  if (!schema) return [];
  if (schema.$ref) return validateSchema(resolveRef(schema.$ref), value, currentPath);

  if (schema.oneOf) {
    const candidateErrors = schema.oneOf.map((s) => validateSchema(s, value, currentPath));
    const passed = candidateErrors.some((errors) => errors.length === 0);
    return passed ? [] : [`${currentPath} does not match any oneOf schema`];
  }

  const errors = [];

  if (schema.type && !matchesType(schema.type, value)) {
    errors.push(`${currentPath} should be ${schema.type}`);
    return errors;
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${currentPath} should be one of: ${schema.enum.join(", ")}`);
  }

  if (schema.type === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${currentPath} should have minLength ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${currentPath} should have maxLength ${schema.maxLength}`);
    }
  }

  if (schema.type === "number" || schema.type === "integer") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${currentPath} should be >= ${schema.minimum}`);
    }
  }

  if (schema.type === "array" && schema.items) {
    value.forEach((item, idx) => {
      errors.push(...validateSchema(schema.items, item, `${currentPath}[${idx}]`));
    });
  }

  if (schema.type === "object") {
    if (schema.required) {
      schema.required.forEach((field) => {
        if (!Object.prototype.hasOwnProperty.call(value, field)) {
          errors.push(`${currentPath}.${field} is required`);
        }
      });
    }

    if (schema.properties) {
      Object.keys(schema.properties).forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(value, field) && value[field] !== undefined) {
          errors.push(
            ...validateSchema(schema.properties[field], value[field], `${currentPath}.${field}`)
          );
        }
      });
    }
  }

  return errors;
}

function expectContract(routePath, method, statusCode, body) {
  const operation = getOperation(routePath, method);
  expect(operation).toBeDefined();
  expect(operation.responses[String(statusCode)]).toBeDefined();

  const schema = getResponseSchema(routePath, method, statusCode);
  if (!schema) return;

  const errors = validateSchema(schema, body);
  expect(errors).toEqual([]);
}

describe("Tables contract tests", () => {
  let app;
  let consoleSpy;
  let tables;
  let tableRefsInOrders;
  const managerToken = makeToken("MANAGER");
  const waiterToken = makeToken("WAITER");
  const bartenderToken = makeToken("BARTENDER");

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    tables = new Map([
      [1, { id: 1, table_number: "A1", capacity: 4 }],
      [2, { id: 2, table_number: "B2", capacity: 6 }]
    ]);

    tableRefsInOrders = new Set([2]);

    tableService.getAllTables.mockImplementation(async () => Array.from(tables.values()));

    tableService.getTableById.mockImplementation(async (id) => {
      const table = tables.get(Number(id));
      if (!table) throw new Error("TABLE_NOT_FOUND");
      return { ...table };
    });

    tableService.createTable.mockImplementation(async (table_number, capacity) => {
      if ([...tables.values()].some((t) => t.table_number === table_number)) {
        const err = new Error("duplicate");
        err.code = "23505";
        throw err;
      }
      const id = Math.max(...Array.from(tables.keys())) + 1;
      const table = { id, table_number, capacity };
      tables.set(id, table);
      return { ...table };
    });

    tableService.updateTable.mockImplementation(async (id, table_number, capacity) => {
      const existing = tables.get(Number(id));
      if (!existing) throw new Error("TABLE_NOT_FOUND");

      if (
        table_number !== undefined &&
        [...tables.values()].some((t) => t.id !== Number(id) && t.table_number === table_number)
      ) {
        const err = new Error("duplicate");
        err.code = "23505";
        throw err;
      }

      if (table_number !== undefined) existing.table_number = table_number;
      if (capacity !== undefined) existing.capacity = capacity;
      return { ...existing };
    });

    tableService.deleteTable.mockImplementation(async (id) => {
      if (tableRefsInOrders.has(Number(id))) throw new Error("TABLE_IN_USE");

      const existing = tables.get(Number(id));
      if (!existing) throw new Error("TABLE_NOT_FOUND");

      tables.delete(Number(id));
      return { ...existing };
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    jest.clearAllMocks();
  });

  test("POST /tables valid create returns 201 contract", async () => {
    const res = await request(app)
      .post("/tables")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ table_number: "C3", capacity: 4 });

    expect(res.status).toBe(201);
    expectContract("/tables", "post", res.status, res.body);
  });

  test("GET /tables valid list returns 200 contract", async () => {
    const res = await request(app).get("/tables").set("Authorization", `Bearer ${waiterToken}`);

    expect(res.status).toBe(200);
    expectContract("/tables", "get", res.status, res.body);
  });

  test("GET /tables/:id valid get returns 200 contract", async () => {
    const res = await request(app).get("/tables/1").set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expectContract("/tables/{id}", "get", res.status, res.body);
  });

  test("PUT /tables/:id valid update returns 200 contract", async () => {
    const res = await request(app)
      .put("/tables/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ capacity: 8 });

    expect(res.status).toBe(200);
    expectContract("/tables/{id}", "put", res.status, res.body);
    expect(tables.get(1).capacity).toBe(8);
  });

  test("DELETE /tables/:id valid delete returns 200 contract", async () => {
    const res = await request(app).delete("/tables/1").set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expectContract("/tables/{id}", "delete", res.status, res.body);
    expect(tables.has(1)).toBe(false);
  });

  test.each([
    [{ capacity: 4 }],
    [{ table_number: "C3" }],
    [{ table_number: null, capacity: 4 }],
    [{ table_number: "C3", capacity: null }],
    [{ table_number: 123, capacity: 4 }],
    [{ table_number: "C3", capacity: "4" }],
    [{ table_number: "", capacity: 4 }],
    [{ table_number: " ", capacity: 4 }],
    [{ table_number: "A", capacity: 4 }],
    [{ table_number: "A".repeat(21), capacity: 4 }],
    [{ table_number: "C3", capacity: 0 }],
    [{ table_number: "C3", capacity: -1 }],
    [{ table_number: "C3", capacity: 2.5 }]
  ])("POST /tables invalid payload %j -> 400 no insert", async (payload) => {
    const beforeCount = tables.size;
    const res = await request(app).post("/tables").set("Authorization", `Bearer ${managerToken}`).send(payload);

    expect(res.status).toBe(400);
    expectContract("/tables", "post", res.status, res.body);
    expect(tableService.createTable).not.toHaveBeenCalled();
    expect(tables.size).toBe(beforeCount);
  });

  test("POST /tables duplicate table_number -> 409 conflict", async () => {
    const beforeCount = tables.size;
    const res = await request(app)
      .post("/tables")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ table_number: "A1", capacity: 4 });

    expect(res.status).toBe(409);
    expectContract("/tables", "post", res.status, res.body);
    expect(tables.size).toBe(beforeCount);
  });

  test.each([
    [{}, 1],
    [{ table_number: null }, 1],
    [{ capacity: null }, 1],
    [{ table_number: " " }, 1],
    [{ table_number: "A" }, 1],
    [{ table_number: "A".repeat(21) }, 1],
    [{ capacity: 0 }, 1],
    [{ capacity: -2 }, 1],
    [{ capacity: "5" }, 1],
    [{ capacity: 3.5 }, 1]
  ])("PUT /tables/:id invalid payload %j -> 400 no mutation", async (payload, id) => {
    const before = { ...tables.get(id) };
    const res = await request(app)
      .put(`/tables/${id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expectContract("/tables/{id}", "put", res.status, res.body);
    expect(tableService.updateTable).not.toHaveBeenCalled();
    expect(tables.get(id)).toEqual(before);
  });

  test("PUT /tables/:id duplicate table_number -> 409 conflict no mutation", async () => {
    const before = { ...tables.get(1) };
    const res = await request(app)
      .put("/tables/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ table_number: "B2" });

    expect(res.status).toBe(409);
    expectContract("/tables/{id}", "put", res.status, res.body);
    expect(tables.get(1)).toEqual(before);
  });

  test.each([
    ["get", "/tables/abc", "/tables/{id}"],
    ["put", "/tables/abc", "/tables/{id}"],
    ["delete", "/tables/abc", "/tables/{id}"]
  ])("Malformed id on %s %s -> 400", async (method, route, specPath) => {
    const beforeTables = JSON.stringify(Array.from(tables.values()));
    let req = request(app)[method](route).set("Authorization", `Bearer ${managerToken}`);
    if (method === "put") req = req.send({ capacity: 5 });
    const res = await req;

    expect(res.status).toBe(400);
    expectContract(specPath, method, res.status, res.body);
    expect(JSON.stringify(Array.from(tables.values()))).toBe(beforeTables);
  });

  test("GET /tables/:id not found -> 404", async () => {
    const res = await request(app).get("/tables/999").set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
    expectContract("/tables/{id}", "get", res.status, res.body);
  });

  test("PUT /tables/:id not found -> 404 no mutation", async () => {
    const beforeTables = JSON.stringify(Array.from(tables.values()));
    const res = await request(app)
      .put("/tables/999")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ capacity: 10 });

    expect(res.status).toBe(404);
    expectContract("/tables/{id}", "put", res.status, res.body);
    expect(JSON.stringify(Array.from(tables.values()))).toBe(beforeTables);
  });

  test("DELETE /tables/:id not found -> 404 no deletion", async () => {
    const beforeCount = tables.size;
    const res = await request(app).delete("/tables/999").set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
    expectContract("/tables/{id}", "delete", res.status, res.body);
    expect(tables.size).toBe(beforeCount);
  });

  test("DELETE /tables/:id referenced by orders -> 409 and not deleted", async () => {
    const beforeCount = tables.size;
    const res = await request(app).delete("/tables/2").set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(409);
    expectContract("/tables/{id}", "delete", res.status, res.body);
    expect(tables.size).toBe(beforeCount);
    expect(tables.has(2)).toBe(true);
  });

  test.each([
    ["post", "/tables", null, { table_number: "C3", capacity: 4 }, "/tables"],
    ["get", "/tables", null, null, "/tables"],
    ["delete", "/tables/1", null, null, "/tables/{id}"]
  ])("%s %s missing token -> 401 no mutation", async (method, route, _auth, payload, specPath) => {
    const beforeTables = JSON.stringify(Array.from(tables.values()));
    let req = request(app)[method](route);
    if (payload) req = req.send(payload);
    const res = await req;

    expect(res.status).toBe(401);
    expectContract(specPath, method, res.status, res.body);
    expect(JSON.stringify(Array.from(tables.values()))).toBe(beforeTables);
  });

  test.each([
    ["post", "/tables", { table_number: "C3", capacity: 4 }, "/tables"],
    ["put", "/tables/1", { capacity: 9 }, "/tables/{id}"],
    ["delete", "/tables/1", null, "/tables/{id}"]
  ])("%s malformed token -> 401", async (method, route, payload, specPath) => {
    const beforeTables = JSON.stringify(Array.from(tables.values()));
    let req = request(app)[method](route).set("Authorization", `Token ${managerToken}`);
    if (payload) req = req.send(payload);
    const res = await req;

    expect(res.status).toBe(401);
    expectContract(specPath, method, res.status, res.body);
    expect(JSON.stringify(Array.from(tables.values()))).toBe(beforeTables);
  });

  test.each([
    ["post", "/tables", waiterToken, { table_number: "C3", capacity: 4 }, "/tables"],
    ["put", "/tables/1", waiterToken, { capacity: 9 }, "/tables/{id}"],
    ["delete", "/tables/1", waiterToken, null, "/tables/{id}"],
    ["post", "/tables", bartenderToken, { table_number: "C3", capacity: 4 }, "/tables"]
  ])("%s wrong role -> 403 no mutation", async (method, route, token, payload, specPath) => {
    const beforeTables = JSON.stringify(Array.from(tables.values()));
    let req = request(app)[method](route).set("Authorization", `Bearer ${token}`);
    if (payload) req = req.send(payload);
    const res = await req;

    expect(res.status).toBe(403);
    expectContract(specPath, method, res.status, res.body);
    expect(JSON.stringify(Array.from(tables.values()))).toBe(beforeTables);
  });

  test("GET /tables wrong role (BARTENDER) -> 403", async () => {
    const res = await request(app).get("/tables").set("Authorization", `Bearer ${bartenderToken}`);

    expect(res.status).toBe(403);
    expectContract("/tables", "get", res.status, res.body);
  });

  test("PUT /tables/:id repeated same payload is consistent", async () => {
    const first = await request(app)
      .put("/tables/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ capacity: 10 });

    const snapshot = { ...tables.get(1) };

    const second = await request(app)
      .put("/tables/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ capacity: 10 });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expectContract("/tables/{id}", "put", first.status, first.body);
    expectContract("/tables/{id}", "put", second.status, second.body);
    expect(tables.get(1)).toEqual(snapshot);
  });

  test("DELETE /tables/:id repeated behavior consistent (200 then 404)", async () => {
    const first = await request(app).delete("/tables/1").set("Authorization", `Bearer ${managerToken}`);
    const second = await request(app).delete("/tables/1").set("Authorization", `Bearer ${managerToken}`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(404);
    expectContract("/tables/{id}", "delete", first.status, first.body);
    expectContract("/tables/{id}", "delete", second.status, second.body);
  });

  test("already-deleted table get behavior consistent (404)", async () => {
    await request(app).delete("/tables/1").set("Authorization", `Bearer ${managerToken}`);
    const res = await request(app).get("/tables/1").set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
    expectContract("/tables/{id}", "get", res.status, res.body);
  });
});
