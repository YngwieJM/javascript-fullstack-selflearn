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

const pool = require("../config/db");
const ordersService = require("../services/orders.service");
const staffService = require("../services/staff.service");
const staffRoutes = require("../routes/staff.routes");
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

function createStaffApp() {
  const app = express();
  app.use(express.json());
  app.use("/staff", staffRoutes);
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

describe("Staff service updateStaff QA", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("updates staff and returns updated row", async () => {
    const updatedRow = {
      id: 1,
      name: "Updated Name",
      email: "updated@example.com",
      role: "WAITER"
    };

    pool.query.mockResolvedValue({ rows: [updatedRow] });

    const result = await staffService.updateStaff(1, "Updated Name", "updated@example.com", "WAITER");

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("name = COALESCE($1, name)"),
      ["Updated Name", "updated@example.com", "WAITER", 1]
    );
    expect(result).toEqual(updatedRow);
  });

  test("throws STAFF_NOT_FOUND when no row is updated", async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await expect(
      staffService.updateStaff(999, "No Name", "missing@example.com", "WAITER")
    ).rejects.toThrow("STAFF_NOT_FOUND");
  });
});

describe("Staff route updatePassword authorization QA", () => {
  let app;
  const managerToken = makeToken("MANAGER", 1);
  const waiterToken = makeToken("WAITER", 7);
  const bartenderToken = makeToken("BARTENDER", 9);

  beforeAll(() => {
    app = createStaffApp();
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (staffService.updatePassword && staffService.updatePassword.mockRestore) {
      staffService.updatePassword.mockRestore();
    }
  });

  test("allows MANAGER to update another staff password", async () => {
    jest.spyOn(staffService, "updatePassword").mockResolvedValue({ message: "Password Updated" });

    const res = await request(app)
      .patch("/staff/2")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ currentPassword: "current123", newPassword: "newpass123" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Password updated successfully");
    expect(staffService.updatePassword).toHaveBeenCalledWith(
      2,
      "current123",
      "newpass123",
      { skipCurrentCheck: true }
    );
  });

  test("allows MANAGER to reset another staff password without currentPassword", async () => {
    jest.spyOn(staffService, "updatePassword").mockResolvedValue({ message: "Password Updated" });

    const res = await request(app)
      .patch("/staff/2")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ newPassword: "newpass123" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Password updated successfully");
    expect(staffService.updatePassword).toHaveBeenCalledWith(
      2,
      undefined,
      "newpass123",
      { skipCurrentCheck: true }
    );
  });

  test("allows WAITER to update own password", async () => {
    jest.spyOn(staffService, "updatePassword").mockResolvedValue({ message: "Password Updated" });

    const res = await request(app)
      .patch("/staff/7")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ currentPassword: "current123", newPassword: "newpass123" });

    expect(res.status).toBe(200);
    expect(staffService.updatePassword).toHaveBeenCalledWith(
      7,
      "current123",
      "newpass123",
      { skipCurrentCheck: false }
    );
  });

  test("blocks WAITER from updating another staff password", async () => {
    const spy = jest.spyOn(staffService, "updatePassword").mockResolvedValue({ message: "Password Updated" });

    const res = await request(app)
      .patch("/staff/8")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ currentPassword: "current123", newPassword: "newpass123" });

    expect(res.status).toBe(403);
    expect(spy).not.toHaveBeenCalled();
  });

  test("allows BARTENDER to update own password", async () => {
    jest.spyOn(staffService, "updatePassword").mockResolvedValue({ message: "Password Updated" });

    const res = await request(app)
      .patch("/staff/9")
      .set("Authorization", `Bearer ${bartenderToken}`)
      .send({ currentPassword: "current123", newPassword: "newpass123" });

    expect(res.status).toBe(200);
    expect(staffService.updatePassword).toHaveBeenCalledWith(
      9,
      "current123",
      "newpass123",
      { skipCurrentCheck: false }
    );
  });

  test("returns 401 when token is missing", async () => {
    const res = await request(app)
      .patch("/staff/2")
      .send({ currentPassword: "current123", newPassword: "newpass123" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("No token provided");
  });

  test("returns 401 when auth header is malformed", async () => {
    const res = await request(app)
      .patch("/staff/2")
      .set("Authorization", `Token ${managerToken}`)
      .send({ currentPassword: "current123", newPassword: "newpass123" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Malformed authorization header");
  });

  test("PUT /staff/:id rejects empty update body", async () => {
    const res = await request(app)
      .put("/staff/2")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
  });
});
