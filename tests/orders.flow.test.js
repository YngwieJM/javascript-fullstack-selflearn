const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/env");

jest.mock("../config/db", () => ({
  query: jest.fn(),
  connect: jest.fn()
}));

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
const { errorHandler } = require("../middleware/error.middleware");

function makeToken(role, id = 1) {
  return jwt.sign({ id, role }, jwtSecret, { expiresIn: "1h" });
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/orders", ordersRoutes);
  app.use(errorHandler);
  return app;
}

describe("Orders flow QA", () => {
  let app;
  const waiterToken = makeToken("WAITER");
  const managerToken = makeToken("MANAGER");
  const bartenderToken = makeToken("BARTENDER");

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    ordersService.createOrder.mockResolvedValue({ id: 1, table_id: 1, staff_id: 1, status: "OPEN" });
    ordersService.addItemToOrder.mockResolvedValue({ id: 1, order_id: 1, menu_item_id: 1, quantity: 1 });
    ordersService.getAllOrders.mockResolvedValue([]);
    ordersService.getOrderById.mockResolvedValue({ id: 1, items: [], total: 0 });
    ordersService.closeOrder.mockResolvedValue({ id: 1, status: "CLOSED" });
    ordersService.deleteOrder.mockResolvedValue({ id: 1, status: "OPEN" });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    ["WAITER", waiterToken],
    ["MANAGER", managerToken]
  ])("POST /orders allows authenticated %s with valid body", async (role, token) => {
    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ table_id: 1, staff_id: 1 });

    expect(res.status).toBe(201);
    expect(ordersService.createOrder).toHaveBeenCalledTimes(1);
    expect(ordersService.createOrder).toHaveBeenCalledWith(1, 1, expect.objectContaining({ role }));
  });

  test("POST /orders returns expected success message and order shape", async () => {
    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ table_id: 1, staff_id: 1 });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: "Order Created",
        order: expect.objectContaining({ id: 1, table_id: 1, staff_id: 1 })
      })
    );
  });

  test("POST /orders allows WAITER without staff_id in body", async () => {
    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ table_id: 1 });

    expect(res.status).toBe(201);
    expect(ordersService.createOrder).toHaveBeenCalledWith(1, undefined, expect.objectContaining({ role: "WAITER" }));
  });

  test("POST /orders returns 400 when MANAGER omits staff_id", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    ordersService.createOrder.mockRejectedValueOnce(new Error("STAFF_ID_REQUIRED"));

    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ table_id: 1 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Staff id is required for manager order creation");
    consoleSpy.mockRestore();
  });

  test.each([
    [{ table_id: null, staff_id: 1 }],
    [{ table_id: undefined, staff_id: 1 }],
    [{ table_id: "1", staff_id: 1 }],
    [{ table_id: "   ", staff_id: 1 }],
    [{ table_id: 1.5, staff_id: 1 }],
    [{ table_id: 0, staff_id: 1 }],
    [{ table_id: 1, staff_id: null }],
    [{ table_id: 1, staff_id: "1" }],
    [{ table_id: 1, staff_id: -1 }]
  ])("POST /orders rejects invalid typed payload %j", async (payload) => {
    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(ordersService.createOrder).not.toHaveBeenCalled();
  });

  test.each([
    [{ category: "FOOD", price: 50000 }], // missing name
    [{ name: "   ", category: "FOOD", price: 50000 }], // whitespace-only name
    [{ name: "Burger", price: 50000 }], // missing category
    [{ name: "Burger", category: "SNACK", price: 50000 }], // invalid category
    [{ name: "Burger", category: "FOOD", price: 0 }], // price = 0
    [{ name: "Burger", category: "FOOD", price: -1 }], // negative price
    [{ name: "Burger", category: "FOOD", price: null }], // null price
    [{ name: "Burger", category: "FOOD", price: undefined }], // undefined price
    [{ name: "Burger", category: "FOOD", price: "50000" }] // wrong type price
  ])("POST /orders rejects menu-style create payload %j", async (payload) => {
    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(ordersService.createOrder).not.toHaveBeenCalled();
  });

  test.each([
    ["missing token", undefined, 401, "No token provided"],
    ["malformed token", `Token ${managerToken}`, 401, "Malformed authorization header"],
    ["invalid token", "Bearer not.a.real.token", 401, "Invalid or expired token"]
  ])("POST /orders returns 401 for %s", async (name, authHeader, expectedStatus, expectedMessage) => {
    const req = request(app).post("/orders").send({ table_id: 1, staff_id: 1 });
    if (authHeader) req.set("Authorization", authHeader);

    const res = await req;
    expect(res.status).toBe(expectedStatus);
    expect(res.body.message).toBe(expectedMessage);
    expect(ordersService.createOrder).not.toHaveBeenCalled();
  });

  test("POST /orders blocks wrong role BARTENDER", async () => {
    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${bartenderToken}`)
      .send({ table_id: 1, staff_id: 1 });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Access forbidden");
    expect(ordersService.createOrder).not.toHaveBeenCalled();
  });

  test.each([
    ["TABLE_NOT_FOUND", 404, "Table not found"],
    ["STAFF_NOT_FOUND", 404, "Staff member not found"]
  ])("POST /orders maps %s correctly", async (errorCode, expectedStatus, expectedMessage) => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    ordersService.createOrder.mockRejectedValueOnce(new Error(errorCode));

    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ table_id: 1, staff_id: 1 });

    expect(res.status).toBe(expectedStatus);
    expect(res.body.message).toBe(expectedMessage);
    consoleSpy.mockRestore();
  });

  test.each([
    ["WAITER", waiterToken, 403, false],
    ["BARTENDER", bartenderToken, 403, false],
    ["MANAGER", managerToken, 200, true]
  ])("GET /orders enforces manager-only access for %s", async (role, token, expected, shouldCall) => {
    const res = await request(app)
      .get("/orders")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(expected);
    if (shouldCall) {
      expect(ordersService.getAllOrders).toHaveBeenCalledTimes(1);
    } else {
      expect(ordersService.getAllOrders).not.toHaveBeenCalled();
    }
  });

  test.each([
    [{ table_id: -1, staff_id: 1 }],
    [{ table_id: 1, staff_id: 0 }],
    [{ table_id: "1", staff_id: 1 }],
    [{ staff_id: 1 }]
  ])("POST /orders rejects invalid body: %j", async (payload) => {
    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(ordersService.createOrder).not.toHaveBeenCalled();
  });

  test.each([
    { method: "post", path: "/orders/abc/items", payload: { menu_item_id: 1, quantity: 1 } },
    { method: "post", path: "/orders/1/items", payload: { menu_item_id: 1, quantity: 0 } },
    { method: "post", path: "/orders/1/items", payload: { menu_item_id: 1, quantity: -2 } },
    { method: "post", path: "/orders/1/items", payload: { menu_item_id: 1 } },
    { method: "get", path: "/orders/abc" },
    { method: "patch", path: "/orders/abc/close" },
    { method: "delete", path: "/orders/abc" }
  ])("validation rejects invalid params/body on $method $path", async ({ method, path, payload }) => {
    let req = request(app)[method](path).set("Authorization", `Bearer ${managerToken}`);
    if (payload) req = req.send(payload);

    const res = await req;
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
  });

  test.each([
    ["post", "/orders/1/items", waiterToken, { menu_item_id: 1, quantity: 1 }, 201],
    ["post", "/orders/1/items", managerToken, { menu_item_id: 1, quantity: 1 }, 201],
    ["post", "/orders/1/items", bartenderToken, { menu_item_id: 1, quantity: 1 }, 403],
    ["get", "/orders/1", waiterToken, null, 200],
    ["get", "/orders/1", managerToken, null, 200],
    ["get", "/orders/1", bartenderToken, null, 403],
    ["patch", "/orders/1/close", waiterToken, null, 200],
    ["patch", "/orders/1/close", managerToken, null, 200],
    ["patch", "/orders/1/close", bartenderToken, null, 403],
    ["delete", "/orders/1", managerToken, null, 200],
    ["delete", "/orders/1", waiterToken, null, 403]
  ])("route rules: %s %s", async (method, path, token, payload, expectedStatus) => {
    let req = request(app)[method](path).set("Authorization", `Bearer ${token}`);
    if (payload) req = req.send(payload);

    const res = await req;
    expect(res.status).toBe(expectedStatus);
  });

  test.each([
    ["ORDER_NOT_FOUND", 404, "Order not found"],
    ["ORDER_FORBIDDEN", 403, "Order forbidden"]
  ])("GET /orders/:id maps %s", async (errorCode, expectedStatus, expectedMessage) => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    ordersService.getOrderById.mockRejectedValueOnce(new Error(errorCode));

    const res = await request(app)
      .get("/orders/1")
      .set("Authorization", `Bearer ${waiterToken}`);

    expect(res.status).toBe(expectedStatus);
    expect(res.body.message).toBe(expectedMessage);
    consoleSpy.mockRestore();
  });

  test.each([
    ["ORDER_NOT_FOUND_OR_ALREADY_CLOSED", 404, "Order not found or already closed"],
    ["ORDER_FORBIDDEN", 403, "Order forbidden"]
  ])("PATCH /orders/:id/close maps %s", async (errorCode, expectedStatus, expectedMessage) => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    ordersService.closeOrder.mockRejectedValueOnce(new Error(errorCode));

    const res = await request(app)
      .patch("/orders/1/close")
      .set("Authorization", `Bearer ${waiterToken}`);

    expect(res.status).toBe(expectedStatus);
    expect(res.body.message).toBe(expectedMessage);
    consoleSpy.mockRestore();
  });

  test.each([
    ["ORDER_NOT_FOUND", 404, "Order not found"],
    ["ORDER_FORBIDDEN", 403, "Order forbidden"],
    ["ORDER_CLOSED", 400, "Order closed"],
    ["MENU_NOT_AVAILABLE", 400, "Menu item not available"]
  ])("POST /orders/:id/items maps %s", async (errorCode, expectedStatus, expectedMessage) => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    ordersService.addItemToOrder.mockRejectedValueOnce(new Error(errorCode));

    const res = await request(app)
      .post("/orders/1/items")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ menu_item_id: 1, quantity: 1 });

    expect(res.status).toBe(expectedStatus);
    expect(res.body.message).toBe(expectedMessage);
    consoleSpy.mockRestore();
  });

  test("DELETE /orders/:id maps ORDER_NOT_FOUND", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    ordersService.deleteOrder.mockRejectedValueOnce(new Error("ORDER_NOT_FOUND"));

    const res = await request(app)
      .delete("/orders/999")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Order not found");
    consoleSpy.mockRestore();
  });

  test.each([
    ["missing token", undefined, 401, "No token provided"],
    ["invalid token", "Bearer not.a.real.token", 401, "Invalid or expired token"],
    ["malformed header", `Token ${managerToken}`, 401, "Malformed authorization header"]
  ])("unauthorized handling for %s", async (name, authHeader, expectedStatus, expectedMessage) => {
    const req = request(app).get("/orders");
    if (authHeader) req.set("Authorization", authHeader);

    const res = await req;
    expect(res.status).toBe(expectedStatus);
    expect(res.body.message).toBe(expectedMessage);
  });
});
