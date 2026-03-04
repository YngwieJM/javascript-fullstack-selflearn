const express = require("express");
const router = express.Router();
const ordersController = require("../controllers/orders.controller");

router.post("/", ordersController.createOrder);

router.get("/", ordersController.getAllOrders);

router.post("/:id/items", ordersController.addItemToOrder);

router.get("/:id", ordersController.getOrderById);

router.patch("/:id/close", ordersController.closeOrder);

module.exports = router;