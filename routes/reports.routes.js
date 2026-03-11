const express = require("express");
const router = express.Router();

const reportController = require("../controllers/reports.controller");
const { authenticate, authorize } = require("../middleware/auth.middleware");

router.get("/daily-sales", authenticate, authorize("MANAGER"), reportController.getDailySales);
router.get("/top-menu", authenticate, authorize("MANAGER"), reportController.getTopMenu);
router.get("/revenue", authenticate, authorize("MANAGER"), reportController.getRevenue);
router.get("/sales-by-staff", authenticate, authorize("MANAGER"), reportController.getSalesByStaff);
router.get("/sales-by-category", authenticate, authorize("MANAGER"), reportController.getSalesByCategory);
router.get("/hourly-sales", authenticate, authorize("MANAGER"), reportController.getHourlySales);

module.exports = router;
