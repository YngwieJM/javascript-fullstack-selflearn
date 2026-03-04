const pool = require("../config/db");

exports.createTable = async(req, res) => {
    const {table_number, capacity} = req.body;

    if(!table_number || !capacity){
        return res.status(400).json({message:"Table number and Capacity required"});
    }

    try{
        const result = await pool.query(
            `INSERT INTO restaurant_tables (table_number, capacity)
            VALUES($1, $2) RETURNING *`, [table_number, capacity]
        );

        res.status(201).json(result.rows[0]);
    }catch(err){
        console.error(err);

        if(err.code === '23505'){
            return res.status(400).json({message:"Table number must be unique"});
        }

        res.status(500).json({message: "Internal Server Error"});
    }
};

exports.getAllTables = async(req, res) => {
    try{
        const result = await pool.query(
            `SELECT * FROM restaurant_tables ORDER BY id ASC`
        );

        res.json(result.rows);
    }catch(err){
        console.error(err);
        res.status(500).json({message: "Internal Server Error"});
    }
};

exports.getTableById = async(req, res) => {
    const id = parseInt(req.params.id);

    try{
        const result = await pool.query(
            `SELECT * FROM restaurant_tables WHERE id = $1`, [id]
        );

        if(result.rows.length === 0){
            return res.status(404).json({message: "Table not found"});
        }

        res.json(result.rows[0]);
    }catch(err){
        console.error(err);
        res.status(500).json({message:"Internal Server Error"});
    }
};

exports.updateTable = async (req, res) => {
    const id = parseInt(req.params.id);
    const{table_number, capacity} = req.body;

    try{
        const result = await pool.query(
            `UPDATE restaurant_tables
            SET table_number = COALESCE($1, table_number),
                capacity = COALESCE($2, capacity)
            WHERE id = $3 RETURNING *`, [table_number, capacity, id]
        );

        if(result.rows.length === 0){
            return res.status(404).json({message: "Table not found"});
        }

        res.json(result.rows[0]);
    }catch(err){
        
        console.error(err);

        if(err.code === "23505"){
            return res.status(400).json({message: "Tabble number must be unique"});
        }

        res.status(500).json({message: "Internal Server error"});
    }
}

exports.deleteTable = async (req, res) => {
    const id = parseInt(req.params.id);

    try{
        const result = await pool.query(
            `DELETE FROM restaurant_tables
            WHERE id = $1 RETURNING *`, [id]
        );

        if(result.rows.length === 0){
            return res.status(404).json({message: "Table not found"});
        }

        res.json({message: "Table delted successfully", table: result.rows[0]});
    }catch(err){
        console.error(err);

        if(err.code === "23503"){
            return res.status(400).json({message: "Cannot delete table with existing orders"});
        }
        res.status(500).json({message: "Internal Server Error"});
    }
};