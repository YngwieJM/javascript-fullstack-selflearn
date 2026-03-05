const pool = require("../config/db");

exports.getAllTables = async () => {
    const result = await pool.query(
        `SELECT id, table_number, capacity
        FROM restaurant_tables
        ORDER BY table_number`
    );

    return result.rows;
};

exports.getTableById = async (id) => {
    const result = await pool.query(`
        SELECT id, table_number, capacity
        FROM restaurant_tables WHERE id = $1`, [id]);

        if(result.rows.length === 0){
            throw new Error("TABLE_NOT_FOUND");
        }

        return result.rows[0];
};

exports.createTable = async (table_number, capacity) => {

    if(!table_number || !capacity){
        throw new Error("INVALID_TABLE_DATA");
    }

    const result = await pool.query(`
        INSERT INTO restaurant_tables (table_number, capacity)
        VALUES ($1, $2) RETURNING *`,[table_number, capacity]);

        return result.rows[0];
};

exports.updateTable = async (id, table_number, capacity) => {

    const result = await pool.query(
        `UPDATE restaurant_tables SET
        table_number = $1, capacity = $2
        WHERE id = $3 RETURNING *`, [table_number, capacity, id]
    );

    if(result.rows.length === 0){
        throw new Error("TABLE_NOT_FOUND");
    }

    return result.rows[0];
};

exports.deleteTable = async (id) => {
    const result = await pool.query(
        `DELETE FROM restaurant_tables
        WHERE id = $1 RETURNING *`,[id]
    );

    if(result.rows.length === 0){
        throw new Error("TABLE_NOT_FOUND");
    }

    return result.rows[0];
}