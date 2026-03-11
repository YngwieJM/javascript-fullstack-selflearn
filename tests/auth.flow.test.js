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
    expect(res.body.user.password).toBeUndefined();
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("RETURNING id, name, email, role"),
      ["Alice", "alice@example.com", "hashed-password", "WAITER"]
    );
  });

  test("POST /auth/register accepts boundary name lengths (2 and 100)", async () => {
    bcrypt.hash.mockResolvedValue("hashed-password");
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 1, name: "Al", email: "al@example.com", role: "WAITER" }]
      })
      .mockResolvedValueOnce({
        rows: [{ id: 2, name: "A".repeat(100), email: "max@example.com", role: "BARTENDER" }]
      });

    const minRes = await request(app).post("/auth/register").send({
      name: "Al",
      email: "al@example.com",
      password: "secret123",
      role: "WAITER"
    });

    const maxRes = await request(app).post("/auth/register").send({
      name: "A".repeat(100),
      email: "max@example.com",
      password: "secret123",
      role: "BARTENDER"
    });

    expect(minRes.status).toBe(201);
    expect(maxRes.status).toBe(201);
    expect(pool.query).toHaveBeenCalledTimes(2);
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

  test.each([
    [{ email: "alice@example.com", password: "secret123", role: "WAITER" }],
    [{ name: "Alice", password: "secret123", role: "WAITER" }],
    [{ name: "Alice", email: "alice@example.com", role: "WAITER" }],
    [{ name: "A", email: "alice@example.com", password: "secret123", role: "WAITER" }],
    [{ name: "Alice", email: "alice@example.com", password: "123", role: "WAITER" }],
    [{ name: "Alice", email: "invalid", password: "secret123", role: "WAITER" }],
    [{ name: "Alice", email: "alice@example.com", password: "secret123", role: "" }],
    [{ name: "A".repeat(101), email: "toolong@example.com", password: "secret123", role: "WAITER" }],
    [{ name: null, email: "alice@example.com", password: "secret123", role: "WAITER" }],
    [{ name: 12, email: "alice@example.com", password: "secret123", role: "WAITER" }],
    [{ name: undefined, email: "alice@example.com", password: "secret123", role: "WAITER" }],
    [{ name: "Alice", email: undefined, password: "secret123", role: "WAITER" }],
    [{ name: "Alice", email: "alice@example.com", password: undefined, role: "WAITER" }],
    [{ name: "Alice", email: "alice@example.com", password: "secret123", role: undefined }]
  ])("POST /auth/register rejects invalid payload %j", async (payload) => {
    const res = await request(app).post("/auth/register").send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("POST /auth/register rejects whitespace-only name", async () => {
    const res = await request(app).post("/auth/register").send({
      name: "   ",
      email: "space@example.com",
      password: "secret123",
      role: "WAITER"
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("POST /auth/register rejects whitespace-only password", async () => {
    const res = await request(app).post("/auth/register").send({
      name: "Alice",
      email: "alice@example.com",
      password: "      ",
      role: "WAITER"
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

  test("POST /auth/register returns duplicate response on retry with same email", async () => {
    bcrypt.hash.mockResolvedValue("hashed-password");
    const duplicateErr = new Error("duplicate");
    duplicateErr.code = "23505";

    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 1, name: "Alice", email: "alice@example.com", role: "WAITER" }]
      })
      .mockRejectedValueOnce(duplicateErr);

    const payload = {
      name: "Alice",
      email: "alice@example.com",
      password: "secret123",
      role: "WAITER"
    };

    const first = await request(app).post("/auth/register").send(payload);
    const second = await request(app).post("/auth/register").send(payload);

    expect(first.status).toBe(201);
    expect(second.status).toBe(400);
    expect(second.body.message).toBe("Email already exists");
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test("POST /auth/register returns 500 when password hashing fails", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    bcrypt.hash.mockRejectedValueOnce(new Error("hash-failed"));

    const res = await request(app).post("/auth/register").send({
      name: "Alice",
      email: "alice@example.com",
      password: "secret123",
      role: "WAITER"
    });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Internal server error");
    expect(pool.query).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
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

  test("POST /auth/login accepts boundary password length 6", async () => {
    pool.query.mockResolvedValue({
      rows: [{ id: 7, email: "alice@example.com", password: "hashed-password", role: "WAITER" }]
    });
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue("signed-token");

    const res = await request(app).post("/auth/login").send({
      email: "alice@example.com",
      password: "123456"
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Login successful");
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

  test.each([
    [{}],
    [{ email: "alice@example.com" }],
    [{ password: "secret123" }],
    [{ email: "bad-email", password: "secret123" }],
    [{ email: "alice@example.com", password: "123" }],
    [{ email: null, password: "secret123" }],
    [{ email: "alice@example.com", password: null }],
    [{ email: undefined, password: "secret123" }],
    [{ email: "alice@example.com", password: undefined }],
    [{ email: "", password: "secret123" }],
    [{ email: "alice@example.com", password: "" }]
  ])("POST /auth/login rejects invalid payload %j", async (payload) => {
    const res = await request(app).post("/auth/login").send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("POST /auth/login rejects whitespace-only password", async () => {
    const res = await request(app).post("/auth/login").send({
      email: "alice@example.com",
      password: "      "
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("POST /auth/login returns 500 when db query fails", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    pool.query.mockRejectedValueOnce(new Error("db-down"));

    const res = await request(app).post("/auth/login").send({
      email: "alice@example.com",
      password: "secret123"
    });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Internal server error");
    consoleSpy.mockRestore();
  });

  test("POST /auth/forgot-password returns generic 200 for unknown email", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post("/auth/forgot-password").send({
      email: "unknown@example.com"
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(
      "If the account exists, a password reset instruction has been generated"
    );
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith("SELECT id FROM staff WHERE email = $1", ["unknown@example.com"]);
    expect(
      pool.query.mock.calls.some(
        ([sql]) => typeof sql === "string" && sql.includes("INSERT INTO password_reset_tokens")
      )
    ).toBe(false);
    expect(
      pool.query.mock.calls.some(
        ([sql]) => typeof sql === "string" && sql.includes("DELETE FROM password_reset_tokens")
      )
    ).toBe(false);
  });

  test("POST /auth/forgot-password creates reset token for known email", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 7 }] }) // find user
      .mockResolvedValueOnce({ rows: [] }) // delete previous token
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // insert token

    const res = await request(app).post("/auth/forgot-password").send({
      email: "alice@example.com"
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(
      "If the account exists, a password reset instruction has been generated"
    );
    expect(res.body.resetToken).toEqual(expect.any(String));
    expect(pool.query).toHaveBeenCalledTimes(3);
  });

  test("POST /auth/forgot-password does not expose reset token in production mode", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 7 }] }) // find user
        .mockResolvedValueOnce({ rows: [] }) // delete previous token
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // insert token

      const res = await request(app).post("/auth/forgot-password").send({
        email: "alice@example.com"
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe(
        "If the account exists, a password reset instruction has been generated"
      );
      expect(res.body.resetToken).toBeUndefined();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  test("POST /auth/forgot-password rejects invalid email format", async () => {
    const res = await request(app).post("/auth/forgot-password").send({
      email: "invalid-email"
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(pool.query).not.toHaveBeenCalled();
  });

  test.each([
    [{}],
    [{ email: null }],
    [{ email: 123 }],
    [{ email: undefined }],
    [{ email: "" }]
  ])("POST /auth/forgot-password rejects invalid payload %j", async (payload) => {
    const res = await request(app).post("/auth/forgot-password").send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("POST /auth/forgot-password returns 500 on internal error", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    pool.query.mockRejectedValueOnce(new Error("db-down"));

    const res = await request(app).post("/auth/forgot-password").send({
      email: "alice@example.com"
    });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Internal server error");
    consoleSpy.mockRestore();
  });

  test("POST /auth/reset-password returns 400 for invalid/expired token", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post("/auth/reset-password").send({
      token: "not-valid",
      newPassword: "newpass123"
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid or expired reset token");
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(
      pool.query.mock.calls.some(
        ([sql]) => typeof sql === "string" && sql.includes("UPDATE staff SET password")
      )
    ).toBe(false);
    expect(
      pool.query.mock.calls.some(
        ([sql]) => typeof sql === "string" && sql.includes("UPDATE password_reset_tokens SET used_at")
      )
    ).toBe(false);
  });

  test("POST /auth/reset-password updates password with valid token", async () => {
    bcrypt.hash.mockResolvedValueOnce("new-hash");
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 99, staff_id: 7 }] }) // find token
      .mockResolvedValueOnce({ rows: [{ id: 7 }] }) // update password
      .mockResolvedValueOnce({ rows: [{ id: 99 }] }) // mark used
      .mockResolvedValueOnce({ rows: [] }); // invalidate other tokens

    const res = await request(app).post("/auth/reset-password").send({
      token: "valid-token",
      newPassword: "newpass123"
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Password reset successful");
    expect(bcrypt.hash).toHaveBeenCalledWith("newpass123", 10);
    expect(pool.query).toHaveBeenCalledTimes(4);
  });

  test("POST /auth/reset-password rejects replay using the same token", async () => {
    bcrypt.hash.mockResolvedValueOnce("new-hash");
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 99, staff_id: 7 }] }) // first attempt: find token
      .mockResolvedValueOnce({ rows: [{ id: 7 }] }) // update password
      .mockResolvedValueOnce({ rows: [{ id: 99 }] }) // mark used
      .mockResolvedValueOnce({ rows: [] }) // invalidate others
      .mockResolvedValueOnce({ rows: [] }); // second attempt: token lookup fails

    const payload = { token: "single-use-token", newPassword: "newpass123" };

    const first = await request(app).post("/auth/reset-password").send(payload);
    const second = await request(app).post("/auth/reset-password").send(payload);

    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
    expect(second.body.message).toBe("Invalid or expired reset token");
    expect(bcrypt.hash).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledTimes(5);
  });

  test("POST /auth/reset-password rejects short new password", async () => {
    const res = await request(app).post("/auth/reset-password").send({
      token: "valid-token",
      newPassword: "123"
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(pool.query).not.toHaveBeenCalled();
  });

  test.each([
    [{}],
    [{ token: "", newPassword: "newpass123" }],
    [{ token: "valid-token", newPassword: null }],
    [{ token: null, newPassword: "newpass123" }],
    [{ token: "valid-token", newPassword: 123456 }],
    [{ token: 123, newPassword: "newpass123" }],
    [{ token: undefined, newPassword: "newpass123" }],
    [{ token: "valid-token", newPassword: undefined }],
    [{ token: "valid-token", newPassword: "" }]
  ])("POST /auth/reset-password rejects invalid payload %j", async (payload) => {
    const res = await request(app).post("/auth/reset-password").send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("POST /auth/reset-password rejects whitespace-only token", async () => {
    const res = await request(app).post("/auth/reset-password").send({
      token: "   ",
      newPassword: "newpass123"
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("POST /auth/reset-password rejects whitespace-only new password", async () => {
    const res = await request(app).post("/auth/reset-password").send({
      token: "valid-token",
      newPassword: "      "
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("POST /auth/reset-password returns 500 on internal error", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    pool.query.mockRejectedValueOnce(new Error("db-down"));

    const res = await request(app).post("/auth/reset-password").send({
      token: "valid-token",
      newPassword: "newpass123"
    });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Internal server error");
    consoleSpy.mockRestore();
  });
});
