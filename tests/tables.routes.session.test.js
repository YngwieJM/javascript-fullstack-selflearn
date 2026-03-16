const request = require("supertest");
const tablesRoutes = require("../routes/tables.routes");
const tablesService = require("../services/tables.service");
const { createRouteTestApp } = require("./helpers/createRouteTestApp");

jest.mock("../services/tables.service", () => ({
  createTable: jest.fn(),
  updateTable: jest.fn(),
  getAllTables: jest.fn(),
  getTableById: jest.fn(),
  deleteTable: jest.fn()
}));

describe("Tables routes (stateful session + role checks)", () => {
  const app = createRouteTestApp("/tables", tablesRoutes);

  beforeEach(() => {
    tablesService.createTable.mockResolvedValue({ id: 1, table_number: "VIP 1", capacity: 4 });
    tablesService.updateTable.mockResolvedValue({ id: 1, table_number: "VIP 2", capacity: 6 });
    tablesService.getAllTables.mockResolvedValue([{ id: 1, table_number: "VIP 1", capacity: 4 }]);
    tablesService.getTableById.mockResolvedValue({ id: 1, table_number: "VIP 1", capacity: 4 });
    tablesService.deleteTable.mockResolvedValue({ id: 1, table_number: "VIP 1", capacity: 4 });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  async function loginAs(role) {
    const agent = request.agent(app);
    await agent.post("/__test/session").send({ id: 1, role, email: `${role.toLowerCase()}@test.com` });
    return agent;
  }

  test("GET /tables returns 401 without session", async () => {
    const res = await request(app).get("/tables");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  test("POST /tables is manager-only", async () => {
    const waiter = await loginAs("WAITER");
    const manager = await loginAs("MANAGER");

    const waiterRes = await waiter.post("/tables").send({ table_number: "VIP 1", capacity: 4 });
    expect(waiterRes.status).toBe(403);
    expect(waiterRes.body.message).toBe("Access forbidden");

    const managerRes = await manager.post("/tables").send({ table_number: "VIP 1", capacity: 4 });
    expect(managerRes.status).toBe(201);
    expect(tablesService.createTable).toHaveBeenCalledWith("VIP 1", 4);
  });

  test("GET /tables allows MANAGER and WAITER", async () => {
    const manager = await loginAs("MANAGER");
    const waiter = await loginAs("WAITER");

    const managerRes = await manager.get("/tables");
    expect(managerRes.status).toBe(200);

    const waiterRes = await waiter.get("/tables");
    expect(waiterRes.status).toBe(200);

    expect(tablesService.getAllTables).toHaveBeenCalledTimes(2);
  });

  test("PUT /tables/:id updates table for manager", async () => {
    const manager = await loginAs("MANAGER");

    const res = await manager.put("/tables/1").send({ table_number: "VIP 2", capacity: 6 });

    expect(res.status).toBe(200);
    expect(tablesService.updateTable).toHaveBeenCalledWith("1", "VIP 2", 6);
  });

  test("GET /tables/:id validates malformed id", async () => {
    const manager = await loginAs("MANAGER");

    const res = await manager.get("/tables/abc");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(tablesService.getTableById).not.toHaveBeenCalled();
  });

  test("DELETE /tables/:id maps TABLE_IN_USE to 409", async () => {
    tablesService.deleteTable.mockRejectedValueOnce(new Error("TABLE_IN_USE"));
    const manager = await loginAs("MANAGER");

    const res = await manager.delete("/tables/1");

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Table is still used by existing orders");
  });

  test("DELETE /tables/:id maps TABLE_NOT_FOUND to 404", async () => {
    tablesService.deleteTable.mockRejectedValueOnce(new Error("TABLE_NOT_FOUND"));
    const manager = await loginAs("MANAGER");

    const res = await manager.delete("/tables/999");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Table not found");
  });
});

