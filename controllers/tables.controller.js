const pool = require("../config/db");
const tableService = require("../services/tables.service");

exports.createTable = async(req, res) => {
    const {table_number, capacity} = req.body;

    try{
       const table = await tableService.createTable(table_number, capacity);
       res.status(201).json({message:"Table created successfully", table});
    }catch(err){
        console.error(err);

        if(err.message === "INVALID_TABLE_DATA"){
            return res.status(400).json({message: "Invalid Table Data"});
        }

        if(err.code === '23505'){
            return res.status(400).json({message:"Table number must be unique"});
        }

        res.status(500).json({message: "Internal Server Error"});
    }
};

exports.getAllTables = async(req, res) => {
    try{
        const tables = await tableService.getAllTables();

        res.status(200).json(tables);
    }catch(err){
        console.error(err);
        res.status(500).json({message: "Internal Server Error"});
    }
};

exports.getTableById = async(req, res) => {
    const id = req.params.id

    try{
        const table = await tableService.getTableById(id);

        res.status(200).json(table);
    }catch(err){

        if(err.message === "TABLE_NOT_FOUND"){
            return res.status(404).json({message:"Table not found"});
        }
        res.status(500).json({message:"Internal Server Error"});
    }
};

exports.updateTable = async (req, res) => {
    const id = req.params.id;
    const{table_number, capacity} = req.body;

    try{
        const table = await tableService.updateTable(id, table_number, capacity);

        res.status(200).json(table);
    }catch(err){
        
        console.error(err);

        if(err.message === "TABLE_NOT_FOUND"){
            return res.status(404).json({message: "Table not found"});
        }

        if(err.code === "23505"){
            return res.status(400).json({message: "Tabble number must be unique"});
        }

        res.status(500).json({message: "Internal Server error"});
    }
}

exports.deleteTable = async (req, res) => {
    const id = req.params.id;

    try{
        const table = await tableService.deleteTable(id);

        res.json({message: "Table delted successfully", table});
    }catch(err){
        console.error(err);

        if(err.message === "TABLE_NOT_FOUND"){
            return res.status(404).json({message:"Table not found"});
        }

        if(err.code === "23503"){
            return res.status(400).json({message: "Cannot delete table with existing orders"});
        }
        res.status(500).json({message: "Internal Server Error"});
    }
};