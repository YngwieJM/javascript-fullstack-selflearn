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

function makeToken(role, id = 1) {
  return jwt.sign({ id, role }, jwtSecret, { expiresIn: "1h" });
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/menu", menuRoutes);
  app.use(errorHandler);
  return app;
}

describe("Menu routes QA", () => {
  let app;
  const managerToken = makeToken("MANAGER");
  const waiterToken = makeToken("WAITER");
  const bartenderToken = makeToken("BARTENDER");

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    menuService.createMenuItem.mockResolvedValue({ id: 1, name: "Burger", category: "FOOD", price: 50 });
    menuService.getAllMenuItems.mockResolvedValue([]);
    menuService.getMenuItemById.mockResolvedValue({ id: 1, name: "Burger", category: "FOOD", price: 50 });
    menuService.updateMenuItem.mockResolvedValue({ id: 1, name: "Burger", category: "FOOD", price: 60 });
    menuService.toggleAvailability.mockResolvedValue({ id: 1, is_available: false });
    menuService.deleteMenuItem.mockResolvedValue({ id: 1, name: "Burger" });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("POST /menu allows MANAGER with valid payload and returns 201", async () => {
    const payload = { name: "Burger", category: "FOOD", price: 50 };
    const res = await request(app)
      .post("/menu")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(menuService.createMenuItem).toHaveBeenCalledWith("Burger", "FOOD", 50);
  });

  test("POST /menu accepts price=0 when payload is otherwise valid", async () => {
    const res = await request(app)
      .post("/menu")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Water", category: "DRINK", price: 0 });

    expect(res.status).toBe(201);
    expect(menuService.createMenuItem).toHaveBeenCalledWith("Water", "DRINK", 0);
  });

  test.each([
    [{ category: "FOOD", price: 10 }],
    [{ name: "Burger", price: 10 }],
    [{ name: "Burger", category: "FOOD" }],
    [{ name: "Burger", category: "FOOD", price: -1 }],
    [{ name: "Burger", category: "FOOD", price: "10" }],
    [{ name: "Burger", category: "FOOD", price: null }],
    [{ name: "", category: "FOOD", price: 10 }],
    [{ name: "   ", category: "FOOD", price: 10 }],
    [{ name: "Burger", category: "   ", price: 10 }]
  ])("POST /menu rejects invalid payload %j", async (payload) => {
    const res = await request(app)
      .post("/menu")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(menuService.createMenuItem).not.toHaveBeenCalled();
  });

  test("POST /menu blocks WAITER", async () => {
    const res = await request(app)
      .post("/menu")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ name: "Burger", category: "FOOD", price: 50 });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Access forbidden");
    expect(menuService.createMenuItem).not.toHaveBeenCalled();
  });

  test("GET /menu allows WAITER and BARTENDER", async () => {
    const waiterRes = await request(app)
      .get("/menu")
      .set("Authorization", `Bearer ${waiterToken}`);
    const bartenderRes = await request(app)
      .get("/menu")
      .set("Authorization", `Bearer ${bartenderToken}`);

    expect(waiterRes.status).toBe(200);
    expect(bartenderRes.status).toBe(200);
    expect(menuService.getAllMenuItems).toHaveBeenCalledTimes(2);
  });

  test("GET /menu/:id rejects invalid param", async () => {
    const res = await request(app)
      .get("/menu/abc")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(menuService.getMenuItemById).not.toHaveBeenCalled();
  });

  test("PATCH /menu/:id rejects empty body", async () => {
    const res = await request(app)
      .patch("/menu/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(menuService.updateMenuItem).not.toHaveBeenCalled();
  });

  test("PATCH /menu/:id allows MANAGER to set price=0", async () => {
    const res = await request(app)
      .patch("/menu/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ price: 0 });

    expect(res.status).toBe(200);
    expect(menuService.updateMenuItem).toHaveBeenCalledWith("1", undefined, undefined, 0);
  });

  test.each([
    [{ price: -1 }],
    [{ category: "SNACK" }],
    [{ name: "A" }],
    [{ name: 123 }]
  ])("PATCH /menu/:id rejects invalid update payload %j", async (payload) => {
    const res = await request(app)
      .patch("/menu/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(menuService.updateMenuItem).not.toHaveBeenCalled();
  });

  test("PATCH /menu/:id rejects whitespace-only name", async () => {
    const res = await request(app)
      .patch("/menu/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "   " });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(menuService.updateMenuItem).not.toHaveBeenCalled();
  });

  test.each([
    [{ is_available: "true" }],
    [{}]
  ])("PATCH /menu/:id/availability rejects invalid payload %j", async (payload) => {
    const res = await request(app)
      .patch("/menu/1/availability")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(menuService.toggleAvailability).not.toHaveBeenCalled();
  });

  test("DELETE /menu/:id blocks WAITER and allows MANAGER", async () => {
    const waiterRes = await request(app)
      .delete("/menu/1")
      .set("Authorization", `Bearer ${waiterToken}`);
    const managerRes = await request(app)
      .delete("/menu/1")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(waiterRes.status).toBe(403);
    expect(managerRes.status).toBe(200);
    expect(menuService.deleteMenuItem).toHaveBeenCalledTimes(1);
  });

  test("GET /menu returns 401 with missing token", async () => {
    const res = await request(app).get("/menu");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("No token provided");
  });

  test("GET /menu returns 401 with malformed authorization header", async () => {
    const res = await request(app)
      .get("/menu")
      .set("Authorization", `Token ${managerToken}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Malformed authorization header");
    expect(menuService.getAllMenuItems).not.toHaveBeenCalled();
  });

  test("GET /menu/:id maps MENU_ITEM_NOT_FOUND to 404", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    menuService.getMenuItemById.mockRejectedValueOnce(new Error("MENU_ITEM_NOT_FOUND"));

    const res = await request(app)
      .get("/menu/1")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Menu item not found");
    consoleSpy.mockRestore();
  });

  test("POST /menu maps INVALID_MENU_DATA to 400", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    menuService.createMenuItem.mockRejectedValueOnce(new Error("INVALID_MENU_DATA"));

    const res = await request(app)
      .post("/menu")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Burger", category: "FOOD", price: 50 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid menu data");
    consoleSpy.mockRestore();
  });
});
