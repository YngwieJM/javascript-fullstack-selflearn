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

  test("POST /orders/:id/items adds item for WAITER with valid payload", async () => {
    const waiter = await loginAs("WAITER");

    const res = await waiter.post("/orders/1/items").send({ menu_item_id: 2, quantity: 3 });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Item added to order");
    expect(orderService.addItemToOrder).toHaveBeenCalledWith("1", 2, 3);
  });

  test("POST /orders/:id/items rejects invalid payload", async () => {
    const waiter = await loginAs("WAITER");

    const res = await waiter.post("/orders/abc/items").send({ menu_item_id: 2, quantity: 3 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(orderService.addItemToOrder).not.toHaveBeenCalled();
  });

  test("GET /orders/:id returns order for WAITER", async () => {
    const waiter = await loginAs("WAITER");

    const res = await waiter.get("/orders/1");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Order id of 1");
    expect(orderService.getOrderById).toHaveBeenCalledWith("1");
  });

  test("PATCH /orders/:id/close closes order for WAITER", async () => {
    const waiter = await loginAs("WAITER");

    const res = await waiter.patch("/orders/1/close").send({});

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Order of id 1 is closed");
    expect(orderService.closeOrder).toHaveBeenCalledWith("1");
  });

  test("DELETE /orders/:id is manager-only", async () => {
    const waiter = await loginAs("WAITER");
    const manager = await loginAs("MANAGER");

    const waiterRes = await waiter.delete("/orders/1");
    expect(waiterRes.status).toBe(403);
    expect(waiterRes.body.message).toBe("Access forbidden");

    const managerRes = await manager.delete("/orders/1");
    expect(managerRes.status).toBe(200);
    expect(managerRes.body.message).toBe("Order of id 1 deleted");
    expect(orderService.deleteOrder).toHaveBeenCalledWith("1");
  });

  test("GET /orders/:id maps ORDER_NOT_FOUND to 404", async () => {
    orderService.getOrderById.mockRejectedValueOnce(new Error("ORDER_NOT_FOUND"));
    const waiter = await loginAs("WAITER");

    const res = await waiter.get("/orders/999");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Order not found");
  });

  test("PATCH /orders/:id/close maps ORDER_NOT_FOUND_OR_ALREADY_CLOSED to 404", async () => {
    orderService.closeOrder.mockRejectedValueOnce(new Error("ORDER_NOT_FOUND_OR_ALREADY_CLOSED"));
    const waiter = await loginAs("WAITER");

    const res = await waiter.patch("/orders/999/close").send({});

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Order not found or already closed");
  });

  test("POST /orders/:id/items maps ORDER_CLOSED to 400", async () => {
    orderService.addItemToOrder.mockRejectedValueOnce(new Error("ORDER_CLOSED"));
    const waiter = await loginAs("WAITER");

    const res = await waiter.post("/orders/1/items").send({ menu_item_id: 2, quantity: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Order closed");
  });
});
