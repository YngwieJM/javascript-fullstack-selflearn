const fs = require("fs");
const path = require("path");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/env");
const { errorHandler } = require("../middleware/error.middleware");

jest.mock("../services/orders.service", () => ({
  createOrder: jest.fn(),
  addItemToOrder: jest.fn(),
  getAllOrders: jest.fn(),
  getOrderById: jest.fn(),
  closeOrder: jest.fn(),
  deleteOrder: jest.fn()
}));

const ordersService = require("../services/orders.service");
const ordersRoutes = require("../routes/orders.routes");

const openapi = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "docs", "openapi.orders.json"), "utf8")
);

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/orders", ordersRoutes);
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

describe("Orders contract tests", () => {
  let app;
  let consoleSpy;
  let nextOrderId;
  let nextOrderItemId;
  let validTables;
  let validStaff;
  let menuItems;
  let orders;
  let orderItems;
  const managerToken = makeToken("MANAGER", 1);
  const waiter1Token = makeToken("WAITER", 7);
  const waiter2Token = makeToken("WAITER", 8);
  const bartenderToken = makeToken("BARTENDER", 9);

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    nextOrderId = 3;
    nextOrderItemId = 3;

    validTables = new Set([1, 2]);
    validStaff = new Set([1, 7, 8]);
    menuItems = new Map([
      [1, { id: 1, name: "Burger", price: 50, is_available: true }],
      [2, { id: 2, name: "Cola", price: 20, is_available: true }],
      [3, { id: 3, name: "Hidden", price: 15, is_available: false }]
    ]);

    orders = [
      { id: 1, table_id: 1, staff_id: 7, status: "OPEN", created_at: "2026-03-10T10:00:00.000Z" },
      { id: 2, table_id: 2, staff_id: 8, status: "OPEN", created_at: "2026-03-10T10:05:00.000Z" }
    ];

    orderItems = [
      { id: 1, order_id: 1, menu_item_id: 1, quantity: 1, price_at_time: 50 },
      { id: 2, order_id: 2, menu_item_id: 2, quantity: 1, price_at_time: 20 }
    ];

    ordersService.createOrder.mockImplementation(async (table_id, staff_id, requester) => {
      const isWaiter = requester && requester.role === "WAITER";
      const effectiveStaffId = isWaiter ? requester.id : staff_id;

      if (!isWaiter && !effectiveStaffId) {
        throw new Error("STAFF_ID_REQUIRED");
      }
      if (!validTables.has(table_id)) {
        throw new Error("TABLE_NOT_FOUND");
      }
      if (!validStaff.has(effectiveStaffId)) {
        throw new Error("STAFF_NOT_FOUND");
      }

      const created = {
        id: nextOrderId++,
        table_id,
        staff_id: effectiveStaffId,
        status: "OPEN",
        created_at: "2026-03-10T10:10:00.000Z"
      };
      orders.push(created);
      return created;
    });

    ordersService.addItemToOrder.mockImplementation(async (orderId, menu_item_id, quantity, requester) => {
      if (!quantity || quantity <= 0) {
        throw new Error("INVALID_QUANTITY");
      }

      const order = orders.find((o) => o.id === Number(orderId));
      if (!order) {
        throw new Error("ORDER_NOT_FOUND");
      }

      if (requester && requester.role === "WAITER" && Number(order.staff_id) !== Number(requester.id)) {
        throw new Error("ORDER_FORBIDDEN");
      }

      if (order.status !== "OPEN") {
        throw new Error("ORDER_CLOSED");
      }

      const menu = menuItems.get(menu_item_id);
      if (!menu || !menu.is_available) {
        throw new Error("MENU_NOT_AVAILABLE");
      }

      const row = {
        id: nextOrderItemId++,
        order_id: Number(orderId),
        menu_item_id,
        quantity,
        price_at_time: menu.price
      };
      orderItems.push(row);
      return row;
    });

    ordersService.getAllOrders.mockImplementation(async () =>
      orders.map((o) => ({
        id: o.id,
        status: o.status,
        created_at: o.created_at,
        table_number: `T${o.table_id}`,
        staff_name: `Staff-${o.staff_id}`
      }))
    );

    ordersService.getOrderById.mockImplementation(async (orderId, requester) => {
      const order = orders.find((o) => o.id === Number(orderId));
      if (!order) throw new Error("ORDER_NOT_FOUND");

      if (requester && requester.role === "WAITER" && Number(order.staff_id) !== Number(requester.id)) {
        throw new Error("ORDER_FORBIDDEN");
      }

      const items = orderItems
        .filter((i) => i.order_id === Number(orderId))
        .map((i) => ({
          id: i.id,
          name: menuItems.get(i.menu_item_id)?.name || "Unknown",
          quantity: i.quantity,
          price_at_time: i.price_at_time,
          subtotal: i.quantity * i.price_at_time
        }));

      const total = items.reduce((sum, item) => sum + Number(item.subtotal), 0);

      return {
        id: order.id,
        status: order.status,
        created_at: order.created_at,
        staff_id: order.staff_id,
        table_number: `T${order.table_id}`,
        staff_name: `Staff-${order.staff_id}`,
        items,
        total
      };
    });

    ordersService.closeOrder.mockImplementation(async (orderId, requester) => {
      const order = orders.find((o) => o.id === Number(orderId));
      if (!order) throw new Error("ORDER_NOT_FOUND_OR_ALREADY_CLOSED");

      if (requester && requester.role === "WAITER" && Number(order.staff_id) !== Number(requester.id)) {
        throw new Error("ORDER_FORBIDDEN");
      }

      if (order.status !== "OPEN") throw new Error("ORDER_NOT_FOUND_OR_ALREADY_CLOSED");

      order.status = "CLOSED";
      return { ...order };
    });

    ordersService.deleteOrder.mockImplementation(async (orderId) => {
      const idx = orders.findIndex((o) => o.id === Number(orderId));
      if (idx < 0) throw new Error("ORDER_NOT_FOUND");

      const [removed] = orders.splice(idx, 1);
      orderItems = orderItems.filter((item) => item.order_id !== removed.id);
      return removed;
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    jest.clearAllMocks();
  });

  test("POST /orders valid create order (manager) returns 201 contract", async () => {
    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ table_id: 1, staff_id: 7 });

    expect(res.status).toBe(201);
    expectContract("/orders", "post", res.status, res.body);
  });

  test("POST /orders valid create order (waiter without staff_id) returns 201", async () => {
    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${waiter1Token}`)
      .send({ table_id: 1 });

    expect(res.status).toBe(201);
    expect(res.body.order.staff_id).toBe(7);
    expectContract("/orders", "post", res.status, res.body);
  });

  test("GET /orders valid manager list returns 200 contract", async () => {
    const res = await request(app).get("/orders").set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expectContract("/orders", "get", res.status, res.body);
  });

  test("GET /orders/:id valid get order returns 200 contract", async () => {
    const res = await request(app).get("/orders/1").set("Authorization", `Bearer ${waiter1Token}`);

    expect(res.status).toBe(200);
    expectContract("/orders/{id}", "get", res.status, res.body);
  });

  test("POST /orders/:id/items valid add item returns 201 contract", async () => {
    const res = await request(app)
      .post("/orders/1/items")
      .set("Authorization", `Bearer ${waiter1Token}`)
      .send({ menu_item_id: 2, quantity: 2 });

    expect(res.status).toBe(201);
    expectContract("/orders/{id}/items", "post", res.status, res.body);
  });

  test("PATCH /orders/:id/close valid status change returns 200 contract", async () => {
    const res = await request(app)
      .patch("/orders/1/close")
      .set("Authorization", `Bearer ${waiter1Token}`);

    expect(res.status).toBe(200);
    expectContract("/orders/{id}/close", "patch", res.status, res.body);
    expect(orders.find((o) => o.id === 1).status).toBe("CLOSED");
  });

  test("DELETE /orders/:id valid delete returns 200 contract", async () => {
    const beforeCount = orders.length;
    const res = await request(app).delete("/orders/2").set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expectContract("/orders/{id}", "delete", res.status, res.body);
    expect(orders.length).toBe(beforeCount - 1);
  });

  test.each([
    [{ staff_id: 7 }],
    [{ table_id: null, staff_id: 7 }],
    [{ table_id: "1", staff_id: 7 }],
    [{ table_id: 1.5, staff_id: 7 }],
    [{ table_id: 0, staff_id: 7 }],
    [null],
    [[]]
  ])("POST /orders invalid create payload %j -> 400 with no mutation", async (payload) => {
    const beforeCount = orders.length;
    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expectContract("/orders", "post", res.status, res.body);
    expect(orders.length).toBe(beforeCount);
    expect(ordersService.createOrder).not.toHaveBeenCalled();
  });

  test("POST /orders manager missing staff_id -> 400 and no inserted row", async () => {
    const beforeCount = orders.length;
    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ table_id: 1 });

    expect(res.status).toBe(400);
    expectContract("/orders", "post", res.status, res.body);
    expect(orders.length).toBe(beforeCount);
  });

  test("POST /orders invalid table_id -> 404 and failed create leaves no partial rows", async () => {
    const beforeCount = orders.length;
    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ table_id: 999, staff_id: 7 });

    expect(res.status).toBe(404);
    expectContract("/orders", "post", res.status, res.body);
    expect(orders.length).toBe(beforeCount);
  });

  test.each([
    [{ menu_item_id: 2 }],
    [{ quantity: 1 }],
    [{ menu_item_id: null, quantity: 1 }],
    [{ menu_item_id: 2, quantity: null }],
    [{ menu_item_id: "2", quantity: 1 }],
    [{ menu_item_id: 2, quantity: "1" }],
    [{ menu_item_id: 2, quantity: 0 }],
    [{ menu_item_id: 2, quantity: -1 }],
    [[]]
  ])("POST /orders/:id/items invalid payload %j -> 400 and no partial insert", async (payload) => {
    const beforeItems = orderItems.length;
    const res = await request(app)
      .post("/orders/1/items")
      .set("Authorization", `Bearer ${waiter1Token}`)
      .send(payload);

    expect(res.status).toBe(400);
    expectContract("/orders/{id}/items", "post", res.status, res.body);
    expect(orderItems.length).toBe(beforeItems);
    expect(ordersService.addItemToOrder).not.toHaveBeenCalled();
  });

  test("POST /orders/:id/items invalid menu_item_id -> 400 and no partial insert", async () => {
    const beforeItems = orderItems.length;
    const res = await request(app)
      .post("/orders/1/items")
      .set("Authorization", `Bearer ${waiter1Token}`)
      .send({ menu_item_id: 999, quantity: 1 });

    expect(res.status).toBe(400);
    expectContract("/orders/{id}/items", "post", res.status, res.body);
    expect(orderItems.length).toBe(beforeItems);
  });

  test("POST /orders/:id/items unavailable menu item -> 400 and no partial insert", async () => {
    const beforeItems = orderItems.length;
    const res = await request(app)
      .post("/orders/1/items")
      .set("Authorization", `Bearer ${waiter1Token}`)
      .send({ menu_item_id: 3, quantity: 1 });

    expect(res.status).toBe(400);
    expectContract("/orders/{id}/items", "post", res.status, res.body);
    expect(orderItems.length).toBe(beforeItems);
  });

  test("POST /orders/:id/items order not found -> 404", async () => {
    const beforeItems = orderItems.length;
    const res = await request(app)
      .post("/orders/999/items")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ menu_item_id: 2, quantity: 1 });

    expect(res.status).toBe(404);
    expectContract("/orders/{id}/items", "post", res.status, res.body);
    expect(orderItems.length).toBe(beforeItems);
  });

  test.each([
    ["get", "/orders/abc", "/orders/{id}"],
    ["post", "/orders/abc/items", "/orders/{id}/items"],
    ["patch", "/orders/abc/close", "/orders/{id}/close"],
    ["delete", "/orders/abc", "/orders/{id}"]
  ])("Malformed route param on %s %s -> 400", async (method, route, specPath) => {
    const beforeOrders = orders.length;
    const beforeItems = orderItems.length;
    let req = request(app)[method](route).set("Authorization", `Bearer ${managerToken}`);
    if (method === "post") req = req.send({ menu_item_id: 2, quantity: 1 });
    const res = await req;

    expect(res.status).toBe(400);
    expectContract(specPath, method, res.status, res.body);
    expect(orders.length).toBe(beforeOrders);
    expect(orderItems.length).toBe(beforeItems);
  });

  test("GET /orders/:id not found -> 404", async () => {
    const res = await request(app).get("/orders/999").set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
    expectContract("/orders/{id}", "get", res.status, res.body);
  });

  test("PATCH /orders/:id/close invalid status transition on closed order -> 404", async () => {
    orders.find((o) => o.id === 1).status = "CLOSED";

    const res = await request(app)
      .patch("/orders/1/close")
      .set("Authorization", `Bearer ${waiter1Token}`);

    expect(res.status).toBe(404);
    expectContract("/orders/{id}/close", "patch", res.status, res.body);
    expect(orders.find((o) => o.id === 1).status).toBe("CLOSED");
  });

  test("DELETE /orders/:id not found -> 404", async () => {
    const beforeCount = orders.length;
    const res = await request(app).delete("/orders/999").set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
    expectContract("/orders/{id}", "delete", res.status, res.body);
    expect(orders.length).toBe(beforeCount);
  });

  test.each([
    ["missing", undefined, 401, "No token provided"],
    ["malformed", `Token ${managerToken}`, 401, "Malformed authorization header"],
    ["invalid", "Bearer not.a.real.token", 401, "Invalid or expired token"]
  ])("POST /orders auth failure %s -> 401 no mutation", async (kind, authHeader, status, message) => {
    const beforeCount = orders.length;
    const req = request(app).post("/orders").send({ table_id: 1, staff_id: 7 });
    if (authHeader) req.set("Authorization", authHeader);
    const res = await req;

    expect(res.status).toBe(status);
    expect(res.body.message).toBe(message);
    expectContract("/orders", "post", res.status, res.body);
    expect(orders.length).toBe(beforeCount);
  });

  test.each([
    ["POST /orders", "post", "/orders", bartenderToken, { table_id: 1, staff_id: 7 }],
    ["GET /orders", "get", "/orders", waiter1Token, null],
    ["PATCH /orders/:id/close", "patch", "/orders/1/close", bartenderToken, null],
    ["DELETE /orders/:id", "delete", "/orders/1", waiter1Token, null]
  ])("%s wrong role -> 403 and no mutation", async (name, method, route, token, payload) => {
    const beforeOrders = JSON.stringify(orders);
    const beforeItems = JSON.stringify(orderItems);
    let req = request(app)[method](route).set("Authorization", `Bearer ${token}`);
    if (payload) req = req.send(payload);
    const res = await req;

    expect(res.status).toBe(403);
    expectContract(route === "/orders" ? "/orders" : route.includes("/close") ? "/orders/{id}/close" : "/orders/{id}", method, res.status, res.body);
    expect(JSON.stringify(orders)).toBe(beforeOrders);
    expect(JSON.stringify(orderItems)).toBe(beforeItems);
  });

  test("WAITER cannot access another waiter's order by changing id -> 403", async () => {
    const res = await request(app).get("/orders/2").set("Authorization", `Bearer ${waiter1Token}`);

    expect(res.status).toBe(403);
    expectContract("/orders/{id}", "get", res.status, res.body);
  });

  test("WAITER cannot add item to another waiter's order -> 403 and no mutation", async () => {
    const beforeItems = orderItems.length;
    const res = await request(app)
      .post("/orders/2/items")
      .set("Authorization", `Bearer ${waiter1Token}`)
      .send({ menu_item_id: 2, quantity: 1 });

    expect(res.status).toBe(403);
    expectContract("/orders/{id}/items", "post", res.status, res.body);
    expect(orderItems.length).toBe(beforeItems);
  });

  test("WAITER cannot close another waiter's order -> 403 and state unchanged", async () => {
    const beforeStatus = orders.find((o) => o.id === 2).status;
    const res = await request(app)
      .patch("/orders/2/close")
      .set("Authorization", `Bearer ${waiter1Token}`);

    expect(res.status).toBe(403);
    expectContract("/orders/{id}/close", "patch", res.status, res.body);
    expect(orders.find((o) => o.id === 2).status).toBe(beforeStatus);
  });

  test("Repeated POST /orders behavior is consistent (creates new orders)", async () => {
    const payload = { table_id: 1, staff_id: 7 };
    const first = await request(app).post("/orders").set("Authorization", `Bearer ${managerToken}`).send(payload);
    const second = await request(app).post("/orders").set("Authorization", `Bearer ${managerToken}`).send(payload);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.order.id).not.toBe(second.body.order.id);
    expectContract("/orders", "post", first.status, first.body);
    expectContract("/orders", "post", second.status, second.body);
  });

  test("Repeated PATCH /orders/:id/close behavior is consistent (200 then 404)", async () => {
    const first = await request(app).patch("/orders/1/close").set("Authorization", `Bearer ${waiter1Token}`);
    const second = await request(app).patch("/orders/1/close").set("Authorization", `Bearer ${waiter1Token}`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(404);
    expectContract("/orders/{id}/close", "patch", first.status, first.body);
    expectContract("/orders/{id}/close", "patch", second.status, second.body);
  });

  test("Repeated DELETE /orders/:id behavior is consistent (200 then 404)", async () => {
    const first = await request(app).delete("/orders/2").set("Authorization", `Bearer ${managerToken}`);
    const second = await request(app).delete("/orders/2").set("Authorization", `Bearer ${managerToken}`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(404);
    expectContract("/orders/{id}", "delete", first.status, first.body);
    expectContract("/orders/{id}", "delete", second.status, second.body);
  });
});
