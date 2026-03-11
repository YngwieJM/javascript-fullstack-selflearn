jest.mock("../config/db", () => ({
  query: jest.fn()
}));

const pool = require("../config/db");
const menuService = require("../services/menu.service");

describe("Menu service unit QA", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("createMenuItem throws INVALID_MENU_DATA for missing input", async () => {
    await expect(menuService.createMenuItem("", "FOOD", 10)).rejects.toThrow("INVALID_MENU_DATA");
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("createMenuItem inserts and returns created menu item", async () => {
    const row = { id: 1, name: "Burger", category: "FOOD", price: 50 };
    pool.query.mockResolvedValueOnce({ rows: [row] });

    const result = await menuService.createMenuItem("Burger", "FOOD", 50);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO menu_items"),
      ["Burger", "FOOD", 50]
    );
    expect(result).toEqual(row);
  });

  test("getMenuItemById throws MENU_ITEM_NOT_FOUND when row is missing", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await expect(menuService.getMenuItemById(999)).rejects.toThrow("MENU_ITEM_NOT_FOUND");
  });

  test("deleteMenuItem throws MENU_ITEM_NOT_FOUND when row is missing", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await expect(menuService.deleteMenuItem(999)).rejects.toThrow("MENU_ITEM_NOT_FOUND");
  });
});

test("createMenuItem accepts zero price", async () => {
  const row = { id: 2, name: "Free Water", category: "DRINK", price: 0 };
  pool.query.mockResolvedValueOnce({ rows: [row] });

  const result = await menuService.createMenuItem("Free Water", "DRINK", 0);

  expect(pool.query).toHaveBeenCalledWith(
    expect.stringContaining("INSERT INTO menu_items"),
    ["Free Water", "DRINK", 0]
  );
  expect(result).toEqual(row);
});

