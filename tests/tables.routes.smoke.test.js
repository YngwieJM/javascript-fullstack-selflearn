const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/env");
const tablesRoutes = require("../routes/tables.routes");

jest.mock("../controllers/tables.controller", () => ({
  createTable: jest.fn((req, res) => res.status(201).json({ message: "created" })),
  updateTable: jest.fn((req, res) => res.status(200).json({ message: "updated" })),
  getAllTables: jest.fn((req, res) => res.status(200).json({ message: "list" })),
  getTableById: jest.fn((req, res) => res.status(200).json({ message: "detail" })),
  deleteTable: jest.fn((req, res) => res.status(200).json({ message: "deleted" }))
}));

function makeToken(role, id = 1) {
  return jwt.sign({ id, role }, jwtSecret, { expiresIn: "1h" });
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/tables", tablesRoutes);
  return app;
}

describe("Tables routes smoke QA", () => {
  let app;
  const managerToken = makeToken("MANAGER");
  const waiterToken = makeToken("WAITER");
  const bartenderToken = makeToken("BARTENDER");

  beforeAll(() => {
    app = createApp();
  });

  test("POST /tables allows MANAGER with valid payload", async () => {
    const res = await request(app)
      .post("/tables")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ table_number: "A1", capacity: 4 });

    expect(res.status).toBe(201);
  });

  test("POST /tables blocks WAITER", async () => {
    const res = await request(app)
      .post("/tables")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ table_number: "A1", capacity: 4 });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Access forbidden");
  });

  test("GET /tables allows WAITER and MANAGER, blocks BARTENDER", async () => {
    const waiterRes = await request(app)
      .get("/tables")
      .set("Authorization", `Bearer ${waiterToken}`);
    const managerRes = await request(app)
      .get("/tables")
      .set("Authorization", `Bearer ${managerToken}`);
    const bartenderRes = await request(app)
      .get("/tables")
      .set("Authorization", `Bearer ${bartenderToken}`);

    expect(waiterRes.status).toBe(200);
    expect(managerRes.status).toBe(200);
    expect(bartenderRes.status).toBe(403);
  });

  test("GET /tables/:id rejects invalid id", async () => {
    const res = await request(app)
      .get("/tables/abc")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
  });

  test("PUT /tables/:id rejects empty body", async () => {
    const res = await request(app)
      .put("/tables/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
  });

  test("DELETE /tables/:id validates id format", async () => {
    const res = await request(app)
      .delete("/tables/abc")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
  });

  test("GET /tables returns 401 with missing token", async () => {
    const res = await request(app).get("/tables");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("No token provided");
  });
});
