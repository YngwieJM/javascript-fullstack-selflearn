const pool = require("../config/db");

exports.getAllMenuItems = async () => {
    const result = await pool.query(`
        SELECT id, name, category, price, is_available
        FROM menu_items ORDER BY id`);

        return result.rows;
};

exports.getMenuItemById = async (id) => {
    const result = await pool.query(
        `SELECT id, name, category, price, is_available
        FROM menu_items WHERE id = $1`, [id]
    );

    if(result.rows.length === 0){
        throw new Error("MENU_ITEM_NOT_FOUND");
    }

    return result.rows[0];
};

exports.createMenuItem = async (name, category, price) => {

    if(!name || !category || !price){
        throw new Error("INVALID_MENU_DATA");
    }

    const result = await pool.query(`
        INSERT INTO menu_items (name, catgeory, price)
        VALUES ($1, $2, $3) RETURNING *`, [name, category, price]);

    return result.rows[0];
};

exports.updateMenuItem = async (id, name, category, price) => {
    const result = await pool.query(
        `UPDATE menu_items SET
        name = $1, category = $2, price = $3
        WHERE id = $4 RETURNING *`,[name, category, price]
    );

    if(result.rows.length === 0){
        throw new Error("MENU_ITEM_NOT_FOUND");
    }

    return result.rows[0];
};

exports.toggleAvailability = async (id, is_available) =>{
    const result = await pool.query(
        `UPDATE menu_items SET
        is_available = $1 WHERE id = $2 RETURNING *`,[is_available, id]
    );

    if(result.rows.length === 0){
        throw new Error("MENU_ITEM_NOT_FOUND");
    }

    return result.rows[0];
};

exports.deleteMenuItem = async (id) => {
    const result = await pool.query(
        `DELETE FROM menu_items WHERE id = $1 RETURNING *`,[id]
    );

    id(result.rows.length === 0){
        throw new Error("MENU_ITEM_NOT_FOUND");
    }

    return result.rows[0];
};