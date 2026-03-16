const request = require("supertest");
const menuRoutes = require("../routes/menu.routes");
const menuService = require("../services/menu.service");
const { createRouteTestApp } = require("./helpers/createRouteTestApp");

jest.mock("../services/menu.service", () => ({
  createMenuItem: jest.fn(),
  getAllMenuItems: jest.fn(),
  getMenuItemById: jest.fn(),
  updateMenuItem: jest.fn(),
  toggleAvailability: jest.fn(),
  deleteMenuItem: jest.fn()
}));

describe("Menu routes (stateful session + role checks)", () => {
  const app = createRouteTestApp("/menu", menuRoutes);

  beforeEach(() => {
    menuService.createMenuItem.mockResolvedValue({
      id: 1,
      name: "Nasi Goreng",
      category: "FOOD",
      price: "30000"
    });
    menuService.getAllMenuItems.mockResolvedValue([
      { id: 1, name: "Nasi Goreng", category: "FOOD", price: "30000", is_available: true }
    ]);
    menuService.getMenuItemById.mockResolvedValue({
      id: 1,
      name: "Nasi Goreng",
      category: "FOOD",
      price: "30000",
      is_available: true
    });
    menuService.updateMenuItem.mockResolvedValue({
      id: 1,
      name: "Nasi Goreng Special",
      category: "FOOD",
      price: "35000",
      is_available: true
    });
    menuService.toggleAvailability.mockResolvedValue({
      id: 1,
      is_available: false
    });
    menuService.deleteMenuItem.mockResolvedValue({
      id: 1,
      name: "Nasi Goreng Special"
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  async function loginAs(role) {
    const agent = request.agent(app);
    await agent.post("/__test/session").send({ id: 1, role, email: `${role.toLowerCase()}@test.com` });
    return agent;
  }

  test("GET /menu returns 401 without session", async () => {
    const res = await request(app).get("/menu");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  test.each(["WAITER", "BARTENDER", "MANAGER"])("GET /menu allows %s", async (role) => {
    const agent = await loginAs(role);

    const res = await agent.get("/menu");

    expect(res.status).toBe(200);
    expect(menuService.getAllMenuItems).toHaveBeenCalledTimes(1);
  });

  test("POST /menu is manager-only", async () => {
    const waiter = await loginAs("WAITER");
    const manager = await loginAs("MANAGER");
    const payload = { name: "Es Teh", category: "DRINK", price: 12000 };

    const waiterRes = await waiter.post("/menu").send(payload);
    expect(waiterRes.status).toBe(403);
    expect(waiterRes.body.message).toBe("Access forbidden");

    const managerRes = await manager.post("/menu").send(payload);
    expect(managerRes.status).toBe(200);
    expect(menuService.createMenuItem).toHaveBeenCalledWith("Es Teh", "DRINK", 12000);
  });

  test("POST /menu rejects invalid payload", async () => {
    const manager = await loginAs("MANAGER");

    const res = await manager.post("/menu").send({ name: "X", category: "FOOD", price: -1 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(menuService.createMenuItem).not.toHaveBeenCalled();
  });

  test("GET /menu/:id validates id and returns item", async () => {
    const manager = await loginAs("MANAGER");
    const invalidRes = await manager.get("/menu/abc");
    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.message).toBe("Validation error");

    const okRes = await manager.get("/menu/1");
    expect(okRes.status).toBe(200);
    expect(menuService.getMenuItemById).toHaveBeenCalledWith("1");
  });

  test("PATCH /menu/:id updates menu item for manager", async () => {
    const manager = await loginAs("MANAGER");

    const res = await manager.patch("/menu/1").send({ price: 35000 });

    expect(res.status).toBe(200);
    expect(menuService.updateMenuItem).toHaveBeenCalledWith("1", undefined, undefined, 35000);
  });

  test("PATCH /menu/:id/availability updates availability for manager", async () => {
    const manager = await loginAs("MANAGER");

    const res = await manager.patch("/menu/1/availability").send({ is_available: false });

    expect(res.status).toBe(200);
    expect(menuService.toggleAvailability).toHaveBeenCalledWith("1", false);
  });

  test("DELETE /menu/:id deletes menu for manager", async () => {
    const manager = await loginAs("MANAGER");

    const res = await manager.delete("/menu/1");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Menu item deleted");
    expect(menuService.deleteMenuItem).toHaveBeenCalledWith("1");
  });

  test("DELETE /menu/:id maps MENU_ITEM_NOT_FOUND to 404", async () => {
    menuService.deleteMenuItem.mockRejectedValueOnce(new Error("MENU_ITEM_NOT_FOUND"));
    const manager = await loginAs("MANAGER");

    const res = await manager.delete("/menu/999");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Menu item not found");
  });
});

