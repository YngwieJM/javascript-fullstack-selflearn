const express = require("express");
const router = express.Router();
const tablesController = require("../controllers/tables.controller");

router.post("/", tablesController.createTable);
router.get("/", tablesController.getAllTables);
router.get("/:id", tablesController.getTableById);
router.put("/:id", tablesController.updateTable);
router.delete("/:id", tablesController.deleteTable);

module.exports = router;