const express = require("express");
const router = express.Router();
const tablesController = require("../controllers/tables.controller");
const { authenticate, authorize } = require("../middleware/auth.middleware");


router.post("/", authenticate, authorize("MANAGER"), tablesController.createTable);
router.put("/:id", authenticate, authorize("MANAGER"), tablesController.updateTable);
router.get("/", authenticate, authorize("MANAGER", "WAITER"), tablesController.getAllTables);
router.get("/:id", authenticate, authorize("MANAGER", "WAITER"), tablesController.getTableById);
router.delete("/:id", authenticate, authorize("MANAGER"), tablesController.deleteTable);

// router.post("/", tablesController.createTable);
// router.get("/", tablesController.getAllTables);
// router.get("/:id", tablesController.getTableById);
// router.put("/:id", tablesController.updateTable);
// router.delete("/:id", tablesController.deleteTable);

module.exports = router;