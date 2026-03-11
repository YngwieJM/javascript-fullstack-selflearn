jest.mock("../config/db", () => ({
  query: jest.fn()
}));

jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  compare: jest.fn()
}));

const pool = require("../config/db");
const bcrypt = require("bcrypt");
const staffService = require("../services/staff.service");

describe("Staff service unit QA", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("createStaff throws INVALID_STAFF_DATA for incomplete payload", async () => {
    await expect(staffService.createStaff("Alice", "", "secret123", "WAITER")).rejects.toThrow("INVALID_STAFF_DATA");
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("createStaff hashes password and inserts staff row", async () => {
    const created = { id: 1, name: "Alice", email: "alice@mail.com", role: "WAITER" };
    bcrypt.hash.mockResolvedValueOnce("hashed-pw");
    pool.query.mockResolvedValueOnce({ rows: [created] });

    const result = await staffService.createStaff("Alice", "alice@mail.com", "secret123", "WAITER");

    expect(bcrypt.hash).toHaveBeenCalledWith("secret123", 10);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO staff"),
      ["Alice", "alice@mail.com", "hashed-pw", "WAITER"]
    );
    expect(result).toEqual(created);
  });

  test("getAllStaff applies LIMIT/OFFSET correctly for requested page", async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 4, name: "Dana", email: "dana@example.com", role: "WAITER", created_at: "2026-01-01" }]
      })
      .mockResolvedValueOnce({
        rows: [{ count: "33" }]
      });

    const result = await staffService.getAllStaff(3, 10);

    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("LIMIT $1 OFFSET $2"),
      [10, 20]
    );
    expect(pool.query).toHaveBeenNthCalledWith(2, "SELECT COUNT(*) FROM staff");
    expect(result).toEqual(
      expect.objectContaining({
        page: 3,
        limit: 10,
        total: 33,
        total_pages: 4
      })
    );
    expect(result.data).toHaveLength(1);
  });

  test("getAllStaff uses defaults when page and limit are omitted", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] });

    const result = await staffService.getAllStaff();

    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("LIMIT $1 OFFSET $2"),
      [10, 0]
    );
    expect(result).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      total_pages: 0,
      data: []
    });
  });

  test("updateStaff updates row and returns updated staff", async () => {
    const updatedRow = {
      id: 1,
      name: "Updated Name",
      email: "updated@example.com",
      role: "WAITER"
    };
    pool.query.mockResolvedValueOnce({ rows: [updatedRow] });

    const result = await staffService.updateStaff(1, "Updated Name", "updated@example.com", "WAITER");

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("name = COALESCE($1, name)"),
      ["Updated Name", "updated@example.com", "WAITER", 1]
    );
    expect(result).toEqual(updatedRow);
  });

  test("updateStaff throws STAFF_NOT_FOUND when no row is updated", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      staffService.updateStaff(999, "No Name", "missing@example.com", "WAITER")
    ).rejects.toThrow("STAFF_NOT_FOUND");
  });

  test("updatePassword throws STAFF_NOT_FOUND when id does not exist", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await expect(staffService.updatePassword(999, "old", "newpass123")).rejects.toThrow("STAFF_NOT_FOUND");
    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("updatePassword throws INVALID_PASSWORD for wrong current password", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ password: "stored-hash" }] });
    bcrypt.compare.mockResolvedValueOnce(false);

    await expect(staffService.updatePassword(1, "wrong-old", "newpass123")).rejects.toThrow("INVALID_PASSWORD");
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });

  test("updatePassword updates hash when current password is valid", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ password: "stored-hash" }] }) // select
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // update
    bcrypt.compare.mockResolvedValueOnce(true);
    bcrypt.hash.mockResolvedValueOnce("new-hash");

    const result = await staffService.updatePassword(1, "old-pass", "new-pass");

    expect(bcrypt.compare).toHaveBeenCalledWith("old-pass", "stored-hash");
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("UPDATE staff SET password"),
      ["new-hash", 1]
    );
    expect(result).toEqual({ message: "Password Updated" });
  });

  test("updatePassword skips current-password compare when skipCurrentCheck=true", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ password: "stored-hash" }] }) // select
      .mockResolvedValueOnce({ rows: [{ id: 2 }] }); // update
    bcrypt.hash.mockResolvedValueOnce("new-hash");

    const result = await staffService.updatePassword(2, undefined, "new-pass", {
      skipCurrentCheck: true
    });

    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("UPDATE staff SET password"),
      ["new-hash", 2]
    );
    expect(result).toEqual({ message: "Password Updated" });
  });
});
