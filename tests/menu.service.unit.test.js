jest.mock("../config/db", () => ({
  query: jest.fn()
}));

const pool = require("../config/db");
const menuService = require("../services/menu.service");

describe("menu service unit", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("getAllMenuItems returns rows", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, name: "Latte", category: "DRINK", price: "25000", is_available: true }]
    });

    const result = await menuService.getAllMenuItems();

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("FROM menu_items"));
    expect(result).toHaveLength(1);
  });

  test("createMenuItem throws INVALID_MENU_DATA when input is missing", async () => {
    await expect(menuService.createMenuItem("", "FOOD", 20000)).rejects.toThrow("INVALID_MENU_DATA");
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("createMenuItem inserts and returns created item", async () => {
    const row = { id: 2, name: "Sate Ayam", category: "FOOD", price: "45000" };
    pool.query.mockResolvedValueOnce({ rows: [row] });

    const result = await menuService.createMenuItem("Sate Ayam", "FOOD", 45000);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO menu_items"),
      ["Sate Ayam", "FOOD", 45000]
    );
    expect(result).toEqual(row);
  });

  test("getMenuItemById throws MENU_ITEM_NOT_FOUND when row is missing", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await expect(menuService.getMenuItemById(999)).rejects.toThrow("MENU_ITEM_NOT_FOUND");
  });

  test("updateMenuItem throws MENU_ITEM_NOT_FOUND when row is missing", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await expect(menuService.updateMenuItem(999, "X", "FOOD", 10000)).rejects.toThrow(
      "MENU_ITEM_NOT_FOUND"
    );
  });

  test("toggleAvailability throws MENU_ITEM_NOT_FOUND when row is missing", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await expect(menuService.toggleAvailability(999, false)).rejects.toThrow("MENU_ITEM_NOT_FOUND");
  });

  test("deleteMenuItem throws MENU_ITEM_NOT_FOUND when row is missing", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await expect(menuService.deleteMenuItem(999)).rejects.toThrow("MENU_ITEM_NOT_FOUND");
  });
});

