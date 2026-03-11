const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/env");
const { errorHandler } = require("../middleware/error.middleware");

jest.mock("../services/reports.service", () => ({
  getDailySales: jest.fn(),
  getTopMenuItems: jest.fn(),
  getRevenue: jest.fn(),
  getSalesByStaff: jest.fn(),
  getSalesByCategory: jest.fn(),
  getHourlySales: jest.fn()
}));

const reportsService = require("../services/reports.service");
const reportsRoutes = require("../routes/reports.routes");

function makeToken(role, id = 1) {
  return jwt.sign({ id, role }, jwtSecret, { expiresIn: "1h" });
}

function makeExpiredToken(role, id = 1) {
  return jwt.sign({ id, role }, jwtSecret, { expiresIn: -1 });
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/reports", reportsRoutes);
  app.use(errorHandler);
  return app;
}

describe("Reports routes smoke", () => {
  let app;
  const managerToken = makeToken("MANAGER");
  const waiterToken = makeToken("WAITER");

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    reportsService.getDailySales.mockResolvedValue([{ date: "2026-03-11", total_orders: "3", total_revenue: "150" }]);
    reportsService.getTopMenuItems.mockResolvedValue([{ name: "Burger", total_sold: "8" }]);
    reportsService.getRevenue.mockResolvedValue({ total_revenue: "150" });
    reportsService.getSalesByStaff.mockResolvedValue([{ id: 1, name: "John", total_orders: "4", total_revenue: "280" }]);
    reportsService.getSalesByCategory.mockResolvedValue([{ category: "FOOD", total_items_sold: "12", total_revenue: "560" }]);
    reportsService.getHourlySales.mockResolvedValue([{ hour: "19:00", total_orders: "2", total_revenue: "140" }]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("GET /reports/daily-sales allows MANAGER", async () => {
    const res = await request(app)
      .get("/reports/daily-sales")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ date: "2026-03-11", total_orders: "3", total_revenue: "150" }]);
    expect(reportsService.getDailySales).toHaveBeenCalledTimes(1);
  });

  test("GET /reports/top-menu allows MANAGER", async () => {
    const res = await request(app)
      .get("/reports/top-menu")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ name: "Burger", total_sold: "8" }]);
    expect(reportsService.getTopMenuItems).toHaveBeenCalledTimes(1);
  });

  test("GET /reports/revenue allows MANAGER", async () => {
    const res = await request(app)
      .get("/reports/revenue")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ total_revenue: "150" });
    expect(reportsService.getRevenue).toHaveBeenCalledTimes(1);
  });

  test("GET /reports/sales-by-staff allows MANAGER", async () => {
    const res = await request(app)
      .get("/reports/sales-by-staff")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1, name: "John", total_orders: "4", total_revenue: "280" }]);
    expect(reportsService.getSalesByStaff).toHaveBeenCalledTimes(1);
  });

  test("GET /reports/sales-by-category allows MANAGER", async () => {
    const res = await request(app)
      .get("/reports/sales-by-category")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ category: "FOOD", total_items_sold: "12", total_revenue: "560" }]);
    expect(reportsService.getSalesByCategory).toHaveBeenCalledTimes(1);
  });

  test("GET /reports/hourly-sales allows MANAGER", async () => {
    const res = await request(app)
      .get("/reports/hourly-sales")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ hour: "19:00", total_orders: "2", total_revenue: "140" }]);
    expect(reportsService.getHourlySales).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["/reports/daily-sales"],
    ["/reports/top-menu"],
    ["/reports/revenue"],
    ["/reports/sales-by-staff"],
    ["/reports/sales-by-category"],
    ["/reports/hourly-sales"]
  ])("GET %s returns 401 when token is missing", async (path) => {
    const res = await request(app).get(path);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("No token provided");
  });

  test.each([
    ["/reports/daily-sales"],
    ["/reports/top-menu"],
    ["/reports/revenue"],
    ["/reports/sales-by-staff"],
    ["/reports/sales-by-category"],
    ["/reports/hourly-sales"]
  ])("GET %s blocks WAITER", async (path) => {
    const res = await request(app)
      .get(path)
      .set("Authorization", `Bearer ${waiterToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Access forbidden");
  });

  test.each([
    ["malformed header", "Token bad", "Malformed authorization header"],
    ["invalid token", "Bearer not.a.real.token", "Invalid or expired token"],
    ["expired token", `Bearer ${makeExpiredToken("MANAGER")}`, "Invalid or expired token"],
    ["extra token segments", `Bearer ${managerToken} trailing`, "Malformed authorization header"]
  ])("GET /reports/revenue returns 401 for %s", async (_name, authHeader, expectedMessage) => {
    const res = await request(app)
      .get("/reports/revenue")
      .set("Authorization", authHeader);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe(expectedMessage);
    expect(reportsService.getRevenue).not.toHaveBeenCalled();
  });

  test("GET /reports/top-menu returns 500 when service throws", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    reportsService.getTopMenuItems.mockRejectedValueOnce(new Error("DB_DOWN"));

    const res = await request(app)
      .get("/reports/top-menu")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Internal Server Error");
    consoleSpy.mockRestore();
  });

  test("GET /reports/hourly-sales returns 500 when service throws", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    reportsService.getHourlySales.mockRejectedValueOnce(new Error("DB_DOWN"));

    const res = await request(app)
      .get("/reports/hourly-sales")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Internal Server Error");
    consoleSpy.mockRestore();
  });
});
