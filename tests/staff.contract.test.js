const fs = require("fs");
const path = require("path");
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

const openapi = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "docs", "openapi.staff.json"), "utf8")
);

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/staff", staffRoutes);
  app.use(errorHandler);
  return app;
}

function makeToken(role, id = 1) {
  return jwt.sign({ id, role }, jwtSecret, { expiresIn: "1h" });
}

function resolveRef(ref) {
  const parts = ref.replace(/^#\//, "").split("/");
  return parts.reduce((acc, part) => (acc ? acc[part] : undefined), openapi);
}

function getOperation(routePath, method) {
  return openapi.paths[routePath][method];
}

function getResponseSchema(routePath, method, statusCode) {
  const operation = getOperation(routePath, method);
  let response = operation.responses[String(statusCode)];
  if (!response) return null;
  if (response.$ref) response = resolveRef(response.$ref);

  const schema = response.content?.["application/json"]?.schema;
  return schema || null;
}

function matchesType(expectedType, value) {
  if (expectedType === "integer") return Number.isInteger(value);
  if (expectedType === "number") return typeof value === "number" && !Number.isNaN(value);
  if (expectedType === "string") return typeof value === "string";
  if (expectedType === "boolean") return typeof value === "boolean";
  if (expectedType === "array") return Array.isArray(value);
  if (expectedType === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  return true;
}

function validateSchema(schema, value, currentPath = "body") {
  if (!schema) return [];
  if (schema.$ref) return validateSchema(resolveRef(schema.$ref), value, currentPath);

  if (schema.oneOf) {
    const candidateErrors = schema.oneOf.map((s) => validateSchema(s, value, currentPath));
    const passed = candidateErrors.some((errors) => errors.length === 0);
    return passed ? [] : [`${currentPath} does not match any oneOf schema`];
  }

  const errors = [];

  if (schema.type && !matchesType(schema.type, value)) {
    errors.push(`${currentPath} should be ${schema.type}`);
    return errors;
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${currentPath} should be one of: ${schema.enum.join(", ")}`);
  }

  if (schema.type === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${currentPath} should have minLength ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${currentPath} should have maxLength ${schema.maxLength}`);
    }
    if (schema.format === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors.push(`${currentPath} should match email format`);
    }
  }

  if (schema.type === "object") {
    if (schema.required) {
      schema.required.forEach((field) => {
        if (!Object.prototype.hasOwnProperty.call(value, field)) {
          errors.push(`${currentPath}.${field} is required`);
        }
      });
    }

    if (schema.properties) {
      Object.keys(schema.properties).forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(value, field) && value[field] !== undefined) {
          errors.push(
            ...validateSchema(schema.properties[field], value[field], `${currentPath}.${field}`)
          );
        }
      });
    }
  }

  if (schema.type === "array" && schema.items) {
    value.forEach((item, idx) => {
      errors.push(...validateSchema(schema.items, item, `${currentPath}[${idx}]`));
    });
  }

  return errors;
}

function expectContract(routePath, method, statusCode, body) {
  const operation = getOperation(routePath, method);
  expect(operation).toBeDefined();
  expect(operation.responses[String(statusCode)]).toBeDefined();

  const schema = getResponseSchema(routePath, method, statusCode);
  if (!schema) return;

  const errors = validateSchema(schema, body);
  expect(errors).toEqual([]);
}

