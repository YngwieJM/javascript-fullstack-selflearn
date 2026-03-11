const express = require("express");
const router = express.Router();

const reportController = require("../controllers/reports.controller");
const auth = require ("../middleware/auth.middleware");
const authorize = require("../middleware/auth.middleware");

router.use(auth);

router.get("/daily-sales", authorize("MANAGER"), reportController.getDailySales);
router.get("/top-menu", authorize("MANAGER"), reportController.getTopMenu);
router.get("/revenue", authorize("MANAGER"), reportController.getRevenue);

module.exports = router;