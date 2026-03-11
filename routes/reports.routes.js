const express = require("express");
const router = express.Router();

const reportController = require("../controllers/reports.controller");
const { authenticate, authorize } = require("../middleware/auth.middleware");

router.get("/daily-sales", authenticate, authorize("MANAGER"), reportController.getDailySales);
router.get("/top-menu", authenticate, authorize("MANAGER"), reportController.getTopMenu);
router.get("/revenue", authenticate, authorize("MANAGER"), reportController.getRevenue);

module.exports = router;
