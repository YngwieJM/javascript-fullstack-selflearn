const fs = require("fs");
const path = require("path");
const express = require("express");
const request = require("supertest");
const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const authRoutes = require("../routes/auth.routes");

jest.mock("../config/db", () => ({
  query: jest.fn()
}));

jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  compare: jest.fn()
}));

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn()
}));

const openapi = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "docs", "openapi.auth.json"), "utf8")
);

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRoutes);
  return app;
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

  if (schema.type === "number" || schema.type === "integer") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${currentPath} should be >= ${schema.minimum}`);
    }
  }

  if (schema.type === "array" && schema.items) {
    value.forEach((item, idx) => {
      errors.push(...validateSchema(schema.items, item, `${currentPath}[${idx}]`));
    });
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

describe("Auth contract tests", () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("POST /auth/register valid request returns 201 and matches response contract", async () => {
    bcrypt.hash.mockResolvedValue("hashed-password");
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, name: "Alice", email: "alice@example.com", role: "WAITER" }]
    });

    const res = await request(app).post("/auth/register").send({
      name: "Alice",
      email: "alice@example.com",
      password: "secret123",
      role: "WAITER"
    });

    expect(res.status).toBe(201);
    expectContract("/auth/register", "post", res.status, res.body);
  });

  test.each([
    [{ email: "alice@example.com", password: "secret123", role: "WAITER" }],
    [{ name: "Alice", password: "secret123", role: "WAITER" }],
    [{ name: "Alice", email: "alice@example.com", role: "WAITER" }],
    [{ name: "Alice", email: "alice@example.com", password: "secret123" }]
  ])("POST /auth/register rejects missing required fields: %j", async (payload) => {
    const res = await request(app).post("/auth/register").send(payload);

    expect(res.status).toBe(400);
    expectContract("/auth/register", "post", res.status, res.body);
    expect(res.body.message).toBe("Validation error");
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test.each([
    [{ name: null, email: "alice@example.com", password: "secret123", role: "WAITER" }],
    [{ name: "Alice", email: null, password: "secret123", role: "WAITER" }],
    [{ name: "Alice", email: "alice@example.com", password: null, role: "WAITER" }],
    [{ name: "Alice", email: "alice@example.com", password: "secret123", role: null }],
    [{ name: undefined, email: "alice@example.com", password: "secret123", role: "WAITER" }],
    [{ name: "Alice", email: undefined, password: "secret123", role: "WAITER" }],
    [{ name: "Alice", email: "alice@example.com", password: undefined, role: "WAITER" }],
    [{ name: "Alice", email: "alice@example.com", password: "secret123", role: undefined }]
  ])("POST /auth/register rejects null/undefined fields: %j", async (payload) => {
    const res = await request(app).post("/auth/register").send(payload);

    expect(res.status).toBe(400);
    expectContract("/auth/register", "post", res.status, res.body);
    expect(res.body.message).toBe("Validation error");
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test.each([
    [{ name: 123, email: "alice@example.com", password: "secret123", role: "WAITER" }],
    [{ name: "Alice", email: 123, password: "secret123", role: "WAITER" }],
    [{ name: "Alice", email: "alice@example.com", password: 123456, role: "WAITER" }],
    [{ name: "Alice", email: "alice@example.com", password: "secret123", role: 1 }]
  ])("POST /auth/register rejects wrong field types: %j", async (payload) => {
    const res = await request(app).post("/auth/register").send(payload);

    expect(res.status).toBe(400);
    expectContract("/auth/register", "post", res.status, res.body);
    expect(res.body.message).toBe("Validation error");
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test.each([
    [{ name: "", email: "alice@example.com", password: "secret123", role: "WAITER" }],
    [{ name: "Alice", email: "", password: "secret123", role: "WAITER" }],
    [{ name: "Alice", email: "alice@example.com", password: "", role: "WAITER" }],
    [{ name: "Alice", email: "alice@example.com", password: "secret123", role: "" }]
  ])("POST /auth/register rejects empty strings: %j", async (payload) => {
    const res = await request(app).post("/auth/register").send(payload);

    expect(res.status).toBe(400);
    expectContract("/auth/register", "post", res.status, res.body);
    expect(res.body.message).toBe("Validation error");
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test.each([
    [{ name: "   ", email: "alice@example.com", password: "secret123", role: "WAITER" }],
    [{ name: "Alice", email: "alice@example.com", password: "      ", role: "WAITER" }]
  ])("POST /auth/register rejects whitespace-only strings: %j", async (payload) => {
    const res = await request(app).post("/auth/register").send(payload);

    expect(res.status).toBe(400);
    expectContract("/auth/register", "post", res.status, res.body);
    expect(res.body.message).toBe("Validation error");
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("POST /auth/register rejects invalid role enum", async () => {
    const res = await request(app).post("/auth/register").send({
      name: "Manager User",
      email: "manager@example.com",
      password: "secret123",
      role: "MANAGER"
    });

    expect(res.status).toBe(400);
    expectContract("/auth/register", "post", res.status, res.body);
    expect(res.body.message).toBe("Validation error");
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("POST /auth/register duplicate user returns 400 with error contract", async () => {
    bcrypt.hash.mockResolvedValue("hashed-password");
    const err = new Error("duplicate");
    err.code = "23505";
    pool.query.mockRejectedValueOnce(err);

    const res = await request(app).post("/auth/register").send({
      name: "Alice",
      email: "alice@example.com",
      password: "secret123",
      role: "WAITER"
    });

    expect(res.status).toBe(400);
    expectContract("/auth/register", "post", res.status, res.body);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: expect.any(String)
      })
    );
  });

  test("POST /auth/login valid request returns 200 and matches response contract", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 7, email: "alice@example.com", password: "stored-hash", role: "WAITER" }]
    });
    bcrypt.compare.mockResolvedValueOnce(true);
    jwt.sign.mockReturnValueOnce("signed-token");

    const res = await request(app).post("/auth/login").send({
      email: "alice@example.com",
      password: "secret123"
    });

    expect(res.status).toBe(200);
    expectContract("/auth/login", "post", res.status, res.body);
  });

  test.each([
    [{}],
    [{ email: "alice@example.com" }],
    [{ password: "secret123" }]
  ])("POST /auth/login rejects missing fields: %j", async (payload) => {
    const res = await request(app).post("/auth/login").send(payload);

    expect(res.status).toBe(400);
    expectContract("/auth/login", "post", res.status, res.body);
    expect(res.body.message).toBe("Validation error");
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("POST /auth/login rejects unknown user with 401 error contract", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post("/auth/login").send({
      email: "unknown@example.com",
      password: "secret123"
    });

    expect(res.status).toBe(401);
    expectContract("/auth/login", "post", res.status, res.body);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: expect.any(String)
      })
    );
  });

  test("POST /auth/login rejects wrong password with 401 error contract", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 7, email: "alice@example.com", password: "stored-hash", role: "WAITER" }]
    });
    bcrypt.compare.mockResolvedValueOnce(false);

    const res = await request(app).post("/auth/login").send({
      email: "alice@example.com",
      password: "wrongpass"
    });

    expect(res.status).toBe(401);
    expectContract("/auth/login", "post", res.status, res.body);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: expect.any(String)
      })
    );
  });

  test.each([
    [{ email: "not-an-email", password: "secret123" }],
    [{ email: null, password: "secret123" }],
    [{ email: "alice@example.com", password: null }],
    [{ email: 123, password: "secret123" }],
    [{ email: "alice@example.com", password: 123456 }],
    [{ email: "", password: "secret123" }],
    [{ email: "alice@example.com", password: "" }],
    [{ email: "alice@example.com", password: "      " }]
  ])("POST /auth/login rejects malformed payload: %j", async (payload) => {
    const res = await request(app).post("/auth/login").send(payload);

    expect(res.status).toBe(400);
    expectContract("/auth/login", "post", res.status, res.body);
    expect(res.body.message).toBe("Validation error");
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
