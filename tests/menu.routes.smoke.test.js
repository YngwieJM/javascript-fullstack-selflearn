const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/env");
const menuRoutes = require("../routes/menu.routes");

jest.mock("../controllers/menu.controller", () => ({
  createMenuItem: jest.fn((req, res) => res.status(201).json({ message: "created" })),
  getAllMenuItems: jest.fn((req, res) => res.status(200).json({ message: "list" })),
  getMenuItemById: jest.fn((req, res) => res.status(200).json({ message: "detail" })),
  updateMenuItem: jest.fn((req, res) => res.status(200).json({ message: "updated" })),
  toggleAvailability: jest.fn((req, res) => res.status(200).json({ message: "availability updated" })),
  deleteMenuItem: jest.fn((req, res) => res.status(200).json({ message: "deleted" }))
}));

function makeToken(role, id = 1) {
  return jwt.sign({ id, role }, jwtSecret, { expiresIn: "1h" });
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/menu", menuRoutes);
  return app;
}

describe("Menu routes smoke QA", () => {
  let app;
  const managerToken = makeToken("MANAGER");
  const waiterToken = makeToken("WAITER");
  const bartenderToken = makeToken("BARTENDER");

  beforeAll(() => {
    app = createApp();
  });

  test("POST /menu allows MANAGER with valid payload", async () => {
    const res = await request(app)
      .post("/menu")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Burger", category: "FOOD", price: 50 });

    expect(res.status).toBe(201);
  });

  test("POST /menu blocks WAITER", async () => {
    const res = await request(app)
      .post("/menu")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ name: "Burger", category: "FOOD", price: 50 });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Access forbidden");
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
  });

  test("GET /menu/:id rejects invalid param", async () => {
    const res = await request(app)
      .get("/menu/abc")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
  });

  test("PATCH /menu/:id rejects empty body", async () => {
    const res = await request(app)
      .patch("/menu/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
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
  });

  test("GET /menu returns 401 with missing token", async () => {
    const res = await request(app).get("/menu");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("No token provided");
  });
});
