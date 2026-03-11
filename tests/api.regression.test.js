const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { jwtSecret } = require("../config/env");
const { errorHandler } = require("../middleware/error.middleware");

jest.mock("../config/db", () => ({
  query: jest.fn()
}));

jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  compare: jest.fn()
}));

jest.mock("../services/staff.service", () => ({
  createStaff: jest.fn(),
  getAllStaff: jest.fn(),
  getStaffById: jest.fn(),
  updateStaff: jest.fn(),
  updatePassword: jest.fn(),
  deleteStaff: jest.fn()
}));

jest.mock("../services/menu.service", () => ({
  createMenuItem: jest.fn(),
  getAllMenuItems: jest.fn(),
  getMenuItemById: jest.fn(),
  updateMenuItem: jest.fn(),
  toggleAvailability: jest.fn(),
  deleteMenuItem: jest.fn()
}));

jest.mock("../services/orders.service", () => ({
  createOrder: jest.fn(),
  addItemToOrder: jest.fn(),
  getAllOrders: jest.fn(),
  getOrderById: jest.fn(),
  closeOrder: jest.fn(),
  deleteOrder: jest.fn()
}));

jest.mock("../services/tables.service", () => ({
  createTable: jest.fn(),
  updateTable: jest.fn(),
  getAllTables: jest.fn(),
  getTableById: jest.fn(),
  deleteTable: jest.fn()
}));

const pool = require("../config/db");
const staffService = require("../services/staff.service");
const menuService = require("../services/menu.service");
const ordersService = require("../services/orders.service");
const tablesService = require("../services/tables.service");

const authRoutes = require("../routes/auth.routes");
const staffRoutes = require("../routes/staff.routes");
const menuRoutes = require("../routes/menu.routes");
const ordersRoutes = require("../routes/orders.routes");
const tablesRoutes = require("../routes/tables.routes");

function makeToken(role, id = 1) {
  return jwt.sign({ id, role }, jwtSecret, { expiresIn: "1h" });
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRoutes);
  app.use("/staff", staffRoutes);
  app.use("/menu", menuRoutes);
  app.use("/orders", ordersRoutes);
  app.use("/tables", tablesRoutes);
  app.use(errorHandler);
  return app;
}

