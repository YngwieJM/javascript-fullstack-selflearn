exports.errorHandler= (err, req, res, next) => {

    console.error(err);

    let statusCode = 500;
    let message = "Internal Server Error";

    switch(err.message){

        case "TABLE_NOT_FOUND":
            statusCode = 404;
            message = "Table not found";
            break;

        case "STAFF_NOT_FOUND":
            statusCode = 404;
            message = "Staff member not found";
            break;

        case "MENU_ITEM_NOT_FOUND":
            statusCode = 404;
            message = "Menu item not found";
            break;

        case "ORDER_NOT_FOUND_OR_ALREADY_CLOSED":
            statusCode = 404;
            message = "Order not found or already closed";
            break;

        case "ORDER_NOT_FOUND":
            statusCode = 404;
            message = "Order not found";
            break;

        case "INVALID_QUANTITY":
            statusCode = 400;
            message = "Invalid Quantity"
            break;       

        case "INVALID_MENU_DATA":
            statusCode = 400;
            message ="Invalid menu data";
            break;

        case "INVALID_STAFF_DATA":
            statusCode = 400;
            message = "Invalid staff data";
            break;

        case "INVALID_TABLE_DATA":
            statusCode = 400;
            message = "Invalid table data";
            break;

        case "INVALID_PASSWORD":
            statusCode = 400;
            message = "Password is incorrect";
            break;

        case "MENU_NOT_AVAILABLE":
            statusCode = 400;
            message = "Menu item not available";
            break;

        case "ORDER_CLOSED":
            statusCode = 400;
            message = "Order closed";
            break;
    }

    /* =========================
     PostgreSQL Errors
  ========================= */

  if (err.code === "23505") {
    statusCode = 409;
    message = "Duplicate value violates unique constraint";
  }

  if (err.code === "23503") {
    statusCode = 409;
    message = "Resource is still referenced by related data";
  }

    res.status(statusCode).json({error: message});

};