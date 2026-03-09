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

function makeToken(role, id = 1) {
  return jwt.sign({ id, role }, jwtSecret, { expiresIn: "1h" });
}

function makeExpiredToken(role, id = 1) {
  return jwt.sign({ id, role }, jwtSecret, { expiresIn: -1 });
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/tables", tablesRoutes);
  app.use(errorHandler);
  return app;
}

describe("Tables routes QA", () => {
  let app;
  const managerToken = makeToken("MANAGER");
  const waiterToken = makeToken("WAITER");
  const bartenderToken = makeToken("BARTENDER");

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    tableService.createTable.mockResolvedValue({ id: 1, table_number: "A1", capacity: 4 });
    tableService.updateTable.mockResolvedValue({ id: 1, table_number: "A1", capacity: 5 });
    tableService.getAllTables.mockResolvedValue([]);
    tableService.getTableById.mockResolvedValue({ id: 1, table_number: "A1", capacity: 4 });
    tableService.deleteTable.mockResolvedValue({ id: 1, table_number: "A1", capacity: 4 });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("POST /tables allows MANAGER with valid payload and returns 201", async () => {
    const res = await request(app)
      .post("/tables")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ table_number: "A1", capacity: 4 });

    expect(res.status).toBe(201);
    expect(tableService.createTable).toHaveBeenCalledWith("A1", 4);
  });

  test("POST /tables returns created table shape", async () => {
    const res = await request(app)
      .post("/tables")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ table_number: "A1", capacity: 4 });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({ id: 1, table_number: "A1", capacity: 4 }));
  });

  test("POST /tables duplicate submit returns conflict on second request", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const duplicateErr = new Error("duplicate");
    duplicateErr.code = "23505";
    tableService.createTable
      .mockResolvedValueOnce({ id: 1, table_number: "A1", capacity: 4 })
      .mockRejectedValueOnce(duplicateErr);

    const payload = { table_number: "A1", capacity: 4 };

    const first = await request(app)
      .post("/tables")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(payload);

    const second = await request(app)
      .post("/tables")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(payload);

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(second.body.message).toBe("Duplicate value violates unique constraint");
    expect(tableService.createTable).toHaveBeenCalledTimes(2);
    consoleSpy.mockRestore();
  });

  test("POST /tables accepts boundary table_number lengths (2 and 20)", async () => {
    const minRes = await request(app)
      .post("/tables")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ table_number: "A1", capacity: 2 });

    const maxRes = await request(app)
      .post("/tables")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ table_number: "A".repeat(20), capacity: 2 });

    expect(minRes.status).toBe(201);
    expect(maxRes.status).toBe(201);
    expect(tableService.createTable).toHaveBeenCalledTimes(2);
  });

  test.each([
    [{ capacity: 4 }],
    [{ table_number: "A1" }],
    [{ table_number: "A", capacity: 4 }],
    [{ table_number: null, capacity: 4 }],
    [{ table_number: "A1", capacity: 0 }],
    [{ table_number: "A1", capacity: -2 }],
    [{ table_number: "A1", capacity: "4" }],
    [{ table_number: "A1", capacity: null }],
    [{ table_number: "A".repeat(21), capacity: 4 }]
  ])("POST /tables rejects invalid payload %j", async (payload) => {
    const res = await request(app)
      .post("/tables")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(tableService.createTable).not.toHaveBeenCalled();
  });

  test("POST /tables rejects whitespace-only table_number", async () => {
    const res = await request(app)
      .post("/tables")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ table_number: "   ", capacity: 4 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(tableService.createTable).not.toHaveBeenCalled();
  });

  test("POST /tables blocks WAITER", async () => {
    const res = await request(app)
      .post("/tables")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ table_number: "A1", capacity: 4 });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Access forbidden");
    expect(tableService.createTable).not.toHaveBeenCalled();
  });

  test("POST /tables blocks BARTENDER", async () => {
    const res = await request(app)
      .post("/tables")
      .set("Authorization", `Bearer ${bartenderToken}`)
      .send({ table_number: "A1", capacity: 4 });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Access forbidden");
    expect(tableService.createTable).not.toHaveBeenCalled();
  });

  test.each([
    ["missing token", undefined, "No token provided"],
    ["malformed token header", `Token ${managerToken}`, "Malformed authorization header"],
    ["invalid token", "Bearer not.a.real.token", "Invalid or expired token"],
    ["expired token", `Bearer ${makeExpiredToken("MANAGER")}`, "Invalid or expired token"],
    ["extra segments", `Bearer ${managerToken} trailing`, "Malformed authorization header"]
  ])("POST /tables returns 401 for %s", async (name, authHeader, expectedMessage) => {
    const req = request(app).post("/tables").send({ table_number: "A1", capacity: 4 });
    if (authHeader) req.set("Authorization", authHeader);

    const res = await req;
    expect(res.status).toBe(401);
    expect(res.body.message).toBe(expectedMessage);
    expect(tableService.createTable).not.toHaveBeenCalled();
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
    expect(tableService.getAllTables).toHaveBeenCalledTimes(2);
  });

  test("GET /tables returns 401 with invalid token", async () => {
    const res = await request(app)
      .get("/tables")
      .set("Authorization", "Bearer not.a.real.token");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid or expired token");
    expect(tableService.getAllTables).not.toHaveBeenCalled();
  });

  test("GET /tables/:id allows MANAGER and WAITER", async () => {
    const managerRes = await request(app)
      .get("/tables/1")
      .set("Authorization", `Bearer ${managerToken}`);

    const waiterRes = await request(app)
      .get("/tables/1")
      .set("Authorization", `Bearer ${waiterToken}`);

    expect(managerRes.status).toBe(200);
    expect(waiterRes.status).toBe(200);
    expect(managerRes.body).toEqual(expect.objectContaining({ id: 1, table_number: "A1", capacity: 4 }));
    expect(tableService.getTableById).toHaveBeenCalledTimes(2);
  });

  test("GET /tables/:id blocks BARTENDER", async () => {
    const res = await request(app)
      .get("/tables/1")
      .set("Authorization", `Bearer ${bartenderToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Access forbidden");
    expect(tableService.getTableById).not.toHaveBeenCalled();
  });

  test("GET /tables/:id rejects invalid id", async () => {
    const res = await request(app)
      .get("/tables/abc")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(tableService.getTableById).not.toHaveBeenCalled();
  });

  test.each([
    ["missing token", undefined, "No token provided"],
    ["malformed header", `Token ${managerToken}`, "Malformed authorization header"],
    ["invalid token", "Bearer not.a.real.token", "Invalid or expired token"],
    ["expired token", `Bearer ${makeExpiredToken("MANAGER")}`, "Invalid or expired token"],
    ["extra segments", `Bearer ${managerToken} trailing`, "Malformed authorization header"]
  ])("GET /tables/:id returns 401 for %s", async (name, authHeader, expectedMessage) => {
    const req = request(app).get("/tables/1");
    if (authHeader) req.set("Authorization", authHeader);

    const res = await req;
    expect(res.status).toBe(401);
    expect(res.body.message).toBe(expectedMessage);
    expect(tableService.getTableById).not.toHaveBeenCalled();
  });

  test("PUT /tables/:id rejects empty body", async () => {
    const res = await request(app)
      .put("/tables/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(tableService.updateTable).not.toHaveBeenCalled();
  });

  test("PUT /tables/:id allows MANAGER with valid payload", async () => {
    const res = await request(app)
      .put("/tables/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ capacity: 5 });

    expect(res.status).toBe(200);
    expect(tableService.updateTable).toHaveBeenCalledWith("1", undefined, 5);
  });

  test("PUT /tables/:id supports retry with identical payload", async () => {
    const payload = { capacity: 5 };

    const first = await request(app)
      .put("/tables/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(payload);

    const second = await request(app)
      .put("/tables/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(payload);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(tableService.updateTable).toHaveBeenCalledTimes(2);
  });

  test("PUT /tables/:id accepts boundary table_number lengths (2 and 20)", async () => {
    const minRes = await request(app)
      .put("/tables/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ table_number: "A1" });

    const maxRes = await request(app)
      .put("/tables/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ table_number: "A".repeat(20) });

    expect(minRes.status).toBe(200);
    expect(maxRes.status).toBe(200);
    expect(tableService.updateTable).toHaveBeenCalledTimes(2);
  });

  test.each([
    ["/tables/1", { table_number: "A" }],
    ["/tables/1", { capacity: 0 }],
    ["/tables/1", { capacity: "4" }],
    ["/tables/1", { table_number: null }],
    ["/tables/1", { capacity: null }],
    ["/tables/1", { table_number: "A".repeat(21) }],
    ["/tables/not-a-number", { table_number: "A1" }]
  ])("PUT %s rejects invalid payload %j", async (path, payload) => {
    const res = await request(app)
      .put(path)
      .set("Authorization", `Bearer ${managerToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(tableService.updateTable).not.toHaveBeenCalled();
  });

  test.each([
    ["WAITER", waiterToken],
    ["BARTENDER", bartenderToken]
  ])("PUT /tables/:id blocks %s", async (role, token) => {
    const res = await request(app)
      .put("/tables/1")
      .set("Authorization", `Bearer ${token}`)
      .send({ capacity: 5 });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Access forbidden");
    expect(tableService.updateTable).not.toHaveBeenCalled();
  });

  test.each([
    ["missing token", undefined, "No token provided"],
    ["malformed header", `Token ${managerToken}`, "Malformed authorization header"],
    ["invalid token", "Bearer not.a.real.token", "Invalid or expired token"],
    ["expired token", `Bearer ${makeExpiredToken("MANAGER")}`, "Invalid or expired token"],
    ["extra segments", `Bearer ${managerToken} trailing`, "Malformed authorization header"]
  ])("PUT /tables/:id returns 401 for %s", async (name, authHeader, expectedMessage) => {
    const req = request(app).put("/tables/1").send({ capacity: 5 });
    if (authHeader) req.set("Authorization", authHeader);

    const res = await req;
    expect(res.status).toBe(401);
    expect(res.body.message).toBe(expectedMessage);
    expect(tableService.updateTable).not.toHaveBeenCalled();
  });

  test("PUT /tables/:id rejects whitespace-only table_number", async () => {
    const res = await request(app)
      .put("/tables/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ table_number: "   " });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(tableService.updateTable).not.toHaveBeenCalled();
  });

  test("DELETE /tables/:id validates id format", async () => {
    const res = await request(app)
      .delete("/tables/abc")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(tableService.deleteTable).not.toHaveBeenCalled();
  });

  test("DELETE /tables/:id allows MANAGER and returns response shape", async () => {
    const res = await request(app)
      .delete("/tables/1")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: "Table deleted successfully",
        table: expect.objectContaining({ id: 1, table_number: "A1" })
      })
    );
    expect(tableService.deleteTable).toHaveBeenCalledWith("1");
  });

  test.each([
    ["WAITER", waiterToken],
    ["BARTENDER", bartenderToken]
  ])("DELETE /tables/:id blocks %s", async (role, token) => {
    const res = await request(app)
      .delete("/tables/1")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Access forbidden");
    expect(tableService.deleteTable).not.toHaveBeenCalled();
  });

  test.each([
    ["missing token", undefined, "No token provided"],
    ["malformed header", `Token ${managerToken}`, "Malformed authorization header"],
    ["invalid token", "Bearer not.a.real.token", "Invalid or expired token"],
    ["expired token", `Bearer ${makeExpiredToken("MANAGER")}`, "Invalid or expired token"],
    ["extra segments", `Bearer ${managerToken} trailing`, "Malformed authorization header"]
  ])("DELETE /tables/:id returns 401 for %s", async (name, authHeader, expectedMessage) => {
    const req = request(app).delete("/tables/1");
    if (authHeader) req.set("Authorization", authHeader);

    const res = await req;
    expect(res.status).toBe(401);
    expect(res.body.message).toBe(expectedMessage);
    expect(tableService.deleteTable).not.toHaveBeenCalled();
  });

  test("GET /tables returns 401 with missing token", async () => {
    const res = await request(app).get("/tables");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("No token provided");
  });

  test("GET /tables returns 401 with malformed token header", async () => {
    const res = await request(app)
      .get("/tables")
      .set("Authorization", `Token ${managerToken}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Malformed authorization header");
    expect(tableService.getAllTables).not.toHaveBeenCalled();
  });

  test("POST /tables maps INVALID_TABLE_DATA to 400", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    tableService.createTable.mockRejectedValueOnce(new Error("INVALID_TABLE_DATA"));

    const res = await request(app)
      .post("/tables")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ table_number: "A1", capacity: 4 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid table data");
    consoleSpy.mockRestore();
  });

  test("POST /tables maps duplicate constraint to 409", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const duplicateErr = new Error("duplicate");
    duplicateErr.code = "23505";
    tableService.createTable.mockRejectedValueOnce(duplicateErr);

    const res = await request(app)
      .post("/tables")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ table_number: "A1", capacity: 4 });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Duplicate value violates unique constraint");
    consoleSpy.mockRestore();
  });

  test("GET /tables/:id maps TABLE_NOT_FOUND to 404", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    tableService.getTableById.mockRejectedValueOnce(new Error("TABLE_NOT_FOUND"));

    const res = await request(app)
      .get("/tables/1")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Table not found");
    consoleSpy.mockRestore();
  });

  test("PUT /tables/:id maps TABLE_NOT_FOUND to 404", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    tableService.updateTable.mockRejectedValueOnce(new Error("TABLE_NOT_FOUND"));

    const res = await request(app)
      .put("/tables/999")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ capacity: 5 });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Table not found");
    consoleSpy.mockRestore();
  });

  test("PUT /tables/:id maps referenced resource error to 409 when table has related orders", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const referencedErr = new Error("referenced");
    referencedErr.code = "23503";
    tableService.updateTable.mockRejectedValueOnce(referencedErr);

    const res = await request(app)
      .put("/tables/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ table_number: "B2" });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Resource is still referenced by related data");
    consoleSpy.mockRestore();
  });

  test("DELETE /tables/:id maps TABLE_IN_USE to 409", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    tableService.deleteTable.mockRejectedValueOnce(new Error("TABLE_IN_USE"));

    const res = await request(app)
      .delete("/tables/1")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Table is still used by existing orders");
    consoleSpy.mockRestore();
  });

  test("DELETE /tables/:id maps TABLE_NOT_FOUND to 404", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    tableService.deleteTable.mockRejectedValueOnce(new Error("TABLE_NOT_FOUND"));

    const res = await request(app)
      .delete("/tables/999")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Table not found");
    consoleSpy.mockRestore();
  });

  test("DELETE /tables/:id returns 404 on repeated delete retry", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    tableService.deleteTable
      .mockResolvedValueOnce({ id: 1, table_number: "A1", capacity: 4 })
      .mockRejectedValueOnce(new Error("TABLE_NOT_FOUND"));

    const first = await request(app)
      .delete("/tables/1")
      .set("Authorization", `Bearer ${managerToken}`);

    const second = await request(app)
      .delete("/tables/1")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(404);
    expect(second.body.message).toBe("Table not found");
    expect(tableService.deleteTable).toHaveBeenCalledTimes(2);
    consoleSpy.mockRestore();
  });
});
