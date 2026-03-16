const { errorHandler } = require("../middleware/error.middleware");

function runError(err) {
  const req = {};
  const res = {
    headersSent: false,
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
  const next = jest.fn();
  const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

  errorHandler(err, req, res, next);
  consoleSpy.mockRestore();

  return { res, next };
}

describe("error middleware mapping", () => {
  test.each([
    ["TABLE_NOT_FOUND", 404, "Table not found"],
    ["STAFF_NOT_FOUND", 404, "Staff member not found"],
    ["MENU_ITEM_NOT_FOUND", 404, "Menu item not found"],
    ["ORDER_NOT_FOUND", 404, "Order not found"],
    ["ORDER_NOT_FOUND_OR_ALREADY_CLOSED", 404, "Order not found or already closed"],
    ["INVALID_QUANTITY", 400, "Invalid Quantity"],
    ["INVALID_MENU_DATA", 400, "Invalid menu data"],
    ["INVALID_STAFF_DATA", 400, "Invalid staff data"],
    ["INVALID_TABLE_DATA", 400, "Invalid table data"],
    ["TABLE_IN_USE", 409, "Table is still used by existing orders"],
    ["INVALID_PASSWORD", 400, "Password is incorrect"],
    ["MENU_NOT_AVAILABLE", 400, "Menu item not available"],
    ["ORDER_CLOSED", 400, "Order closed"]
  ])("maps %s to status and message", (message, status, errorText) => {
    const { res } = runError(new Error(message));

    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith({ error: errorText });
  });

  test("maps postgres 23505 to 409", () => {
    const err = new Error("duplicate");
    err.code = "23505";

    const { res } = runError(err);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: "Duplicate value violates unique constraint" });
  });

  test("maps postgres 23503 to 409", () => {
    const err = new Error("foreign-key");
    err.code = "23503";

    const { res } = runError(err);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: "Resource is still referenced by related data"
    });
  });

  test("returns 500 for unknown errors", () => {
    const { res } = runError(new Error("UNKNOWN"));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal Server Error" });
  });
});

