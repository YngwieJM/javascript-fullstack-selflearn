const request = require("supertest");
const bcrypt = require("bcrypt");
const authRoutes = require("../routes/auth.routes");
const pool = require("../config/db");
const { createRouteTestApp } = require("./helpers/createRouteTestApp");

jest.mock("../config/db", () => ({
  query: jest.fn()
}));

jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  compare: jest.fn()
}));

describe("Auth routes (stateful session)", () => {
  const app = createRouteTestApp("/auth", authRoutes);

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("POST /auth/login creates session and GET /auth/me returns current user", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 11,
          name: "Admin",
          email: "admin@test.com",
          role: "MANAGER",
          password: "hashed-password"
        }
      ]
    });
    bcrypt.compare.mockResolvedValueOnce(true);

    const agent = request.agent(app);

    const loginRes = await agent.post("/auth/login").send({
      email: "admin@test.com",
      password: "123456"
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.message).toBe("Login successful");
    expect(loginRes.body.user).toEqual({
      id: 11,
      name: "Admin",
      email: "admin@test.com",
      role: "MANAGER"
    });

    const meRes = await agent.get("/auth/me");
    expect(meRes.status).toBe(200);
    expect(meRes.body.user).toEqual({
      id: 11,
      name: "Admin",
      email: "admin@test.com",
      role: "MANAGER"
    });
  });

  test("POST /auth/login returns 401 for invalid credentials", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post("/auth/login").send({
      email: "unknown@test.com",
      password: "123456"
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid credentials");
  });

  test("POST /auth/logout destroys session", async () => {
    const agent = request.agent(app);
    await agent.post("/__test/session").send({
      id: 1,
      name: "Admin",
      email: "admin@test.com",
      role: "MANAGER"
    });

    const logoutRes = await agent.post("/auth/logout");
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.message).toBe("Logged Out");

    const meRes = await agent.get("/auth/me");
    expect(meRes.status).toBe(401);
    expect(meRes.body.message).toBe("Unauthorized");
  });

  test("POST /auth/register validates payload and creates user", async () => {
    bcrypt.hash.mockResolvedValueOnce("hashed-password");
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 5, name: "Rina", email: "rina@test.com", password: "hashed-password" }]
    });

    const res = await request(app).post("/auth/register").send({
      name: "Rina",
      email: "rina@test.com",
      password: "123456",
      role: "WAITER"
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("User registered successfully");
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});

