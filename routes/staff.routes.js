const express = require("express");
const router = express.Router();
const staffController = require("../controllers/staff.controller");
const  {authenticate, authorize } = require("../middleware/auth.middleware");
const {
    createStaffSchema,
    updateStaffSchema,
    updatePasswordSchema,
    getStaffByIdSchema,
    deleteStaffSchema,
    getStaffSchema
} = require("../validators/staff.validator");
const validate = require("../middleware/validate.middleware");


router.get("/", authenticate, authorize("MANAGER"), validate(getStaffSchema), staffController.getAllStaff);
router.get("/:id", authenticate, authorize("MANAGER"), validate(getStaffByIdSchema), staffController.getStaffById);
router.post("/", authenticate, authorize("MANAGER"), validate(createStaffSchema), staffController.createStaff);
router.put("/:id", authenticate, authorize("MANAGER"),validate(updateStaffSchema), staffController.updateStaff);
router.patch("/:id", authenticate, authorize("MANAGER", "WAITER", "BARTENDER"),validate(updatePasswordSchema), staffController.updatePassword);
router.delete("/:id", authenticate, authorize("MANAGER"),validate(deleteStaffSchema), staffController.deleteStaff);

module.exports = router;
