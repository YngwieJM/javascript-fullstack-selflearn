const express = require("express");
const router = express.Router();
const ordersController = require("../controllers/orders.controller");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const {
  createOrderSchema,
  getOrderSchema,
  getOrderByIdSchema,
  addItemSchema,
  deleteOrderSchema,
  closeOrderSchema
} = require("../validators/order.validator");

router.post("/",authenticate, authorize("WAITER", "MANAGER"),validate(createOrderSchema), ordersController.createOrder);

router.post("/:id/items",authenticate, authorize("WAITER", "MANAGER"),validate(addItemSchema), ordersController.addItemOrder);

router.get("/",authenticate, authorize("MANAGER"), validate(getOrderSchema), ordersController.getAllOrders);

router.get("/:id",authenticate,authorize("WAITER", "MANAGER"),validate(getOrderByIdSchema), ordersController.getOrderById);

router.patch("/:id/close",authenticate ,authorize("WAITER", "MANAGER"),validate(closeOrderSchema), ordersController.closeOrder);

router.delete("/:id", authenticate, authorize("MANAGER"), validate(deleteOrderSchema), ordersController.deleteOrder);

module.exports = router;
