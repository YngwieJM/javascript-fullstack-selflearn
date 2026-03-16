const request = require("supertest");
const ordersRoutes = require("../routes/orders.routes");
const orderService = require("../services/orders.service");
const { createRouteTestApp } = require("./helpers/createRouteTestApp");

jest.mock("../services/orders.service", () => ({
  createOrder: jest.fn(),
  addItemToOrder: jest.fn(),
  getAllOrders: jest.fn(),
  getOrderById: jest.fn(),
  closeOrder: jest.fn(),
  deleteOrder: jest.fn()
}));

describe("Orders routes (stateful session + role checks)", () => {
  const app = createRouteTestApp("/orders", ordersRoutes);

  beforeEach(() => {
    orderService.createOrder.mockResolvedValue({ id: 1, table_id: 1, staff_id: 1, status: "OPEN" });
    orderService.getAllOrders.mockResolvedValue([{ id: 1, status: "OPEN" }]);
    orderService.getOrderById.mockResolvedValue({ id: 1, status: "OPEN", items: [] });
    orderService.addItemToOrder.mockResolvedValue({ id: 99, order_id: 1, menu_item_id: 1, quantity: 1 });
    orderService.closeOrder.mockResolvedValue({ id: 1, status: "CLOSED" });
    orderService.deleteOrder.mockResolvedValue({ id: 1 });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  async function loginAs(role) {
    const agent = request.agent(app);
    await agent.post("/__test/session").send({ id: 1, role, email: `${role.toLowerCase()}@test.com` });
    return agent;
  }

  test("GET /orders returns 401 without session", async () => {
    const res = await request(app).get("/orders");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  test("GET /orders returns 403 for WAITER and 200 for MANAGER", async () => {
    const waiter = await loginAs("WAITER");
    const manager = await loginAs("MANAGER");

    const waiterRes = await waiter.get("/orders");
    expect(waiterRes.status).toBe(403);
    expect(waiterRes.body.message).toBe("Access forbidden");

    const managerRes = await manager.get("/orders");
    expect(managerRes.status).toBe(200);
    expect(managerRes.body.message).toBe("All Orders");
    expect(orderService.getAllOrders).toHaveBeenCalledTimes(1);
  });

  test("POST /orders creates order for WAITER with valid payload", async () => {
    const waiter = await loginAs("WAITER");
    const res = await waiter.post("/orders").send({ table_id: 1, staff_id: 1 });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Order Created");
    expect(orderService.createOrder).toHaveBeenCalledWith(1, 1);
  });

  test("POST /orders rejects invalid payload", async () => {
    const waiter = await loginAs("WAITER");
    const res = await waiter.post("/orders").send({ table_id: 1 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(orderService.createOrder).not.toHaveBeenCalled();
  });
});

