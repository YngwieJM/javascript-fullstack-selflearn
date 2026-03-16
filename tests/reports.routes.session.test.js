const request = require("supertest");
const reportsRoutes = require("../routes/reports.routes");
const reportsService = require("../services/reports.service");
const { createRouteTestApp } = require("./helpers/createRouteTestApp");

jest.mock("../services/reports.service", () => ({
  getDailySales: jest.fn(),
  getTopMenuItems: jest.fn(),
  getRevenue: jest.fn(),
  getSalesByStaff: jest.fn(),
  getSalesByCategory: jest.fn(),
  getHourlySales: jest.fn()
}));

describe("Reports routes (stateful session + date query)", () => {
  const app = createRouteTestApp("/reports", reportsRoutes);

  beforeEach(() => {
    reportsService.getDailySales.mockResolvedValue([]);
    reportsService.getTopMenuItems.mockResolvedValue([]);
    reportsService.getRevenue.mockResolvedValue({ total_revenue: "0.00" });
    reportsService.getSalesByStaff.mockResolvedValue([]);
    reportsService.getSalesByCategory.mockResolvedValue([]);
    reportsService.getHourlySales.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  async function loginAs(role) {
    const agent = request.agent(app);
    await agent.post("/__test/session").send({ id: 1, role, email: `${role.toLowerCase()}@test.com` });
    return agent;
  }

  test("GET /reports/hourly-sales returns 401 without session", async () => {
    const res = await request(app).get("/reports/hourly-sales");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  test("GET /reports/hourly-sales blocks WAITER and allows MANAGER", async () => {
    const waiter = await loginAs("WAITER");
    const manager = await loginAs("MANAGER");

    const waiterRes = await waiter.get("/reports/hourly-sales");
    expect(waiterRes.status).toBe(403);
    expect(waiterRes.body.message).toBe("Access forbidden");

    const managerRes = await manager.get("/reports/hourly-sales");
    expect(managerRes.status).toBe(200);
    expect(reportsService.getHourlySales).toHaveBeenCalledWith(undefined);
  });

  test("GET /reports/hourly-sales forwards valid date query to service", async () => {
    const manager = await loginAs("MANAGER");
    const res = await manager.get("/reports/hourly-sales?date=2026-03-14");

    expect(res.status).toBe(200);
    expect(reportsService.getHourlySales).toHaveBeenCalledWith("2026-03-14");
  });

  test("GET /reports/hourly-sales rejects invalid date format", async () => {
    const manager = await loginAs("MANAGER");
    const res = await manager.get("/reports/hourly-sales?date=14-03-2026");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(reportsService.getHourlySales).not.toHaveBeenCalled();
  });
});

