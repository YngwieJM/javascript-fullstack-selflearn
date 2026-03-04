const pool = require("../config/db");

exports.createStaff = async(req, res) => {
    const {name, role} = req.body;

    if(!name || !role){
        return res.status(400).json({message: "Name and Role required"});
    }

    try{
        const result = await pool.query(
            `INSERT INTO staff (name, role)
            VALUES ($1, $2)
            RETURNING*`, [name, role]
        );

        res.status(201).json(result.rows[0]);
    }catch(err){
        console.error(err);
        res.status(500).json({message: "Internal Server Error"});
    }
};

exports.getAllStaff = async (req, res) => {
    try{
        const result = await pool.query(
            `SELECT * FROM staff ORDER BY id ASC`
        );

        res.json(result.rows);
    }catch(err){
        console.error(err);
        res.status(500).json({message: "Internal Server Error"});
    }
};

exports.getStaffById = async (req, res) => {
    const id = parseInt(req.params.id);

    try{
        const result = await pool.query(
            `SELECT * FROM staff WHERE id = $1`, [id]
        );

        if(result.rows.length === 0 ){
            return res.status(404).json({message: "Staff not found"});
        }

        res.json(result.rows[0]);
    }catch(err){
        console.error(err);
        res.status(500).json({message: "Internal Server Error"});
    }
};

exports.updateStaff = async (req, res) => {
    const id = parseInt(req.params.id);
    const{name, role} = req.body;

    try{
        const result = await pool.query(
            `UPDATE staff
            SET name = COALESCE($1, name),
                role = COALESCE($2, role)
            WHERE id = $3 RETURNING *`, [name, role, id]
        );

        if(result.rows.length === 0){
            return res.status(404).json({message: "Staff not found"});
        }

        res.json(result.rows[0]);
    }catch(err){
        console.error(err);
        res.status(500).json({message: "Internal Server Error"});
    }
};

exports.deleteStaff = async (req, res) => {
    const id = parseInt(req.params.id);

    try{
        const result = await pool.query(
            `DELETE FROM staff WHERE id = $1 RETURNING *`, [id]
        );

        if(result.rows.length === 0){
            return res.status(404).json({message: "Staff not found"});
        }

        res.json({message: "Staff deleted successfully", staff: result.rows[0]});
    }catch (err){
        console.error(err);

        if(err.code === "23503"){
            return res.status(400).json({message: "Cannot delete staff member associated with an order"});
        }

        res.status(500).json({message: "Internal Server Error"});
    }
};