describe("Staff contract tests", () => {
  let app;
  let passwordState;
  const managerToken = makeToken("MANAGER", 1);
  const waiterToken = makeToken("WAITER", 7);
  const bartenderToken = makeToken("BARTENDER", 9);

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    passwordState = {
      1: "hash-manager-old",
      2: "hash-staff-old",
      7: "hash-waiter-old"
    };

    staffService.getAllStaff.mockResolvedValue([
      { id: 1, name: "Manager", email: "manager@example.com", role: "MANAGER", created_at: "now" }
    ]);

    staffService.getStaffById.mockResolvedValue({
      id: 2,
      name: "Bob",
      role: "BARTENDER"
    });

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

    staffService.updatePassword.mockImplementation(async (id, currentPassword, newPassword, options = {}) => {
      const { skipCurrentCheck = false } = options;
      if (!passwordState[id]) throw new Error("STAFF_NOT_FOUND");
      if (!skipCurrentCheck && currentPassword !== "correct-current") {
        throw new Error("INVALID_PASSWORD");
      }
      passwordState[id] = `hash:${newPassword}`;
      return { message: "Password Updated" };
    });

    staffService.deleteStaff.mockResolvedValue({
      id: 2,
      name: "Bob"
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("GET /staff valid manager list returns 200 contract", async () => {
    const res = await request(app).get("/staff").set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expectContract("/staff", "get", res.status, res.body);
  });

  test("GET /staff/:id valid manager get returns 200 contract", async () => {
    const res = await request(app).get("/staff/2").set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expectContract("/staff/{id}", "get", res.status, res.body);
  });

  test("POST /staff valid create returns 201 contract", async () => {
    const res = await request(app)
      .post("/staff")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        name: "Charlie",
        email: "charlie@example.com",
        password: "secret123",
        role: "WAITER"
      });

    expect(res.status).toBe(201);
    expectContract("/staff", "post", res.status, res.body);
  });

  test("PUT /staff/:id valid update returns 200 contract", async () => {
    const res = await request(app)
      .put("/staff/2")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Bob Updated" });

    expect(res.status).toBe(200);
    expectContract("/staff/{id}", "put", res.status, res.body);
  });

  test("PATCH /staff/:id valid self password update returns 200 contract", async () => {
    const res = await request(app)
      .patch("/staff/7")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ currentPassword: "correct-current", newPassword: "newpass123" });

    expect(res.status).toBe(200);
    expectContract("/staff/{id}", "patch", res.status, res.body);
    expect(staffService.updatePassword).toHaveBeenCalledWith(
      7,
      "correct-current",
      "newpass123",
      { skipCurrentCheck: false }
    );
  });

  test("PATCH /staff/:id valid manager reset another user returns 200 contract", async () => {
    const res = await request(app)
      .patch("/staff/2")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ newPassword: "newpass123" });

    expect(res.status).toBe(200);
    expectContract("/staff/{id}", "patch", res.status, res.body);
    expect(staffService.updatePassword).toHaveBeenCalledWith(
      2,
      undefined,
      "newpass123",
      { skipCurrentCheck: true }
    );
  });

  test("GET /staff missing token returns 401 and no service call", async () => {
    const res = await request(app).get("/staff");

    expect(res.status).toBe(401);
    expectContract("/staff", "get", res.status, res.body);
    expect(staffService.getAllStaff).not.toHaveBeenCalled();
  });

  test("POST /staff malformed token returns 401 and no mutation", async () => {
    const res = await request(app)
      .post("/staff")
      .set("Authorization", `Token ${managerToken}`)
      .send({ name: "X", email: "x@example.com", password: "secret123", role: "WAITER" });

    expect(res.status).toBe(401);
    expectContract("/staff", "post", res.status, res.body);
    expect(staffService.createStaff).not.toHaveBeenCalled();
  });

  test("POST /staff wrong role blocked with 403 and no mutation", async () => {
    const res = await request(app)
      .post("/staff")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ name: "X", email: "x@example.com", password: "secret123", role: "WAITER" });

    expect(res.status).toBe(403);
    expectContract("/staff", "post", res.status, res.body);
    expect(staffService.createStaff).not.toHaveBeenCalled();
  });

  test("PUT /staff/:id non-manager manager-only action blocked with 403", async () => {
    const res = await request(app)
      .put("/staff/2")
      .set("Authorization", `Bearer ${bartenderToken}`)
      .send({ name: "Nope" });

    expect(res.status).toBe(403);
    expectContract("/staff/{id}", "put", res.status, res.body);
    expect(staffService.updateStaff).not.toHaveBeenCalled();
  });

  test("DELETE /staff/:id non-manager blocked with 403 and no mutation", async () => {
    const res = await request(app)
      .delete("/staff/2")
      .set("Authorization", `Bearer ${waiterToken}`);

    expect(res.status).toBe(403);
    expectContract("/staff/{id}", "delete", res.status, res.body);
    expect(staffService.deleteStaff).not.toHaveBeenCalled();
  });

  test("PATCH /staff/:id non-manager cross-user update blocked with 403", async () => {
    const res = await request(app)
      .patch("/staff/8")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ currentPassword: "correct-current", newPassword: "newpass123" });

    expect(res.status).toBe(403);
    expectContract("/staff/{id}", "patch", res.status, res.body);
    expect(staffService.updatePassword).not.toHaveBeenCalled();
  });

  test("PATCH /staff/:id non-manager reset another user must fail", async () => {
    const res = await request(app)
      .patch("/staff/1")
      .set("Authorization", `Bearer ${bartenderToken}`)
      .send({ currentPassword: "correct-current", newPassword: "newpass123" });

    expect(res.status).toBe(403);
    expectContract("/staff/{id}", "patch", res.status, res.body);
    expect(staffService.updatePassword).not.toHaveBeenCalled();
  });

  test("PATCH /staff/:id manager self update missing currentPassword fails with 400", async () => {
    const res = await request(app)
      .patch("/staff/1")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ newPassword: "newpass123" });

    expect(res.status).toBe(400);
    expectContract("/staff/{id}", "patch", res.status, res.body);
    expect(staffService.updatePassword).not.toHaveBeenCalled();
  });

  test("PATCH /staff/:id self update missing currentPassword fails with 400", async () => {
    const res = await request(app)
      .patch("/staff/7")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ newPassword: "newpass123" });

    expect(res.status).toBe(400);
    expectContract("/staff/{id}", "patch", res.status, res.body);
    expect(staffService.updatePassword).not.toHaveBeenCalled();
  });

  test("PATCH /staff/:id wrong current password fails and does not mutate password state", async () => {
    const before = passwordState[7];

    const res = await request(app)
      .patch("/staff/7")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ currentPassword: "bad-current", newPassword: "newpass123" });

    expect(res.status).toBe(400);
    expectContract("/staff/{id}", "patch", res.status, res.body);
    expect(passwordState[7]).toBe(before);
  });

  test.each([
    [{ email: "x@mail.com", password: "secret123", role: "WAITER" }],
    [{ name: null, email: "x@mail.com", password: "secret123", role: "WAITER" }],
    [{ name: "Alice", email: undefined, password: "secret123", role: "WAITER" }],
    [{ name: "Alice", email: "x@mail.com", password: "secret123", role: 7 }],
    [{ name: "Alice", email: "", password: "secret123", role: "WAITER" }],
    [{ name: "   ", email: "x@mail.com", password: "secret123", role: "WAITER" }],
    [{ name: "Alice", email: "x@mail.com", password: "secret123", role: "CHEF" }]
  ])("POST /staff invalid request contract %j", async (payload) => {
    const res = await request(app)
      .post("/staff")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expectContract("/staff", "post", res.status, res.body);
    expect(staffService.createStaff).not.toHaveBeenCalled();
  });

  test("POST /staff duplicate conflict returns 409 error contract", async () => {
    const duplicateErr = new Error("duplicate");
    duplicateErr.code = "23505";
    staffService.createStaff.mockRejectedValueOnce(duplicateErr);

    const res = await request(app)
      .post("/staff")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Charlie", email: "charlie@example.com", password: "secret123", role: "WAITER" });

    expect(res.status).toBe(409);
    expectContract("/staff", "post", res.status, res.body);
  });

  test.each([
    ["/staff/abc", "get"],
    ["/staff/abc", "put"],
    ["/staff/abc", "patch"],
    ["/staff/abc", "delete"]
  ])("Malformed id %s on %s returns 400 and no mutation", async (targetPath, method) => {
    const req = request(app)[method](targetPath).set("Authorization", `Bearer ${managerToken}`);
    if (method === "put") req.send({ name: "Any" });
    if (method === "patch") req.send({ newPassword: "newpass123" });

    const res = await req;
    expect(res.status).toBe(400);
    expectContract("/staff/{id}", method, res.status, res.body);

    expect(staffService.getStaffById).not.toHaveBeenCalled();
    expect(staffService.updateStaff).not.toHaveBeenCalled();
    expect(staffService.updatePassword).not.toHaveBeenCalled();
    expect(staffService.deleteStaff).not.toHaveBeenCalled();
  });

  test("GET /staff/:id not found returns 404 error contract", async () => {
    staffService.getStaffById.mockRejectedValueOnce(new Error("STAFF_NOT_FOUND"));

    const res = await request(app).get("/staff/999").set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
    expectContract("/staff/{id}", "get", res.status, res.body);
  });

  test("PUT /staff/:id not found returns 404 error contract", async () => {
    staffService.updateStaff.mockRejectedValueOnce(new Error("STAFF_NOT_FOUND"));

    const res = await request(app)
      .put("/staff/999")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Not Found" });

    expect(res.status).toBe(404);
    expectContract("/staff/{id}", "put", res.status, res.body);
  });

  test("PUT /staff/:id duplicate conflict returns 409 error contract", async () => {
    const duplicateErr = new Error("duplicate");
    duplicateErr.code = "23505";
    staffService.updateStaff.mockRejectedValueOnce(duplicateErr);

    const res = await request(app)
      .put("/staff/2")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ email: "duplicate@example.com" });

    expect(res.status).toBe(409);
    expectContract("/staff/{id}", "put", res.status, res.body);
  });

  test("DELETE /staff/:id not found returns 404 error contract", async () => {
    staffService.deleteStaff.mockRejectedValueOnce(new Error("STAFF_NOT_FOUND"));

    const res = await request(app)
      .delete("/staff/999")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
    expectContract("/staff/{id}", "delete", res.status, res.body);
  });

  test("DELETE /staff/:id conflict returns 409 error contract", async () => {
    const refErr = new Error("foreign key");
    refErr.code = "23503";
    staffService.deleteStaff.mockRejectedValueOnce(refErr);

    const res = await request(app)
      .delete("/staff/2")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(409);
    expectContract("/staff/{id}", "delete", res.status, res.body);
  });

  test("PUT /staff/:id invalid body must not mutate", async () => {
    const res = await request(app)
      .put("/staff/2")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({});

    expect(res.status).toBe(400);
    expectContract("/staff/{id}", "put", res.status, res.body);
    expect(staffService.updateStaff).not.toHaveBeenCalled();
  });
});
