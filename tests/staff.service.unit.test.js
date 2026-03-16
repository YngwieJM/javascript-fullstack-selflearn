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

describe("staff service unit", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("createStaff throws INVALID_STAFF_DATA for incomplete payload", async () => {
    await expect(staffService.createStaff("Anna", "", "123456", "WAITER")).rejects.toThrow(
      "INVALID_STAFF_DATA"
    );
    expect(pool.query).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });

  test("createStaff hashes password and inserts staff row", async () => {
    bcrypt.hash.mockResolvedValueOnce("hashed-password");
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, name: "Anna", email: "anna@mail.com", role: "WAITER" }]
    });

    const result = await staffService.createStaff("Anna", "anna@mail.com", "123456", "WAITER");

    expect(bcrypt.hash).toHaveBeenCalledWith("123456", 10);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO staff"),
      ["Anna", "anna@mail.com", "hashed-password", "WAITER"]
    );
    expect(result).toEqual({ id: 1, name: "Anna", email: "anna@mail.com", role: "WAITER" });
  });

  test("getStaffById throws STAFF_NOT_FOUND when row is missing", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await expect(staffService.getStaffById(404)).rejects.toThrow("STAFF_NOT_FOUND");
  });

  test("updateStaff throws STAFF_NOT_FOUND when row is missing", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await expect(staffService.updateStaff(999, "Nope", "x@mail.com", "WAITER")).rejects.toThrow(
      "STAFF_NOT_FOUND"
    );
  });

  test("updatePassword throws STAFF_NOT_FOUND when id does not exist", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await expect(staffService.updatePassword(999, "old", "new")).rejects.toThrow("STAFF_NOT_FOUND");
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  test("updatePassword throws INVALID_PASSWORD when compare fails", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ password: "stored-hash" }] });
    bcrypt.compare.mockResolvedValueOnce(false);

    await expect(staffService.updatePassword(1, "wrong", "newpass")).rejects.toThrow(
      "INVALID_PASSWORD"
    );
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });

  test("updatePassword updates hash when compare passes", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ password: "stored-hash" }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] });
    bcrypt.compare.mockResolvedValueOnce(true);
    bcrypt.hash.mockResolvedValueOnce("new-hash");

    const result = await staffService.updatePassword(1, "oldpass", "newpass");

    expect(bcrypt.compare).toHaveBeenCalledWith("oldpass", "stored-hash");
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("UPDATE staff SET password"),
      ["new-hash", 1]
    );
    expect(result).toEqual({ message: "Password Updated" });
  });

  test("deleteStaff throws STAFF_NOT_FOUND when row is missing", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await expect(staffService.deleteStaff(999)).rejects.toThrow("STAFF_NOT_FOUND");
  });
});

