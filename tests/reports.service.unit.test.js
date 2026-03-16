jest.mock("../config/db", () => ({
  query: jest.fn()
}));

const pool = require("../config/db");
const reportsService = require("../services/reports.service");

describe("reports service unit", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("getRevenue returns first row", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ total_revenue: "120000" }] });

    const result = await reportsService.getRevenue();

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("SUM(oi.quantity * oi.price_at_time)"));
    expect(result).toEqual({ total_revenue: "120000" });
  });

  test("getHourlySales with date applies date filter and binds parameter", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ hour: "16-03-2026 19:00:00", total_orders: 4, total_revenue: "180000" }]
    });

    const result = await reportsService.getHourlySales("2026-03-16");

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("AND DATE(o.created_at) = $1::date"),
      ["2026-03-16"]
    );
    expect(result).toHaveLength(1);
  });

  test("getHourlySales without date keeps all-time query behavior", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await reportsService.getHourlySales(undefined);

    expect(pool.query).toHaveBeenCalledWith(
      expect.not.stringContaining("AND DATE(o.created_at) = $1::date"),
      []
    );
  });
});

