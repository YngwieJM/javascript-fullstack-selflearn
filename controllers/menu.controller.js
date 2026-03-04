const pool = require("../config/db");

exports.createMenuItem = async(req, res) => {
    const {name, category, price} = req.body;

    if(!name || !category || !price){
        return res.status(400).json({message: "All field required"});
    }

    try{
        const result = await pool.query(
            `INSERT INTO menu_items (name, category, price)
            VALUES($1, $2, $3)
            RETURNING *`, [name, category, price]
        );

        res.status(201).json(result.rows[0]);
    }catch(err){
        console.error(err);
        res.status(500).json({message: "Internal Server Error"});
    }
};

exports.getAllMenuItems = async (req, res) => {
    try{
        const result = await pool.query(
            `SELECT * FROM menu_items
            WHERE is_available = TRUE
            ORDER BY id ASC`
        );

        res.json(result.rows);
    }catch(err){
        console.error(err);
        res.status(500).jsone({message: "Internal Server Error"});
    }
};

exports.getMenuItemById = async (req, res) => {
    const id = parseInt(req.params.id);

    try{
        const result = await pool.query(
            `SELECT * FROM menu_items WHERE id = $1`, [id]
        );

        if(result.rows.length === 0){
            return res.status(404).json({message: "Menu item not found"});
        }

        res.json(result.rows[0]);
    }catch(err){
        console.error(err);
        res.status(500).json({message: "Internal Server Error"});
    }
};

exports.updateMenuItem = async (req, res) => {
    const id = parseInt(req.params.id);
    const {name, category, price, is_available} = req.body;

    try{
        const result = await pool.query(
            `UPDATE menu_items
            SET name = COALESCE($1, name),
                category = COALESCE($2, category),
                price = COALESCE($3, price),
                is_available = COALESCE($4, is_available)
            WHERE id = $5 RETURNING *`, [name, category, price, is_available, id]
        );

        if(result.rows.length === 0){
            return res.status(404).json({message: "Menu item not found"});
        }

        res.json(result.rows[0]);
    }catch(err){
        console.error(err);
        res.status({message: "Internal Server Error"});
    }
};

exports.deleteMenuItem = async (req, res) => {
    const id = parseInt(req.params.id);

    try{
        const result = await pool.query(
            `UPDATE menu_items
            SET is_available = FALSE
            WHERE id = $1 RETURNING *`, [id]
        );
        if(result.rows.length === 0){
            return res.status(404).json({message: "Menu item not found"});
        }

        res.json({message: "Menu item delted successfully", item:result.rows[0]})
    }catch(err){
        console.error(err);
        res.status(500).json({message: "Internal Server Error"});
    }
};