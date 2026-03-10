const tableService = require("../services/tables.service");
const asyncHandler = require("../utils/asyncHandler");


exports.createTable = asyncHandler(async(req, res) => {
    const {table_number, capacity} = req.body
    const table = await tableService.createTable(table_number, capacity);
    res.status(201).json(table);
});

exports.getAllTables = asyncHandler(async(req, res) => {
    const tables = await tableService.getAllTables();
    res.json(tables);
});

exports.getTableById = asyncHandler(async(req, res) => {
    const { id } = req.params;
    const table = await tableService.getTableById(id);
    res.json(table);
});

exports.updateTable = asyncHandler(async(req, res) => {
    const { id } = req.params;
    const { table_number, capacity} = req.body;
    const table = await tableService.updateTable(id, table_number, capacity);
    res.json(table);
})

exports.deleteTable = asyncHandler(async(req, res) => {
    const { id } = req.params;
    const table = await tableService.deleteTable(id);
    res.json({ message: "Table deleted successfully", table });
})
