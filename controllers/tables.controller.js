const pool = require("../config/db");
const tableService = require("../services/tables.service");

exports.createTable = async(req, res, next) => {
    const {table_number, capacity} = req.body;

    try{
       const table = await tableService.createTable(table_number, capacity);
       res.status(201).json({message:"Table created successfully", table});
    }catch(err){
        next(err);
    }
};

exports.getAllTables = async(req, res, next) => {
    try{
        const tables = await tableService.getAllTables();

        res.status(200).json(tables);
    }catch(err){
        next(err);
    }
};

exports.getTableById = async(req, res, next) => {
    const id = req.params.id

    try{
        const table = await tableService.getTableById(id);

        res.status(200).json(table);
    }catch(err){
        next(err);
    }
};

exports.updateTable = async (req, res, next) => {
    const id = req.params.id;
    const{table_number, capacity} = req.body;

    try{
        const table = await tableService.updateTable(id, table_number, capacity);

        res.status(200).json(table);
    }catch(err){
        
        next(err);
    }
}

exports.deleteTable = async (req, res, next) => {
    const id = req.params.id;

    try{
        const table = await tableService.deleteTable(id);

        res.json({message: "Table delted successfully", table});
    }catch(err){
        next(err);
    }
};