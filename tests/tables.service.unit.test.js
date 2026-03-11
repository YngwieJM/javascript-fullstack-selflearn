jest.mock("../config/db", () => ({
  query: jest.fn()
}));

const pool = require("../config/db");
const tableService = require("../services/tables.service");

describe("Tables service unit QA", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("createTable throws INVALID_TABLE_DATA for missing input", async () => {
    await expect(tableService.createTable("", 4)).rejects.toThrow("INVALID_TABLE_DATA");
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("getAllTables applies LIMIT/OFFSET correctly for requested page", async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 3, table_number: "B1", capacity: 4 }]
      })
      .mockResolvedValueOnce({
        rows: [{ count: "24" }]
      });

    const result = await tableService.getAllTables(2, 10);

    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("LIMIT $1 OFFSET $2"),
      [10, 10]
    );
    expect(pool.query).toHaveBeenNthCalledWith(2, "SELECT COUNT(*) FROM restaurant_tables");
    expect(result).toEqual(
      expect.objectContaining({
        page: 2,
        limit: 10,
        total: 24,
        total_pages: 3
      })
    );
    expect(result.data).toHaveLength(1);
  });

  test("getAllTables uses defaults when page and limit are omitted", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] });

    const result = await tableService.getAllTables();

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

  test("deleteTable throws TABLE_IN_USE when table is referenced by orders", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ exists: 1 }] });

    await expect(tableService.deleteTable(1)).rejects.toThrow("TABLE_IN_USE");
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("deleteTable throws TABLE_NOT_FOUND when target table does not exist", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // order reference check
      .mockResolvedValueOnce({ rows: [] }); // delete

    await expect(tableService.deleteTable(999)).rejects.toThrow("TABLE_NOT_FOUND");
  });

  test("deleteTable returns deleted row when successful", async () => {
    const deleted = { id: 1, table_number: "A1", capacity: 4 };
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [deleted] });

    const result = await tableService.deleteTable(1);

    expect(result).toEqual(deleted);
  });
});
