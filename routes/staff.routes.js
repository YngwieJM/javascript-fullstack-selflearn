const express = require("express");
const router = express.Router();
const staffController = require("../controllers/staff.controller");
const  {authenticate, authorize } = require("../middleware/auth.middleware");

router.get("/", authenticate, authorize("MANAGER"), staffController.getAllStaff);
router.get("/:id", authenticate. authorize("MANAGER"), staffController.getStaffById);
router.post("/", authenticate, authorize("MANAGER"), staffController.createStaff);
router.put(":/id", authenticate, authorize("MANAGER"), staffController.updateStaff);
router.patch(":/id", authenticate, authorize("MANAGER"), "WAITER", "BARTENDER"), staffController.updatePassword);
router.delete("/:id", authenticate, authorize("MANAGER"), staffController.deleteStaff);

// router.post("/", staffController.createStaff);
// router.get("/", staffController.getAllStaff);
// router.get("/:id", staffController.getStaffById);
// router.put("/:id", staffController.updateStaff);
// router.delete("/:id", staffController.deleteStaff);

module.exports = router;