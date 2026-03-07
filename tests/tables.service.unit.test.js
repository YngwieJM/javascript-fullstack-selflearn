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
