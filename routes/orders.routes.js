const express = require("express");
const router = express.Router();
const ordersController = require("../controllers/orders.controller");
const { authenticate, authorize } = require("../middleware/auth.middleware");

router.post("/",authenticate, authorize("WAITER", "MANAGER"), ordersController.createOrder);

router.post("/:id/items",authenticate, authorize("WAITER"), ordersController.addItemOrder);

router.get("/",authenticate, authorize("MANAGER"), ordersController.getAllOrders);

router.get("/:id",authenticate,authorize("WAITER", "MANAGER"), ordersController.getOrderById);

router.patch("/:id/close",authenticate ,authorize("WAITER", "MANAGER"), ordersController.closeOrder);

module.exports = router;