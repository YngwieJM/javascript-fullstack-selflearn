const pool = require("../config/db");

exports.createOrder = async (table_id, staff_id) => {
    
    const tableCheck = await pool.query(
        "SELECT * FROM restaurant_tables WHERE id = $1",[table_id]
    );

    if(tableCheck.rows.length ===0){
        throw new Error("TABLE_NOT_FOUND");
    }

    const staffCheck = await pool.query(
        "SELECT * FROM staff WHERE id = $1", [staff_id]
    );

    if(staffCheck.rows.length ===0){
        throw new Error("STAFF_NOT_FOUND");
    }

    const result = await pool.query(
        `INSERT INTO orders (table_id, staff_id)
        VALUES ($1, $2) RETURNING *`, [table_id, staff_id]
    );
    
    return result.rows[0];
};

exports.addItemToOrder = async (orderId, menu_item_id, quanity) => {
    if(!quanity || quanity <= 0){
        throw new Error("INVALID_QUANTITY");
    }

    const client = await pool.connect();

    try{
        await client.query("BEGIN");

        const orderCheck = await client.query(
            "SELECT * FROM orders WHERE id = $1", [orderId]
        );

        if(orderCheck.rows.length === 0){
            throw new Error("ORDER_NOT_FOUND");
        }

        if(orderCheck.rows[0].status !== "OPEN"){
            throw new Error("ORDER_CLOSED");
        }

        const menuCheck = await client.query(
            "SELECT * FROM menu_items WHERE id = $1 AND is_available = TRUE", [menu_item_id]
        );

        if(menuCheck.rows.length === 0){
            throw new Error("MENU_NOT_AVAILABLE");
        }

        const price = menuCheck.rows[0].price;

        const insertResult = await client.query(
            `INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time)
            VALUES ($1, $2, $3, $4) RETURNING *`, [orderId, menu_item_id, quanity, price]
        );

        await client.query("COMMIT");
        return insertResult.rows[0];
    }catch(err){
        await client.query("ROLLBACK");
        throw err;
    }finally{
        client.release();
    }
};
