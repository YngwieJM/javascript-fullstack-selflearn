jest.mock("../config/db", () => ({
  query: jest.fn(),
  connect: jest.fn()
}));

const pool = require("../config/db");
const ordersService = require("../services/orders.service");

describe("orders service unit", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("createOrder throws TABLE_NOT_FOUND when table does not exist", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await expect(ordersService.createOrder(999, 1)).rejects.toThrow("TABLE_NOT_FOUND");
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("createOrder throws STAFF_NOT_FOUND when staff does not exist", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(ordersService.createOrder(1, 999)).rejects.toThrow("STAFF_NOT_FOUND");
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test("createOrder inserts order and returns row", async () => {
    const row = { id: 10, table_id: 1, staff_id: 2, status: "OPEN" };
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 2 }] })
      .mockResolvedValueOnce({ rows: [row] });

    const result = await ordersService.createOrder(1, 2);

    expect(pool.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("INSERT INTO orders"),
      [1, 2]
    );
    expect(result).toEqual(row);
  });

  test("addItemToOrder throws INVALID_QUANTITY before opening transaction", async () => {
    await expect(ordersService.addItemToOrder(1, 2, 0)).rejects.toThrow("INVALID_QUANTITY");
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test("addItemToOrder rolls back when order is missing", async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({});

    await expect(ordersService.addItemToOrder(999, 1, 1)).rejects.toThrow("ORDER_NOT_FOUND");

    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test("addItemToOrder rolls back when order is closed", async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 1, status: "CLOSED" }] })
      .mockResolvedValueOnce({});

    await expect(ordersService.addItemToOrder(1, 1, 1)).rejects.toThrow("ORDER_CLOSED");
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
  });

  test("addItemToOrder rolls back when menu is unavailable", async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 1, status: "OPEN" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({});

    await expect(ordersService.addItemToOrder(1, 999, 1)).rejects.toThrow("MENU_NOT_AVAILABLE");
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
  });

  test("addItemToOrder commits on success", async () => {
    const inserted = { id: 99, order_id: 1, menu_item_id: 3, quantity: 2, price_at_time: "20000" };
    const client = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 1, status: "OPEN" }] })
      .mockResolvedValueOnce({ rows: [{ id: 3, price: 20000, is_available: true }] })
      .mockResolvedValueOnce({ rows: [inserted] })
      .mockResolvedValueOnce({});

    const result = await ordersService.addItemToOrder(1, 3, 2);

    expect(result).toEqual(inserted);
    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(client.query).toHaveBeenNthCalledWith(5, "COMMIT");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test("getOrderById throws ORDER_NOT_FOUND when order row is missing", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await expect(ordersService.getOrderById(999)).rejects.toThrow("ORDER_NOT_FOUND");
  });

  test("closeOrder throws ORDER_NOT_FOUND_OR_ALREADY_CLOSED when update has no rows", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await expect(ordersService.closeOrder(999)).rejects.toThrow("ORDER_NOT_FOUND_OR_ALREADY_CLOSED");
  });

  test("deleteOrder throws ORDER_NOT_FOUND when delete has no rows", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await expect(ordersService.deleteOrder(999)).rejects.toThrow("ORDER_NOT_FOUND");
  });
});

