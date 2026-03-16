const request = require("supertest");
const staffRoutes = require("../routes/staff.routes");
const staffService = require("../services/staff.service");
const { createRouteTestApp } = require("./helpers/createRouteTestApp");

jest.mock("../services/staff.service", () => ({
  createStaff: jest.fn(),
  getAllStaff: jest.fn(),
  getStaffById: jest.fn(),
  updateStaff: jest.fn(),
  updatePassword: jest.fn(),
  deleteStaff: jest.fn()
}));

describe("Staff routes (stateful session + role checks)", () => {
  const app = createRouteTestApp("/staff", staffRoutes);

  beforeEach(() => {
    staffService.getAllStaff.mockResolvedValue([{ id: 1, name: "Anna", role: "WAITER" }]);
    staffService.getStaffById.mockResolvedValue({ id: 2, name: "Jordan", role: "BARTENDER" });
    staffService.createStaff.mockResolvedValue({
      id: 3,
      name: "Rina",
      email: "rina@example.com",
      role: "WAITER"
    });
    staffService.updateStaff.mockResolvedValue({
      id: 2,
      name: "Jordan Updated",
      email: "jordan@example.com",
      role: "BARTENDER"
    });
    staffService.updatePassword.mockResolvedValue({ message: "Password Updated" });
    staffService.deleteStaff.mockResolvedValue({ id: 2, name: "Jordan Updated" });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  async function loginAs(role, id = 1) {
    const agent = request.agent(app);
    await agent.post("/__test/session").send({ id, role, email: `${role.toLowerCase()}@test.com` });
    return agent;
  }

  test("GET /staff returns 401 without session", async () => {
    const res = await request(app).get("/staff");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  test("GET /staff is manager-only", async () => {
    const waiter = await loginAs("WAITER");
    const manager = await loginAs("MANAGER");

    const waiterRes = await waiter.get("/staff");
    expect(waiterRes.status).toBe(403);
    expect(waiterRes.body.message).toBe("Access forbidden");

    const managerRes = await manager.get("/staff");
    expect(managerRes.status).toBe(200);
    expect(staffService.getAllStaff).toHaveBeenCalledTimes(1);
  });

  test("POST /staff creates staff for manager", async () => {
    const manager = await loginAs("MANAGER");

    const res = await manager.post("/staff").send({
      name: "Rina",
      email: "rina@example.com",
      password: "123456",
      role: "WAITER"
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("STAFF_CREATED");
    expect(staffService.createStaff).toHaveBeenCalledWith(
      "Rina",
      "rina@example.com",
      "123456",
      "WAITER"
    );
  });

  test("POST /staff validates payload", async () => {
    const manager = await loginAs("MANAGER");

    const res = await manager.post("/staff").send({
      name: "Rina",
      email: "bad-email",
      password: "123",
      role: "CHEF"
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(staffService.createStaff).not.toHaveBeenCalled();
  });

  test("GET /staff/:id currently accepts any id string and returns staff item", async () => {
    const manager = await loginAs("MANAGER");
    const invalidRes = await manager.get("/staff/not-a-number");
    expect(invalidRes.status).toBe(200);
    expect(staffService.getStaffById).toHaveBeenCalledWith("not-a-number");

    const okRes = await manager.get("/staff/2");
    expect(okRes.status).toBe(200);
    expect(staffService.getStaffById).toHaveBeenCalledWith("2");
  });

  test("PUT /staff/:id updates staff for manager", async () => {
    const manager = await loginAs("MANAGER");

    const res = await manager.put("/staff/2").send({
      name: "Jordan Updated",
      role: "BARTENDER"
    });

    expect(res.status).toBe(200);
    expect(staffService.updateStaff).toHaveBeenCalledWith(
      "2",
      "Jordan Updated",
      undefined,
      "BARTENDER"
    );
  });

  test("PATCH /staff/:id updates password for WAITER", async () => {
    const waiter = await loginAs("WAITER", 7);

    const res = await waiter.patch("/staff/7").send({
      currentPassword: "oldpass123",
      newPassword: "newpass123"
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Password updated successfully");
    expect(staffService.updatePassword).toHaveBeenCalledWith("7", "oldpass123", "newpass123");
  });

  test("PATCH /staff/:id validates payload", async () => {
    const waiter = await loginAs("WAITER", 7);

    const res = await waiter.patch("/staff/7").send({
      currentPassword: "old",
      newPassword: "123"
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(staffService.updatePassword).not.toHaveBeenCalled();
  });

  test("DELETE /staff/:id is manager-only and returns 204", async () => {
    const waiter = await loginAs("WAITER");
    const manager = await loginAs("MANAGER");

    const waiterRes = await waiter.delete("/staff/2");
    expect(waiterRes.status).toBe(403);
    expect(waiterRes.body.message).toBe("Access forbidden");

    const managerRes = await manager.delete("/staff/2");
    expect(managerRes.status).toBe(204);
    expect(staffService.deleteStaff).toHaveBeenCalledWith("2");
  });

  test("GET /staff/:id maps STAFF_NOT_FOUND to 404", async () => {
    staffService.getStaffById.mockRejectedValueOnce(new Error("STAFF_NOT_FOUND"));
    const manager = await loginAs("MANAGER");

    const res = await manager.get("/staff/999");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Staff member not found");
  });
});
