const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menu.controller");
const {authenticate, authorize} = require("../middleware/auth.middleware");

router.post("/", authenticate, authorize("MANAGER"), menuController.createMenuItem);
router.get("/", authenticate, authorize("WAITER", "BARTENDER", "MANAGER"), menuController.getAllMenuItems);
router.get("/:id", authenticate, authorize("WAITER", "BARTENDER", "MANAGER"), menuController.getMenuItemById);
router.patch("/:id", authenticate, authorize("MANAGER"),  menuController.updateMenuItem);
router.patch("/:id/availability", authenticate, authorize("MANAGER"), menuController.toggleAvailablity);
router.delete("/:id", authenticate, authorize("MANAGER"), menuController.deleteMenuItem);

// no security for these routes
// router.post("/", menuController.createMenuItem);
// router.get("/", menuController.getAllMenuItems);
// router.get("/:id", menuController.getMenuItemById);
// router.patch("/:id",  menuController.updateMenuItem);
// router.patch("/:id/availability", menuController.toggleAvailablity);
// router.delete("/:id", menuController.deleteMenuItem);

module.exports = router;