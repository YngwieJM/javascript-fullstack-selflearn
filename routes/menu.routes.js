const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menu.controller");
const validate = require("../middleware/validate.middleware");
const {authenticate, authorize} = require("../middleware/auth.middleware");
const {createMenuSchema, updateMenuSchema, updateAvailabilitySchema, getMenuByIdSchema} = require("../validators/menu.validator");

router.post("/", authenticate, authorize("MANAGER"),validate(createMenuSchema), menuController.createMenuItem);
router.get("/", authenticate, authorize("WAITER", "BARTENDER", "MANAGER"), menuController.getAllMenuItems);
router.get("/:id", authenticate, authorize("WAITER", "BARTENDER", "MANAGER"),validate(getMenuByIdSchema), menuController.getMenuItemById);
router.patch("/:id", authenticate, authorize("MANAGER"),validate(updateMenuSchema),  menuController.updateMenuItem);
router.patch("/:id/availability", authenticate, authorize("MANAGER"),validate(updateAvailabilitySchema), menuController.toggleAvailability);
router.delete("/:id", authenticate, authorize("MANAGER"),validate(getMenuByIdSchema), menuController.deleteMenuItem);

module.exports = router;
