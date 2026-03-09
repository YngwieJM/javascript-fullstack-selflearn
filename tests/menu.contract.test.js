const fs = require("fs");
const path = require("path");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/env");
const { errorHandler } = require("../middleware/error.middleware");

jest.mock("../services/menu.service", () => ({
  createMenuItem: jest.fn(),
  getAllMenuItems: jest.fn(),
  getMenuItemById: jest.fn(),
  updateMenuItem: jest.fn(),
  toggleAvailability: jest.fn(),
  deleteMenuItem: jest.fn()
}));

const menuService = require("../services/menu.service");
const menuRoutes = require("../routes/menu.routes");

const openapi = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "docs", "openapi.menu.json"), "utf8")
);

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/menu", menuRoutes);
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

  const schema = response.content?.["application/json"]?.schema;
  return schema || null;
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

describe("Menu contract tests", () => {
  let app;
  let menuState;
  let consoleSpy;
  const managerToken = makeToken("MANAGER");
  const waiterToken = makeToken("WAITER");
  const bartenderToken = makeToken("BARTENDER");
  const chefToken = makeToken("CHEF");

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    menuState = {
      1: { id: 1, name: "Burger", category: "FOOD", price: 50, is_available: true }
    };

    menuService.createMenuItem.mockImplementation(async (name, category, price) => {
      const id = Math.max(...Object.keys(menuState).map(Number)) + 1;
      const item = { id, name, category, price, is_available: true };
      menuState[id] = item;
      return item;
    });

    menuService.getAllMenuItems.mockImplementation(async () => Object.values(menuState));

    menuService.getMenuItemById.mockImplementation(async (id) => {
      const item = menuState[Number(id)];
      if (!item) throw new Error("MENU_ITEM_NOT_FOUND");
      return item;
    });

    menuService.updateMenuItem.mockImplementation(async (id, name, category, price) => {
      const item = menuState[Number(id)];
      if (!item) throw new Error("MENU_ITEM_NOT_FOUND");
      if (name !== undefined) item.name = name;
      if (category !== undefined) item.category = category;
      if (price !== undefined) item.price = price;
      return { ...item };
    });

    menuService.toggleAvailability.mockImplementation(async (id, is_available) => {
      const item = menuState[Number(id)];
      if (!item) throw new Error("MENU_ITEM_NOT_FOUND");
      item.is_available = is_available;
      return { ...item };
    });

    menuService.deleteMenuItem.mockImplementation(async (id) => {
      const item = menuState[Number(id)];
      if (!item) throw new Error("MENU_ITEM_NOT_FOUND");
      delete menuState[Number(id)];
      return item;
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    jest.clearAllMocks();
  });

  test("GET /menu valid list returns 200 contract", async () => {
    const res = await request(app).get("/menu").set("Authorization", `Bearer ${waiterToken}`);

    expect(res.status).toBe(200);
    expectContract("/menu", "get", res.status, res.body);
  });

  test("GET /menu/:id valid get returns 200 contract", async () => {
    const res = await request(app).get("/menu/1").set("Authorization", `Bearer ${bartenderToken}`);

    expect(res.status).toBe(200);
    expectContract("/menu/{id}", "get", res.status, res.body);
  });

  test("POST /menu valid create returns 201 contract", async () => {
    const res = await request(app)
      .post("/menu")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Tea", category: "DRINK", price: 12 });

    expect(res.status).toBe(201);
    expectContract("/menu", "post", res.status, res.body);
  });

  test("POST /menu price=0 is valid", async () => {
    const res = await request(app)
      .post("/menu")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Water", category: "DRINK", price: 0 });

    expect(res.status).toBe(201);
    expectContract("/menu", "post", res.status, res.body);
    expect(res.body.price).toBe(0);
  });

  test("POST /menu decimal price is accepted", async () => {
    const res = await request(app)
      .post("/menu")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Juice", category: "DRINK", price: 12.5 });

    expect(res.status).toBe(201);
    expectContract("/menu", "post", res.status, res.body);
    expect(res.body.price).toBe(12.5);
  });

  test("POST /menu very large price boundary is accepted", async () => {
    const res = await request(app)
      .post("/menu")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Gold Steak", category: "FOOD", price: 9999999999.99 });

    expect(res.status).toBe(201);
    expectContract("/menu", "post", res.status, res.body);
  });

  test("PATCH /menu/:id valid update returns 200 contract", async () => {
    const res = await request(app)
      .patch("/menu/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ price: 60 });

    expect(res.status).toBe(200);
    expectContract("/menu/{id}", "patch", res.status, res.body);
    expect(menuState[1].price).toBe(60);
  });

  test("PATCH /menu/:id/availability valid update returns 200 contract", async () => {
    const res = await request(app)
      .patch("/menu/1/availability")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ is_available: false });

    expect(res.status).toBe(200);
    expectContract("/menu/{id}/availability", "patch", res.status, res.body);
    expect(menuState[1].is_available).toBe(false);
  });

  test("DELETE /menu/:id valid delete returns 200 contract", async () => {
    const res = await request(app).delete("/menu/1").set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expectContract("/menu/{id}", "delete", res.status, res.body);
    expect(menuState[1]).toBeUndefined();
  });

  test.each([
    [{ category: "FOOD", price: 10 }],
    [{ name: "Burger", price: 10 }],
    [{ name: "Burger", category: "FOOD" }]
  ])("POST /menu missing required fields %j", async (payload) => {
    const before = Object.keys(menuState).length;
    const res = await request(app).post("/menu").set("Authorization", `Bearer ${managerToken}`).send(payload);

    expect(res.status).toBe(400);
    expectContract("/menu", "post", res.status, res.body);
    expect(menuService.createMenuItem).not.toHaveBeenCalled();
    expect(Object.keys(menuState).length).toBe(before);
  });

  test.each([
    [{ name: null, category: "FOOD", price: 10 }],
    [{ name: "Burger", category: null, price: 10 }],
    [{ name: "Burger", category: "FOOD", price: null }],
    [{ name: undefined, category: "FOOD", price: 10 }],
    [{ name: "Burger", category: undefined, price: 10 }],
    [{ name: "Burger", category: "FOOD", price: undefined }]
  ])("POST /menu null/undefined fields %j", async (payload) => {
    const before = Object.keys(menuState).length;
    const res = await request(app).post("/menu").set("Authorization", `Bearer ${managerToken}`).send(payload);

    expect(res.status).toBe(400);
    expectContract("/menu", "post", res.status, res.body);
    expect(menuService.createMenuItem).not.toHaveBeenCalled();
    expect(Object.keys(menuState).length).toBe(before);
  });

  test.each([
    [{ name: 123, category: "FOOD", price: 10 }],
    [{ name: "Burger", category: 123, price: 10 }],
    [{ name: "Burger", category: "FOOD", price: "10" }]
  ])("POST /menu wrong field types %j", async (payload) => {
    const before = Object.keys(menuState).length;
    const res = await request(app).post("/menu").set("Authorization", `Bearer ${managerToken}`).send(payload);

    expect(res.status).toBe(400);
    expectContract("/menu", "post", res.status, res.body);
    expect(menuService.createMenuItem).not.toHaveBeenCalled();
    expect(Object.keys(menuState).length).toBe(before);
  });

  test.each([
    [{ name: "", category: "FOOD", price: 10 }],
    [{ name: "Burger", category: "", price: 10 }]
  ])("POST /menu empty strings %j", async (payload) => {
    const before = Object.keys(menuState).length;
    const res = await request(app).post("/menu").set("Authorization", `Bearer ${managerToken}`).send(payload);

    expect(res.status).toBe(400);
    expectContract("/menu", "post", res.status, res.body);
    expect(menuService.createMenuItem).not.toHaveBeenCalled();
    expect(Object.keys(menuState).length).toBe(before);
  });

  test.each([
    [{ name: "   ", category: "FOOD", price: 10 }],
    [{ name: "Burger", category: "   ", price: 10 }]
  ])("POST /menu whitespace-only strings %j", async (payload) => {
    const before = Object.keys(menuState).length;
    const res = await request(app).post("/menu").set("Authorization", `Bearer ${managerToken}`).send(payload);

    expect(res.status).toBe(400);
    expectContract("/menu", "post", res.status, res.body);
    expect(menuService.createMenuItem).not.toHaveBeenCalled();
    expect(Object.keys(menuState).length).toBe(before);
  });

  test("POST /menu negative price must fail", async () => {
    const before = Object.keys(menuState).length;
    const res = await request(app)
      .post("/menu")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Bad", category: "FOOD", price: -1 });

    expect(res.status).toBe(400);
    expectContract("/menu", "post", res.status, res.body);
    expect(menuService.createMenuItem).not.toHaveBeenCalled();
    expect(Object.keys(menuState).length).toBe(before);
  });

  test("POST /menu NaN or invalid numeric input must fail", async () => {
    const before = Object.keys(menuState).length;
    const res = await request(app)
      .post("/menu")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Bad", category: "FOOD", price: Number.NaN });

    expect(res.status).toBe(400);
    expectContract("/menu", "post", res.status, res.body);
    expect(menuService.createMenuItem).not.toHaveBeenCalled();
    expect(Object.keys(menuState).length).toBe(before);
  });

  test("PATCH /menu/:id invalid category must fail", async () => {
    const before = { ...menuState[1] };
    const res = await request(app)
      .patch("/menu/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ category: "SNACK" });

    expect(res.status).toBe(400);
    expectContract("/menu/{id}", "patch", res.status, res.body);
    expect(menuService.updateMenuItem).not.toHaveBeenCalled();
    expect(menuState[1]).toEqual(before);
  });

  test.each([
    ["/menu/abc", "get"],
    ["/menu/abc", "patch"],
    ["/menu/abc", "delete"],
    ["/menu/abc/availability", "patch"]
  ])("Malformed menu id on %s %s returns 400", async (targetPath, method) => {
    const before = { ...menuState[1] };
    const req = request(app)[method](targetPath).set("Authorization", `Bearer ${managerToken}`);
    if (targetPath.endsWith("/availability")) req.send({ is_available: true });
    if (method === "patch" && !targetPath.endsWith("/availability")) req.send({ price: 55 });
    const res = await req;

    expect(res.status).toBe(400);
    expectContract(
      targetPath.endsWith("/availability") ? "/menu/{id}/availability" : "/menu/{id}",
      method,
      res.status,
      res.body
    );
    expect(menuState[1]).toEqual(before);
  });

  test("GET /menu/:id not found returns 404 contract", async () => {
    const res = await request(app).get("/menu/999").set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
    expectContract("/menu/{id}", "get", res.status, res.body);
  });

  test("PATCH /menu/:id not found returns 404 and state unchanged", async () => {
    const before = { ...menuState[1] };
    const res = await request(app)
      .patch("/menu/999")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ price: 100 });

    expect(res.status).toBe(404);
    expectContract("/menu/{id}", "patch", res.status, res.body);
    expect(menuState[1]).toEqual(before);
  });

  test("DELETE /menu/:id not found returns 404 and no delete mutation", async () => {
    const beforeCount = Object.keys(menuState).length;
    const res = await request(app).delete("/menu/999").set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
    expectContract("/menu/{id}", "delete", res.status, res.body);
    expect(Object.keys(menuState).length).toBe(beforeCount);
  });

  test("POST /menu duplicate conflict returns 409 contract", async () => {
    const duplicateErr = new Error("duplicate");
    duplicateErr.code = "23505";
    menuService.createMenuItem.mockRejectedValueOnce(duplicateErr);

    const res = await request(app)
      .post("/menu")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Burger", category: "FOOD", price: 50 });

    expect(res.status).toBe(409);
    expectContract("/menu", "post", res.status, res.body);
  });

  test("POST /menu missing token returns 401 and no mutation", async () => {
    const before = Object.keys(menuState).length;
    const res = await request(app).post("/menu").send({ name: "Tea", category: "DRINK", price: 10 });

    expect(res.status).toBe(401);
    expectContract("/menu", "post", res.status, res.body);
    expect(menuService.createMenuItem).not.toHaveBeenCalled();
    expect(Object.keys(menuState).length).toBe(before);
  });

  test("POST /menu malformed token returns 401 and no mutation", async () => {
    const before = Object.keys(menuState).length;
    const res = await request(app)
      .post("/menu")
      .set("Authorization", `Token ${managerToken}`)
      .send({ name: "Tea", category: "DRINK", price: 10 });

    expect(res.status).toBe(401);
    expectContract("/menu", "post", res.status, res.body);
    expect(menuService.createMenuItem).not.toHaveBeenCalled();
    expect(Object.keys(menuState).length).toBe(before);
  });

  test.each([
    ["POST /menu", "post", "/menu", waiterToken, { name: "Tea", category: "DRINK", price: 10 }],
    ["PATCH /menu/:id", "patch", "/menu/1", bartenderToken, { price: 10 }],
    ["DELETE /menu/:id", "delete", "/menu/1", waiterToken, null]
  ])("%s wrong role returns 403 and no mutation", async (name, method, route, token, payload) => {
    const before = menuState[1] ? { ...menuState[1] } : undefined;
    const req = request(app)[method](route).set("Authorization", `Bearer ${token}`);
    if (payload) req.send(payload);
    const res = await req;

    expect(res.status).toBe(403);
    expectContract(route === "/menu" ? "/menu" : "/menu/{id}", method, res.status, res.body);
    if (before) expect(menuState[1]).toEqual(before);
  });

  test("GET /menu wrong role returns 403", async () => {
    const res = await request(app).get("/menu").set("Authorization", `Bearer ${chefToken}`);

    expect(res.status).toBe(403);
    expectContract("/menu", "get", res.status, res.body);
  });

  test("PATCH /menu/:id invalid update must not change data", async () => {
    const before = { ...menuState[1] };
    const res = await request(app)
      .patch("/menu/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({});

    expect(res.status).toBe(400);
    expectContract("/menu/{id}", "patch", res.status, res.body);
    expect(menuService.updateMenuItem).not.toHaveBeenCalled();
    expect(menuState[1]).toEqual(before);
  });

  test("DELETE /menu/:id repeated behavior is consistent (200 then 404)", async () => {
    const first = await request(app).delete("/menu/1").set("Authorization", `Bearer ${managerToken}`);
    const second = await request(app).delete("/menu/1").set("Authorization", `Bearer ${managerToken}`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(404);
    expectContract("/menu/{id}", "delete", first.status, first.body);
    expectContract("/menu/{id}", "delete", second.status, second.body);
  });

  test("PATCH /menu/:id repeated behavior is idempotent with same payload", async () => {
    const first = await request(app)
      .patch("/menu/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ price: 75 });

    const afterFirst = { ...menuState[1] };

    const second = await request(app)
      .patch("/menu/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ price: 75 });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expectContract("/menu/{id}", "patch", first.status, first.body);
    expectContract("/menu/{id}", "patch", second.status, second.body);
    expect(menuState[1]).toEqual(afterFirst);
  });
});
