const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/env");
const { errorHandler } = require("../middleware/error.middleware");

jest.mock("../services/reports.service", () => ({
  getDailySales: jest.fn(),
  getTopMenuItems: jest.fn(),
  getRevenue: jest.fn()
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

  test.each([
    ["/reports/daily-sales"],
    ["/reports/top-menu"],
    ["/reports/revenue"]
  ])("GET %s returns 401 when token is missing", async (path) => {
    const res = await request(app).get(path);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("No token provided");
  });

  test.each([
    ["/reports/daily-sales"],
    ["/reports/top-menu"],
    ["/reports/revenue"]
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
});
