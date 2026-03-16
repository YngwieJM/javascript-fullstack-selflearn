jest.mock("../config/db", () => ({
  query: jest.fn()
}));

const pool = require("../config/db");
const tablesService = require("../services/tables.service");

describe("tables service unit", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("createTable throws INVALID_TABLE_DATA for missing input", async () => {
    await expect(tablesService.createTable("", 4)).rejects.toThrow("INVALID_TABLE_DATA");
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("getTableById throws TABLE_NOT_FOUND when row is missing", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await expect(tablesService.getTableById(999)).rejects.toThrow("TABLE_NOT_FOUND");
  });

  test("deleteTable throws TABLE_IN_USE when referenced by orders", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });

    await expect(tablesService.deleteTable(1)).rejects.toThrow("TABLE_IN_USE");
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("deleteTable throws TABLE_NOT_FOUND when delete row is missing", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(tablesService.deleteTable(999)).rejects.toThrow("TABLE_NOT_FOUND");
  });

  test("deleteTable returns deleted row on success", async () => {
    const deleted = { id: 1, table_number: "VIP 1", capacity: 4 };
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [deleted] });

    const result = await tablesService.deleteTable(1);

    expect(result).toEqual(deleted);
  });
});

