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

exports.addItemToOrder = async (orderId, menu_item_id, quantity) => {
    if(!quantity || quantity <= 0){
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
            VALUES ($1, $2, $3, $4) RETURNING *`, [orderId, menu_item_id, quantity, price]
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

exports.getAllOrders = async () => {
    const result = await pool.query(
        `SELECT o.id, o.status, o.created_at, t.table_number, s.name As staff_name
        FROM orders o
        JOIN restaurant_tables t On o.table_id = t.id
        JOIN staff s ON o.staff_id = s.id
        ORDER BY o.created_at DESC`
    );

    return result.rows;
};

exports.getOrderById = async (orderId) => {
    const orderResult = await pool.query(
        `SELECT o.id, o.status, o.created_at, t.table_number, s.name AS staff_name
        FROM orders o
        JOIN restaurant_tables t ON o.table_id = t.id
        JOIN staff s ON o.staff_id = s.id
        WHERE o.id = $1`, [orderId]
    );

    if(orderResult.rows.length === 0){
        throw new Error("ORDER_NOT_FOUND");
    }

    const itemResult = await pool.query(
        `SELECT oi.id, m.name, oi.quantity, oi.price_at_time,
        (oi.quantity * oi.price_at_time) AS subtotal
        FROM order_items oi JOIN menu_items m ON oi.menu_item_id = m.id
        WHERE oi.order_id = $1`, [orderId]
    );

    const total = itemResult.rows.reduce(
        (sum, item) => sum + Number(item.subtotal),0
    );

    return {
        ...orderResult.rows[0],
        items: itemResult.rows,
        total
    };
};

exports.closeOrder = async (orderId) => {
    const result = await pool.query(
        `UPDATE orders SET status = 'CLOSED'
        WHERE id = $1 AND status = 'OPEN' RETURNING *`, [orderId]
    );

    if(result.rows.length === 0){
        throw new Error("ORDER_NOT_FOUND_OR_ALREADY_CLOSED");
    }

    return result.rows[0];
};

exports.deleteOrder = async (orderId) => {
    const result  = await pool.query(
        "DELETE FROM orders WHERE id = $1 RETURNING *", [orderId]
    );

    if(result.rows.length === 0){
        throw new Error("ORDER_NOT_FOUND");
    }

    return result.rows[0];
};