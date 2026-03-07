const express = require("express");
const router = express.Router();
const tablesController = require("../controllers/tables.controller");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const { createTableSchema, updateTableSchema, getTableByIdSchema, deleteTableSchema} = require("../validators/table.validator");


router.post("/", authenticate, authorize("MANAGER"), validate(createTableSchema), tablesController.createTable);
router.put("/:id", authenticate, authorize("MANAGER"), validate(updateTableSchema), tablesController.updateTable);
router.get("/", authenticate, authorize("MANAGER", "WAITER"), tablesController.getAllTables);
router.get("/:id", authenticate, authorize("MANAGER", "WAITER"),validate(getTableByIdSchema), tablesController.getTableById);
router.delete("/:id", authenticate, authorize("MANAGER"), validate(deleteTableSchema), tablesController.deleteTable);

module.exports = router;
