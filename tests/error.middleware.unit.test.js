const { errorHandler } = require("../middleware/error.middleware");

function runError(err) {
  const req = {};
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };

  const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  errorHandler(err, req, res, jest.fn());
  consoleSpy.mockRestore();

  return res;
}

describe("Error middleware mapping", () => {
  test.each([
    ["STAFF_ID_REQUIRED", 400, "Staff id is required for manager order creation"],
    ["INVALID_QUANTITY", 400, "Invalid quantity"],
    ["ORDER_FORBIDDEN", 403, "Order forbidden"],
    ["TABLE_IN_USE", 409, "Table is still used by existing orders"],
    ["MENU_ITEM_NOT_FOUND", 404, "Menu item not found"]
  ])("maps %s to status/message", (errMessage, expectedStatus, expectedMessage) => {
    const res = runError(new Error(errMessage));

    expect(res.status).toHaveBeenCalledWith(expectedStatus);
    expect(res.json).toHaveBeenCalledWith({ message: expectedMessage });
  });

  test("maps postgres unique violation (23505) to 409", () => {
    const err = new Error("db");
    err.code = "23505";
    const res = runError(err);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "Duplicate value violates unique constraint"
    });
  });

  test("maps unknown errors to 500", () => {
    const res = runError(new Error("UNKNOWN_ERROR"));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal Server Error" });
  });
});
