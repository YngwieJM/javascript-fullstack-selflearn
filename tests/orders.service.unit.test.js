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

  test("createOrder fails cleanly when table reference is invalid", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // table check

    await expect(
      ordersService.createOrder(999, 1, { id: 1, role: "MANAGER" })
    ).rejects.toThrow("TABLE_NOT_FOUND");

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(
      pool.query.mock.calls.some(
        ([sql]) => typeof sql === "string" && sql.includes("INSERT INTO orders")
      )
    ).toBe(false);
  });

  test("createOrder fails cleanly when staff reference is invalid", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // table check
      .mockResolvedValueOnce({ rows: [] }); // staff check

    await expect(
      ordersService.createOrder(1, 999, { id: 1, role: "MANAGER" })
    ).rejects.toThrow("STAFF_NOT_FOUND");

    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(
      pool.query.mock.calls.some(
        ([sql]) => typeof sql === "string" && sql.includes("INSERT INTO orders")
      )
    ).toBe(false);
  });

  test("addItemToOrder rolls back and does not insert when order is not found", async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValueOnce(client);

    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // order check
      .mockResolvedValueOnce({}); // ROLLBACK

    await expect(
      ordersService.addItemToOrder(99, 1, 1, { id: 7, role: "WAITER" })
    ).rejects.toThrow("ORDER_NOT_FOUND");

    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(client.query).toHaveBeenNthCalledWith(2, "SELECT * FROM orders WHERE id = $1", [99]);
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(
      client.query.mock.calls.some(
        ([sql]) => typeof sql === "string" && sql.includes("INSERT INTO order_items")
      )
    ).toBe(false);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test("addItemToOrder rolls back waiter cross-order access and skips mutation", async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValueOnce(client);

    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 10, staff_id: 2, status: "OPEN" }] }) // order check
      .mockResolvedValueOnce({}); // ROLLBACK

    await expect(
      ordersService.addItemToOrder(10, 1, 1, { id: 7, role: "WAITER" })
    ).rejects.toThrow("ORDER_FORBIDDEN");

    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(
      client.query.mock.calls.some(
        ([sql]) => typeof sql === "string" && sql.includes("FROM menu_items")
      )
    ).toBe(false);
    expect(
      client.query.mock.calls.some(
        ([sql]) => typeof sql === "string" && sql.includes("INSERT INTO order_items")
      )
    ).toBe(false);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test("addItemToOrder rolls back when menu item is unavailable", async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValueOnce(client);

    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 10, staff_id: 7, status: "OPEN" }] }) // order check
      .mockResolvedValueOnce({ rows: [] }) // menu check
      .mockResolvedValueOnce({}); // ROLLBACK

    await expect(
      ordersService.addItemToOrder(10, 99, 1, { id: 7, role: "WAITER" })
    ).rejects.toThrow("MENU_NOT_AVAILABLE");

    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(
      client.query.mock.calls.some(
        ([sql]) => typeof sql === "string" && sql.includes("INSERT INTO order_items")
      )
    ).toBe(false);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test("addItemToOrder rolls back when insert fails", async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValueOnce(client);

    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 10, staff_id: 7, status: "OPEN" }] }) // order check
      .mockResolvedValueOnce({ rows: [{ id: 5, price: 50, is_available: true }] }) // menu check
      .mockRejectedValueOnce(new Error("insert-failed")) // insert
      .mockResolvedValueOnce({}); // ROLLBACK

    await expect(
      ordersService.addItemToOrder(10, 5, 1, { id: 7, role: "WAITER" })
    ).rejects.toThrow("insert-failed");

    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(
      client.query.mock.calls.some(([sql]) => typeof sql === "string" && sql === "COMMIT")
    ).toBe(false);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test("addItemToOrder commits transaction on success", async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValueOnce(client);

    const insertedRow = { id: 100, order_id: 10, menu_item_id: 5, quantity: 2, price_at_time: 50 };
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 10, staff_id: 7, status: "OPEN" }] }) // order check
      .mockResolvedValueOnce({ rows: [{ id: 5, price: 50, is_available: true }] }) // menu check
      .mockResolvedValueOnce({ rows: [insertedRow] }) // insert
      .mockResolvedValueOnce({}); // COMMIT

    const result = await ordersService.addItemToOrder(10, 5, 2, { id: 7, role: "WAITER" });

    expect(result).toEqual(insertedRow);
    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(client.query).toHaveBeenNthCalledWith(5, "COMMIT");
    expect(
      client.query.mock.calls.some(([sql]) => typeof sql === "string" && sql === "ROLLBACK")
    ).toBe(false);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test("closeOrder fails invalid state transition when order is already closed", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 10, status: "CLOSED", staff_id: 7 }]
    });

    await expect(
      ordersService.closeOrder(10, { id: 7, role: "WAITER" })
    ).rejects.toThrow("ORDER_NOT_FOUND_OR_ALREADY_CLOSED");

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(
      pool.query.mock.calls.some(
        ([sql]) => typeof sql === "string" && sql.includes("UPDATE orders SET status = 'CLOSED'")
      )
    ).toBe(false);
  });

  test("closeOrder blocks waiter from closing other waiter's order without mutation", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 10, status: "OPEN", staff_id: 2 }]
    });

    await expect(
      ordersService.closeOrder(10, { id: 7, role: "WAITER" })
    ).rejects.toThrow("ORDER_FORBIDDEN");

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(
      pool.query.mock.calls.some(
        ([sql]) => typeof sql === "string" && sql.includes("UPDATE orders SET status = 'CLOSED'")
      )
    ).toBe(false);
  });

  test("getAllOrders applies LIMIT/OFFSET correctly for requested page", async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 11, status: "OPEN", table_number: "T1", staff_name: "John" }]
      })
      .mockResolvedValueOnce({
        rows: [{ count: "42" }]
      });

    const result = await ordersService.getAllOrders(2, 10);

    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("LIMIT $1 OFFSET $2"),
      [10, 10]
    );
    expect(pool.query).toHaveBeenNthCalledWith(2, "SELECT COUNT(*) FROM orders");
    expect(result).toEqual(
      expect.objectContaining({
        page: 2,
        limit: 10,
        total: 42,
        total_pages: 5
      })
    );
    expect(result.data).toHaveLength(1);
  });

  test("getAllOrders uses default pagination when page and limit are omitted", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] });

    const result = await ordersService.getAllOrders();

    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("LIMIT $1 OFFSET $2"),
      [10, 0]
    );
    expect(result).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      total_pages: 0,
      data: []
    });
  });
});