describe("API regression pack", () => {
  let app;
  const managerToken = makeToken("MANAGER", 1);
  const waiterToken = makeToken("WAITER", 7);
  const bartenderToken = makeToken("BARTENDER", 9);

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    staffService.getAllStaff.mockResolvedValue([{ id: 1, name: "Alice", role: "WAITER" }]);
    staffService.getStaffById.mockResolvedValue({ id: 2, name: "Bob", role: "BARTENDER" });
    staffService.createStaff.mockResolvedValue({
      id: 3,
      name: "Charlie",
      email: "charlie@example.com",
      role: "WAITER"
    });
    staffService.updatePassword.mockResolvedValue({ message: "Password updated successfully" });

    menuService.createMenuItem.mockResolvedValue({ id: 1, name: "Burger", category: "FOOD", price: 50 });

    ordersService.createOrder.mockResolvedValue({ id: 1, table_id: 1, staff_id: 7, status: "OPEN" });
    ordersService.getOrderById.mockResolvedValue({ id: 1, status: "OPEN" });

    tablesService.createTable.mockResolvedValue({ id: 1, table_number: "A1", capacity: 4 });
    tablesService.deleteTable.mockResolvedValue({ id: 1, table_number: "A1", capacity: 4 });

    bcrypt.hash.mockResolvedValue("hashed-password");
    bcrypt.compare.mockResolvedValue(true);
  });

  describe("auth", () => {
    test("happy path: POST /auth/login returns token", async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 7, email: "alice@example.com", password: "hashed-db", role: "WAITER" }]
      });
      bcrypt.compare.mockResolvedValueOnce(true);

      const res = await request(app).post("/auth/login").send({
        email: "alice@example.com",
        password: "secret123"
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Login successful");
      expect(res.body.token).toEqual(expect.any(String));
    });

    test("auth failure: POST /auth/login with wrong password returns 401", async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 7, email: "alice@example.com", password: "hashed-db", role: "WAITER" }]
      });
      bcrypt.compare.mockResolvedValueOnce(false);

      const res = await request(app).post("/auth/login").send({
        email: "alice@example.com",
        password: "wrong-password"
      });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Invalid credentials");
    });

    test("validation: POST /auth/register rejects whitespace-only name", async () => {
      const res = await request(app).post("/auth/register").send({
        name: "   ",
        email: "space@example.com",
        password: "secret123",
        role: "WAITER"
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation error");
      expect(pool.query).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    test("conflict: POST /auth/register duplicate email returns 400", async () => {
      const duplicateErr = new Error("duplicate");
      duplicateErr.code = "23505";
      pool.query.mockRejectedValueOnce(duplicateErr);

      const res = await request(app).post("/auth/register").send({
        name: "Alice",
        email: "alice@example.com",
        password: "secret123",
        role: "WAITER"
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Email already exists");
    });
  });

  describe("staff", () => {
    test("happy path: GET /staff returns list for MANAGER", async () => {
      const res = await request(app)
        .get("/staff")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(staffService.getAllStaff).toHaveBeenCalledTimes(1);
    });

    test("validation: POST /staff rejects missing role", async () => {
      const res = await request(app)
        .post("/staff")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          name: "Charlie",
          email: "charlie@example.com",
          password: "secret123"
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation error");
      expect(staffService.createStaff).not.toHaveBeenCalled();
    });

    test("security: GET /staff rejects missing token", async () => {
      const res = await request(app).get("/staff");

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("No token provided");
      expect(staffService.getAllStaff).not.toHaveBeenCalled();
    });

    test("security: GET /staff rejects malformed token header", async () => {
      const res = await request(app)
        .get("/staff")
        .set("Authorization", `Token ${managerToken}`);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Malformed authorization header");
      expect(staffService.getAllStaff).not.toHaveBeenCalled();
    });

    test("security: POST /staff blocks wrong role and does not mutate", async () => {
      const res = await request(app)
        .post("/staff")
        .set("Authorization", `Bearer ${waiterToken}`)
        .send({
          name: "Charlie",
          email: "charlie@example.com",
          password: "secret123",
          role: "WAITER"
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Access forbidden");
      expect(staffService.createStaff).not.toHaveBeenCalled();
    });

    test("object-level auth: WAITER cannot patch another user's password by changing :id", async () => {
      const res = await request(app)
        .patch("/staff/1")
        .set("Authorization", `Bearer ${waiterToken}`)
        .send({ currentPassword: "current123", newPassword: "newpass123" });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Access forbidden");
      expect(staffService.updatePassword).not.toHaveBeenCalled();
    });

    test("not found: GET /staff/:id maps STAFF_NOT_FOUND to 404", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      staffService.getStaffById.mockRejectedValueOnce(new Error("STAFF_NOT_FOUND"));

      const res = await request(app)
        .get("/staff/999")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Staff member not found");
      consoleSpy.mockRestore();
    });
  });

  describe("menu", () => {
    test("happy path: POST /menu creates menu item for MANAGER", async () => {
      const res = await request(app)
        .post("/menu")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ name: "Burger", category: "FOOD", price: 50 });

      expect(res.status).toBe(201);
      expect(menuService.createMenuItem).toHaveBeenCalledWith("Burger", "FOOD", 50);
    });

    test("validation: POST /menu rejects negative price", async () => {
      const res = await request(app)
        .post("/menu")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ name: "Burger", category: "FOOD", price: -1 });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation error");
      expect(menuService.createMenuItem).not.toHaveBeenCalled();
    });

    test("security: POST /menu rejects malformed token", async () => {
      const res = await request(app)
        .post("/menu")
        .set("Authorization", `Token ${managerToken}`)
        .send({ name: "Burger", category: "FOOD", price: 50 });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Malformed authorization header");
      expect(menuService.createMenuItem).not.toHaveBeenCalled();
    });

    test("security: POST /menu blocks wrong role and does not mutate", async () => {
      const res = await request(app)
        .post("/menu")
        .set("Authorization", `Bearer ${waiterToken}`)
        .send({ name: "Burger", category: "FOOD", price: 50 });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Access forbidden");
      expect(menuService.createMenuItem).not.toHaveBeenCalled();
    });

    test("conflict: POST /menu maps duplicate constraint to 409", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const duplicateErr = new Error("duplicate");
      duplicateErr.code = "23505";
      menuService.createMenuItem.mockRejectedValueOnce(duplicateErr);

      const res = await request(app)
        .post("/menu")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ name: "Burger", category: "FOOD", price: 50 });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe("Duplicate value violates unique constraint");
      consoleSpy.mockRestore();
    });
  });

  describe("orders", () => {
    test("happy path: POST /orders creates order for WAITER", async () => {
      const res = await request(app)
        .post("/orders")
        .set("Authorization", `Bearer ${waiterToken}`)
        .send({ table_id: 1 });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("Order Created");
      expect(ordersService.createOrder).toHaveBeenCalledWith(1, undefined, expect.objectContaining({ role: "WAITER" }));
    });

    test("validation: POST /orders rejects missing table_id", async () => {
      const res = await request(app)
        .post("/orders")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ staff_id: 1 });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation error");
      expect(ordersService.createOrder).not.toHaveBeenCalled();
    });

    test("security: POST /orders blocks wrong role and does not mutate", async () => {
      const res = await request(app)
        .post("/orders")
        .set("Authorization", `Bearer ${bartenderToken}`)
        .send({ table_id: 1, staff_id: 1 });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Access forbidden");
      expect(ordersService.createOrder).not.toHaveBeenCalled();
    });

    test("security: POST /orders rejects invalid token", async () => {
      const res = await request(app)
        .post("/orders")
        .set("Authorization", "Bearer not.a.real.token")
        .send({ table_id: 1, staff_id: 1 });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Invalid or expired token");
      expect(ordersService.createOrder).not.toHaveBeenCalled();
    });

    test("object-level auth: WAITER cannot access another order by changing :id", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      ordersService.getOrderById.mockRejectedValueOnce(new Error("ORDER_FORBIDDEN"));

      const res = await request(app)
        .get("/orders/999")
        .set("Authorization", `Bearer ${waiterToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Order forbidden");
      expect(ordersService.getOrderById).toHaveBeenCalledWith(
        "999",
        expect.objectContaining({ id: 7, role: "WAITER" })
      );
      consoleSpy.mockRestore();
    });

    test("not found: POST /orders maps TABLE_NOT_FOUND to 404", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      ordersService.createOrder.mockRejectedValueOnce(new Error("TABLE_NOT_FOUND"));

      const res = await request(app)
        .post("/orders")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ table_id: 999, staff_id: 1 });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Table not found");
      consoleSpy.mockRestore();
    });
  });

  describe("tables", () => {
    test("happy path: POST /tables creates table for MANAGER", async () => {
      const res = await request(app)
        .post("/tables")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ table_number: "A1", capacity: 4 });

      expect(res.status).toBe(201);
      expect(tablesService.createTable).toHaveBeenCalledWith("A1", 4);
    });

    test("validation: POST /tables rejects non-positive capacity", async () => {
      const res = await request(app)
        .post("/tables")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ table_number: "A1", capacity: 0 });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation error");
      expect(tablesService.createTable).not.toHaveBeenCalled();
    });

    test("security: POST /tables blocks wrong role and does not mutate", async () => {
      const res = await request(app)
        .post("/tables")
        .set("Authorization", `Bearer ${waiterToken}`)
        .send({ table_number: "A1", capacity: 4 });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Access forbidden");
      expect(tablesService.createTable).not.toHaveBeenCalled();
    });

    test("not found: DELETE /tables/:id maps TABLE_NOT_FOUND to 404", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      tablesService.deleteTable.mockRejectedValueOnce(new Error("TABLE_NOT_FOUND"));

      const res = await request(app)
        .delete("/tables/999")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Table not found");
      consoleSpy.mockRestore();
    });
  });
});
