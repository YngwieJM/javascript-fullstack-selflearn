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

  test("updatePassword throws STAFF_NOT_FOUND when id does not exist", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await expect(staffService.updatePassword(999, "old", "newpass123")).rejects.toThrow("STAFF_NOT_FOUND");
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  test("updatePassword throws INVALID_PASSWORD for wrong current password", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ password: "stored-hash" }] });
    bcrypt.compare.mockResolvedValueOnce(false);

    await expect(staffService.updatePassword(1, "wrong-old", "newpass123")).rejects.toThrow("INVALID_PASSWORD");
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
});
