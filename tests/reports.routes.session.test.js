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

  test.each([
    ["/reports/daily-sales", "getDailySales"],
    ["/reports/top-menu", "getTopMenuItems"],
    ["/reports/revenue", "getRevenue"],
    ["/reports/sales-by-staff", "getSalesByStaff"],
    ["/reports/sales-by-category", "getSalesByCategory"]
  ])("GET %s allows MANAGER", async (path, methodName) => {
    const manager = await loginAs("MANAGER");

    const res = await manager.get(path);

    expect(res.status).toBe(200);
    expect(reportsService[methodName]).toHaveBeenCalledTimes(1);
  });

  test.each([
    "/reports/daily-sales",
    "/reports/top-menu",
    "/reports/revenue",
    "/reports/sales-by-staff",
    "/reports/sales-by-category",
    "/reports/hourly-sales"
  ])("GET %s blocks WAITER", async (path) => {
    const waiter = await loginAs("WAITER");

    const res = await waiter.get(path);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Access forbidden");
  });

  test("GET /reports/top-menu returns 500 when service throws", async () => {
    reportsService.getTopMenuItems.mockRejectedValueOnce(new Error("DB_DOWN"));
    const manager = await loginAs("MANAGER");

    const res = await manager.get("/reports/top-menu");

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Internal Server Error");
  });
});
