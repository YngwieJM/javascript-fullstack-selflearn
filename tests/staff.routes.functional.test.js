const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/env");
const { errorHandler } = require("../middleware/error.middleware");

jest.mock("../services/staff.service", () => ({
  createStaff: jest.fn(),
  getAllStaff: jest.fn(),
  getStaffById: jest.fn(),
  updateStaff: jest.fn(),
  updatePassword: jest.fn(),
  deleteStaff: jest.fn()
}));

const staffService = require("../services/staff.service");
const staffRoutes = require("../routes/staff.routes");

function makeToken(role, id = 1) {
  return jwt.sign({ id, role }, jwtSecret, { expiresIn: "1h" });
}

function makeExpiredToken(role, id = 1) {
  return jwt.sign({ id, role }, jwtSecret, { expiresIn: -1 });
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/staff", staffRoutes);
  app.use(errorHandler);
  return app;
}

describe("Staff routes functional QA", () => {
  let app;
  const managerToken = makeToken("MANAGER", 1);
  const waiterToken = makeToken("WAITER", 7);
  const bartenderToken = makeToken("BARTENDER", 9);

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    staffService.getAllStaff.mockResolvedValue([{ id: 1, name: "Alice", role: "WAITER" }]);
    staffService.getStaffById.mockResolvedValue({ id: 2, name: "Bob", role: "BARTENDER" });
    staffService.createStaff.mockResolvedValue({
      id: 3,
      name: "Charlie",
      email: "charlie@example.com",
      role: "WAITER"
    });
    staffService.updateStaff.mockResolvedValue({
      id: 2,
      name: "Bob Updated",
      email: "bob@example.com",
      role: "BARTENDER"
    });
    staffService.updatePassword.mockResolvedValue({ message: "Password Updated" });
    staffService.deleteStaff.mockResolvedValue({ id: 2, name: "Bob" });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("GET /staff allows MANAGER and returns staff list", async () => {
    const res = await request(app)
      .get("/staff")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toEqual(expect.objectContaining({ id: 1, role: "WAITER" }));
    expect(staffService.getAllStaff).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["WAITER", waiterToken],
    ["BARTENDER", bartenderToken]
  ])("GET /staff blocks %s", async (role, token) => {
    const res = await request(app)
      .get("/staff")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Access forbidden");
    expect(staffService.getAllStaff).not.toHaveBeenCalled();
  });

  test.each([
    ["missing token", undefined, "No token provided"],
    ["malformed token", `Token ${managerToken}`, "Malformed authorization header"],
    ["invalid token", "Bearer not.a.real.token", "Invalid or expired token"]
  ])("GET /staff returns 401 for %s", async (name, authHeader, expectedMessage) => {
    const req = request(app).get("/staff");
    if (authHeader) req.set("Authorization", authHeader);

    const res = await req;
    expect(res.status).toBe(401);
    expect(res.body.message).toBe(expectedMessage);
    expect(staffService.getAllStaff).not.toHaveBeenCalled();
  });

  test("GET /staff returns 401 for expired token", async () => {
    const expiredManagerToken = makeExpiredToken("MANAGER", 1);

    const res = await request(app)
      .get("/staff")
      .set("Authorization", `Bearer ${expiredManagerToken}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid or expired token");
    expect(staffService.getAllStaff).not.toHaveBeenCalled();
  });

  test("GET /staff/:id allows MANAGER and returns staff item", async () => {
    const res = await request(app)
      .get("/staff/2")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ id: 2, role: "BARTENDER" }));
    expect(staffService.getStaffById).toHaveBeenCalledWith("2");
  });

  test.each([
    ["WAITER", waiterToken],
    ["BARTENDER", bartenderToken]
  ])("GET /staff/:id blocks %s", async (role, token) => {
    const res = await request(app)
      .get("/staff/2")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Access forbidden");
    expect(staffService.getStaffById).not.toHaveBeenCalled();
  });

  test("GET /staff/:id validates malformed id", async () => {
    const res = await request(app)
      .get("/staff/not-a-number")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(staffService.getStaffById).not.toHaveBeenCalled();
  });

  test("GET /staff/:id maps STAFF_NOT_FOUND to 404", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    staffService.getStaffById.mockRejectedValueOnce(new Error("STAFF_NOT_FOUND"));

    const res = await request(app)
      .get("/staff/99")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Staff member not found");
    expect(staffService.getStaffById).toHaveBeenCalledWith("99");
    consoleSpy.mockRestore();
  });

  test("GET /staff/:id returns 401 with invalid token", async () => {
    const res = await request(app)
      .get("/staff/2")
      .set("Authorization", "Bearer not.a.real.token");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid or expired token");
    expect(staffService.getStaffById).not.toHaveBeenCalled();
  });

  test("POST /staff allows MANAGER with valid payload", async () => {
    const payload = {
      name: "Charlie",
      email: "charlie@example.com",
      password: "secret123",
      role: "WAITER"
    };

    const res = await request(app)
      .post("/staff")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("STAFF_CREATED");
    expect(res.body.staff).toEqual(expect.objectContaining({ id: 3, role: "WAITER" }));
    expect(res.body.staff.password).toBeUndefined();
    expect(staffService.createStaff).toHaveBeenCalledWith(
      "Charlie",
      "charlie@example.com",
      "secret123",
      "WAITER"
    );
  });

  test("POST /staff accepts boundary name lengths (2 and 100)", async () => {
    const minRes = await request(app)
      .post("/staff")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        name: "Al",
        email: "al@example.com",
        password: "secret123",
        role: "WAITER"
      });

    const maxRes = await request(app)
      .post("/staff")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        name: "A".repeat(100),
        email: "max@example.com",
        password: "secret123",
        role: "BARTENDER"
      });

    expect(minRes.status).toBe(201);
    expect(maxRes.status).toBe(201);
    expect(staffService.createStaff).toHaveBeenCalledTimes(2);
  });

  test.each([
    [{ email: "x@mail.com", password: "secret123", role: "WAITER" }],
    [{ name: "A", email: "x@mail.com", password: "secret123", role: "WAITER" }],
    [{ name: "A".repeat(101), email: "x@mail.com", password: "secret123", role: "WAITER" }],
    [{ name: "Alice", email: "bad-email", password: "secret123", role: "WAITER" }],
    [{ name: "Alice", email: "", password: "secret123", role: "WAITER" }],
    [{ name: "Alice", email: "x@mail.com", password: "", role: "WAITER" }],
    [{ name: "Alice", email: "x@mail.com", password: "123", role: "WAITER" }],
    [{ name: "Alice", email: "x@mail.com", password: "secret123", role: "CHEF" }],
    [{ name: null, email: "x@mail.com", password: "secret123", role: "WAITER" }],
    [{ name: 123, email: "x@mail.com", password: "secret123", role: "WAITER" }],
    [{ name: undefined, email: "x@mail.com", password: "secret123", role: "WAITER" }],
    [{ name: "Alice", email: undefined, password: "secret123", role: "WAITER" }],
    [{ name: "Alice", email: "x@mail.com", password: undefined, role: "WAITER" }],
    [{ name: "Alice", email: "x@mail.com", password: "secret123", role: undefined }]
  ])("POST /staff rejects invalid payload %j", async (payload) => {
    const res = await request(app)
      .post("/staff")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(staffService.createStaff).not.toHaveBeenCalled();
  });

  test("POST /staff rejects whitespace-only name", async () => {
    const res = await request(app)
      .post("/staff")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        name: "   ",
        email: "space@example.com",
        password: "secret123",
        role: "WAITER"
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(staffService.createStaff).not.toHaveBeenCalled();
  });

  test("POST /staff rejects whitespace-only password", async () => {
    const res = await request(app)
      .post("/staff")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        name: "Alice",
        email: "alice@example.com",
        password: "      ",
        role: "WAITER"
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(staffService.createStaff).not.toHaveBeenCalled();
  });

  test.each([
    ["WAITER", waiterToken],
    ["BARTENDER", bartenderToken]
  ])("POST /staff blocks %s", async (role, token) => {
    const res = await request(app)
      .post("/staff")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Charlie",
        email: "charlie@example.com",
        password: "secret123",
        role: "WAITER"
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Access forbidden");
    expect(staffService.createStaff).not.toHaveBeenCalled();
  });

  test.each([
    ["missing token", undefined, "No token provided"],
    ["malformed header", `Token ${managerToken}`, "Malformed authorization header"],
    ["invalid token", "Bearer not.a.real.token", "Invalid or expired token"]
  ])("POST /staff returns 401 for %s", async (name, authHeader, expectedMessage) => {
    const req = request(app).post("/staff").send({
      name: "Charlie",
      email: "charlie@example.com",
      password: "secret123",
      role: "WAITER"
    });

    if (authHeader) req.set("Authorization", authHeader);

    const res = await req;
    expect(res.status).toBe(401);
    expect(res.body.message).toBe(expectedMessage);
    expect(staffService.createStaff).not.toHaveBeenCalled();
  });

  test("POST /staff maps duplicate constraint error to 409", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const duplicateErr = new Error("duplicate");
    duplicateErr.code = "23505";
    staffService.createStaff.mockRejectedValueOnce(duplicateErr);

    const res = await request(app)
      .post("/staff")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        name: "Charlie",
        email: "charlie@example.com",
        password: "secret123",
        role: "WAITER"
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Duplicate value violates unique constraint");
    consoleSpy.mockRestore();
  });

  test("POST /staff maps INVALID_STAFF_DATA to 400", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    staffService.createStaff.mockRejectedValueOnce(new Error("INVALID_STAFF_DATA"));

    const res = await request(app)
      .post("/staff")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        name: "Charlie",
        email: "charlie@example.com",
        password: "secret123",
        role: "WAITER"
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid staff data");
    consoleSpy.mockRestore();
  });

  test("PUT /staff/:id allows MANAGER with valid payload", async () => {
    const res = await request(app)
      .put("/staff/2")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        name: "Bob Updated",
        email: "bob@example.com",
        role: "BARTENDER"
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        id: 2,
        name: "Bob Updated",
        role: "BARTENDER"
      })
    );
    expect(staffService.updateStaff).toHaveBeenCalledWith(
      "2",
      "Bob Updated",
      "bob@example.com",
      "BARTENDER"
    );
  });

  test("PUT /staff/:id supports retry with same payload", async () => {
    const payload = { name: "Bob Updated", email: "bob@example.com", role: "BARTENDER" };

    const first = await request(app)
      .put("/staff/2")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(payload);

    const second = await request(app)
      .put("/staff/2")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(payload);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(staffService.updateStaff).toHaveBeenCalledTimes(2);
  });

  test("PUT /staff/:id accepts boundary name lengths (2 and 100)", async () => {
    const minRes = await request(app)
      .put("/staff/2")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Al" });

    const maxRes = await request(app)
      .put("/staff/2")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "A".repeat(100) });

    expect(minRes.status).toBe(200);
    expect(maxRes.status).toBe(200);
    expect(staffService.updateStaff).toHaveBeenCalledTimes(2);
  });

  test.each([
    ["/staff/2", {}],
    ["/staff/2", { role: "CHEF" }],
    ["/staff/not-a-number", { name: "Alice" }],
    ["/staff/2", { name: 123 }],
    ["/staff/2", { name: "A".repeat(101) }],
    ["/staff/2", { email: "" }],
    ["/staff/2", { role: "" }]
  ])("PUT %s rejects invalid update payload %j", async (path, payload) => {
    const res = await request(app)
      .put(path)
      .set("Authorization", `Bearer ${managerToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(staffService.updateStaff).not.toHaveBeenCalled();
  });

  test("PUT /staff/:id rejects whitespace-only name", async () => {
    const res = await request(app)
      .put("/staff/2")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "   " });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(staffService.updateStaff).not.toHaveBeenCalled();
  });

  test.each([
    ["WAITER", waiterToken],
    ["BARTENDER", bartenderToken]
  ])("PUT /staff/:id blocks %s", async (role, token) => {
    const res = await request(app)
      .put("/staff/2")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Bob Updated" });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Access forbidden");
    expect(staffService.updateStaff).not.toHaveBeenCalled();
  });

  test.each([
    ["missing token", undefined, "No token provided"],
    ["malformed header", `Token ${managerToken}`, "Malformed authorization header"],
    ["invalid token", "Bearer not.a.real.token", "Invalid or expired token"]
  ])("PUT /staff/:id returns 401 for %s", async (name, authHeader, expectedMessage) => {
    const req = request(app).put("/staff/2").send({ name: "Bob Updated" });
    if (authHeader) req.set("Authorization", authHeader);

    const res = await req;
    expect(res.status).toBe(401);
    expect(res.body.message).toBe(expectedMessage);
    expect(staffService.updateStaff).not.toHaveBeenCalled();
  });

  test("PUT /staff/:id maps STAFF_NOT_FOUND to 404", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    staffService.updateStaff.mockRejectedValueOnce(new Error("STAFF_NOT_FOUND"));

    const res = await request(app)
      .put("/staff/999")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Unknown User" });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Staff member not found");
    consoleSpy.mockRestore();
  });

  test("PUT /staff/:id maps duplicate constraint to 409", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const duplicateErr = new Error("duplicate");
    duplicateErr.code = "23505";
    staffService.updateStaff.mockRejectedValueOnce(duplicateErr);

    const res = await request(app)
      .put("/staff/2")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ email: "existing@example.com" });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Duplicate value violates unique constraint");
    consoleSpy.mockRestore();
  });

  test("PATCH /staff/:id allows MANAGER to reset other staff password", async () => {
    const res = await request(app)
      .patch("/staff/2")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ newPassword: "newpass123" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Password updated successfully");
    expect(staffService.updatePassword).toHaveBeenCalledWith(
      2,
      undefined,
      "newpass123",
      { skipCurrentCheck: true }
    );
  });

  test("PATCH /staff/:id requires currentPassword for manager self-update", async () => {
    const res = await request(app)
      .patch("/staff/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ newPassword: "newpass123" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Current password is required");
    expect(staffService.updatePassword).not.toHaveBeenCalled();
  });

  test("PATCH /staff/:id allows WAITER self password update", async () => {
    const res = await request(app)
      .patch("/staff/7")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ currentPassword: "current123", newPassword: "newpass123" });

    expect(res.status).toBe(200);
    expect(staffService.updatePassword).toHaveBeenCalledWith(
      7,
      "current123",
      "newpass123",
      { skipCurrentCheck: false }
    );
  });

  test("PATCH /staff/:id allows MANAGER self password update with current password", async () => {
    const res = await request(app)
      .patch("/staff/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ currentPassword: "current123", newPassword: "newpass123" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Password updated successfully");
    expect(staffService.updatePassword).toHaveBeenCalledWith(
      1,
      "current123",
      "newpass123",
      { skipCurrentCheck: false }
    );
  });

  test("PATCH /staff/:id requires currentPassword for self update", async () => {
    const res = await request(app)
      .patch("/staff/7")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ newPassword: "newpass123" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Current password is required");
    expect(staffService.updatePassword).not.toHaveBeenCalled();
  });

  test("PATCH /staff/:id blocks cross-account update for non-manager", async () => {
    const res = await request(app)
      .patch("/staff/8")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ currentPassword: "current123", newPassword: "newpass123" });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Access forbidden");
    expect(staffService.updatePassword).not.toHaveBeenCalled();
  });

  test("PATCH /staff/:id blocks waiter id-tampering attempt to reset manager password", async () => {
    const res = await request(app)
      .patch("/staff/1")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ currentPassword: "current123", newPassword: "newpass123" });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Access forbidden");
    expect(staffService.updatePassword).not.toHaveBeenCalled();
  });

  test("PATCH /staff/:id blocks cross-account update for BARTENDER", async () => {
    const res = await request(app)
      .patch("/staff/7")
      .set("Authorization", `Bearer ${bartenderToken}`)
      .send({ currentPassword: "current123", newPassword: "newpass123" });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Access forbidden");
    expect(staffService.updatePassword).not.toHaveBeenCalled();
  });

  test.each([
    ["/staff/not-a-number", { currentPassword: "old", newPassword: "newpass123" }],
    ["/staff/7", { currentPassword: "old", newPassword: "123" }],
    ["/staff/7", { currentPassword: "old" }],
    ["/staff/7", { currentPassword: null, newPassword: "newpass123" }],
    ["/staff/7", { currentPassword: "old", newPassword: null }],
    ["/staff/7", { currentPassword: "old", newPassword: 123456 }]
  ])("PATCH %s rejects invalid payload %j", async (path, payload) => {
    const res = await request(app)
      .patch(path)
      .set("Authorization", `Bearer ${managerToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(staffService.updatePassword).not.toHaveBeenCalled();
  });

  test("PATCH /staff/:id rejects whitespace-only newPassword", async () => {
    const res = await request(app)
      .patch("/staff/2")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ newPassword: "      " });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(staffService.updatePassword).not.toHaveBeenCalled();
  });

  test("PATCH /staff/:id maps INVALID_PASSWORD to 400", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    staffService.updatePassword.mockRejectedValueOnce(new Error("INVALID_PASSWORD"));

    const res = await request(app)
      .patch("/staff/7")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ currentPassword: "badpass", newPassword: "newpass123" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Password is incorrect");
    consoleSpy.mockRestore();
  });

  test("PATCH /staff/:id maps STAFF_NOT_FOUND to 404", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    staffService.updatePassword.mockRejectedValueOnce(new Error("STAFF_NOT_FOUND"));

    const res = await request(app)
      .patch("/staff/7")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ currentPassword: "current123", newPassword: "newpass123" });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Staff member not found");
    consoleSpy.mockRestore();
  });

  test.each([
    ["missing token", undefined, "No token provided"],
    ["malformed auth header", `Token ${managerToken}`, "Malformed authorization header"],
    ["invalid token", "Bearer not.a.real.token", "Invalid or expired token"]
  ])("PATCH /staff/:id returns 401 for %s", async (name, authHeader, expectedMessage) => {
    const req = request(app).patch("/staff/7").send({
      currentPassword: "current123",
      newPassword: "newpass123"
    });

    if (authHeader) req.set("Authorization", authHeader);

    const res = await req;
    expect(res.status).toBe(401);
    expect(res.body.message).toBe(expectedMessage);
    expect(staffService.updatePassword).not.toHaveBeenCalled();
  });

  test("PATCH /staff/:id returns 401 for malformed header with extra token segments", async () => {
    const res = await request(app)
      .patch("/staff/7")
      .set("Authorization", `Bearer ${managerToken} extra`)
      .send({ currentPassword: "current123", newPassword: "newpass123" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Malformed authorization header");
    expect(staffService.updatePassword).not.toHaveBeenCalled();
  });

  test("PATCH /staff/:id returns 401 for expired token", async () => {
    const expiredWaiterToken = makeExpiredToken("WAITER", 7);

    const res = await request(app)
      .patch("/staff/7")
      .set("Authorization", `Bearer ${expiredWaiterToken}`)
      .send({ currentPassword: "current123", newPassword: "newpass123" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid or expired token");
    expect(staffService.updatePassword).not.toHaveBeenCalled();
  });

  test("DELETE /staff/:id allows MANAGER", async () => {
    const res = await request(app)
      .delete("/staff/2")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(204);
    expect(staffService.deleteStaff).toHaveBeenCalledWith("2");
  });

  test("DELETE /staff/:id blocks non-manager role", async () => {
    const res = await request(app)
      .delete("/staff/2")
      .set("Authorization", `Bearer ${waiterToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Access forbidden");
    expect(staffService.deleteStaff).not.toHaveBeenCalled();
  });

  test.each([
    ["missing token", undefined, "No token provided"],
    ["malformed header", `Token ${managerToken}`, "Malformed authorization header"],
    ["invalid token", "Bearer not.a.real.token", "Invalid or expired token"]
  ])("DELETE /staff/:id returns 401 for %s", async (name, authHeader, expectedMessage) => {
    const req = request(app).delete("/staff/2");
    if (authHeader) req.set("Authorization", authHeader);

    const res = await req;
    expect(res.status).toBe(401);
    expect(res.body.message).toBe(expectedMessage);
    expect(staffService.deleteStaff).not.toHaveBeenCalled();
  });

  test("DELETE /staff/:id validates malformed id", async () => {
    const res = await request(app)
      .delete("/staff/not-a-number")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(staffService.deleteStaff).not.toHaveBeenCalled();
  });

  test("DELETE /staff/:id maps STAFF_NOT_FOUND to 404", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    staffService.deleteStaff.mockRejectedValueOnce(new Error("STAFF_NOT_FOUND"));

    const res = await request(app)
      .delete("/staff/999")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Staff member not found");
    consoleSpy.mockRestore();
  });

  test("DELETE /staff/:id maps referenced resource error to 409", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const refErr = new Error("foreign key");
    refErr.code = "23503";
    staffService.deleteStaff.mockRejectedValueOnce(refErr);

    const res = await request(app)
      .delete("/staff/2")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Resource is still referenced by related data");
    consoleSpy.mockRestore();
  });

  test("DELETE /staff/:id returns 404 on repeated delete retry", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    staffService.deleteStaff
      .mockResolvedValueOnce({ id: 2, name: "Bob" })
      .mockRejectedValueOnce(new Error("STAFF_NOT_FOUND"));

    const first = await request(app)
      .delete("/staff/2")
      .set("Authorization", `Bearer ${managerToken}`);

    const second = await request(app)
      .delete("/staff/2")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(first.status).toBe(204);
    expect(second.status).toBe(404);
    expect(second.body.message).toBe("Staff member not found");
    expect(staffService.deleteStaff).toHaveBeenCalledTimes(2);
    consoleSpy.mockRestore();
  });
});
