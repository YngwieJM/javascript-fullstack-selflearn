jest.mock("../config/db", () => ({
  query: jest.fn(),
  connect: jest.fn()
}));

const pool = require("../config/db");
const ordersService = require("../services/orders.service");

describe("Orders service unit QA", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("createOrder uses waiter id even when body staff_id is different", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // table check
      .mockResolvedValueOnce({ rows: [{ id: 7, role: "WAITER" }] }) // staff check
      .mockResolvedValueOnce({ rows: [{ id: 10, table_id: 1, staff_id: 7, status: "OPEN" }] }); // insert

    const result = await ordersService.createOrder(1, 999, { id: 7, role: "WAITER" });

    expect(pool.query).toHaveBeenNthCalledWith(2, "SELECT * FROM staff WHERE id = $1", [7]);
    expect(pool.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("INSERT INTO orders"),
      [1, 7]
    );
    expect(result.staff_id).toBe(7);
  });

  test("createOrder allows waiter without staff_id in body", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // table check
      .mockResolvedValueOnce({ rows: [{ id: 7, role: "WAITER" }] }) // staff check
      .mockResolvedValueOnce({ rows: [{ id: 11, table_id: 1, staff_id: 7, status: "OPEN" }] }); // insert

    const result = await ordersService.createOrder(1, undefined, { id: 7, role: "WAITER" });

    expect(result.staff_id).toBe(7);
    expect(pool.query).toHaveBeenNthCalledWith(2, "SELECT * FROM staff WHERE id = $1", [7]);
  });

  test("createOrder rejects manager request when staff_id is missing", async () => {
    await expect(
      ordersService.createOrder(1, undefined, { id: 1, role: "MANAGER" })
    ).rejects.toThrow("STAFF_ID_REQUIRED");

    expect(pool.query).not.toHaveBeenCalled();
  });
});
