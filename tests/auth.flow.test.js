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

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRoutes);
  return app;
}

describe("Auth flow QA", () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("POST /auth/register creates WAITER account with valid payload", async () => {
    bcrypt.hash.mockResolvedValue("hashed-password");
    pool.query.mockResolvedValue({
      rows: [{ id: 1, name: "Alice", email: "alice@example.com", role: "WAITER" }]
    });

    const res = await request(app).post("/auth/register").send({
      name: "Alice",
      email: "alice@example.com",
      password: "secret123",
      role: "WAITER"
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("User registered successfully");
    expect(res.body.user).toEqual({
      id: 1,
      name: "Alice",
      email: "alice@example.com",
      role: "WAITER"
    });
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("RETURNING id, name, email, role"),
      ["Alice", "alice@example.com", "hashed-password", "WAITER"]
    );
  });

  test("POST /auth/register rejects disallowed role MANAGER", async () => {
    const res = await request(app).post("/auth/register").send({
      name: "Boss",
      email: "boss@example.com",
      password: "secret123",
      role: "MANAGER"
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("POST /auth/register handles duplicate email", async () => {
    bcrypt.hash.mockResolvedValue("hashed-password");
    const err = new Error("duplicate");
    err.code = "23505";
    pool.query.mockRejectedValue(err);

    const res = await request(app).post("/auth/register").send({
      name: "Alice",
      email: "alice@example.com",
      password: "secret123",
      role: "WAITER"
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Email already exists");
  });

  test("POST /auth/login returns token on valid credentials", async () => {
    pool.query.mockResolvedValue({
      rows: [{ id: 7, email: "alice@example.com", password: "hashed-password", role: "WAITER" }]
    });
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue("signed-token");

    const res = await request(app).post("/auth/login").send({
      email: "alice@example.com",
      password: "secret123"
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Login successful");
    expect(res.body.token).toBe("signed-token");
    expect(jwt.sign).toHaveBeenCalledTimes(1);
  });

  test("POST /auth/login returns 401 for unknown email", async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const res = await request(app).post("/auth/login").send({
      email: "nobody@example.com",
      password: "secret123"
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid credentials");
  });

  test("POST /auth/login returns 401 for wrong password", async () => {
    pool.query.mockResolvedValue({
      rows: [{ id: 7, email: "alice@example.com", password: "hashed-password", role: "WAITER" }]
    });
    bcrypt.compare.mockResolvedValue(false);

    const res = await request(app).post("/auth/login").send({
      email: "alice@example.com",
      password: "wrongpass"
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid credentials");
  });
});
