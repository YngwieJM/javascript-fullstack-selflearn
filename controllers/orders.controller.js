const pool = require("../config/db");

function toInt(value){
    const n = Number.parseInt(value, 10);
    return Number.isNaN(n) ? null : n;
}

exports.createOrder = async (req, res) => {
    const { table_id, staff_id } =req.body;

    try{
        const tableCheck = await pool.query(
            "SELECT * FROM restaurant_tables WHERE id = $1",
            [table_id]
        );

        if(tableCheck.rows.length === 0){
            return res.status(404).json({message: "Table not found"})
        }

        const staffCheck = await pool.query(
            "SELECT * FROM staff WHERE id = $1",
            [staff_id]
        );

        if(staffCheck.rows.length === 0){
            return res.status(404).json({message: "Staff not found"});
        }

        const result = await pool.query(
            `INSERT INTO orders (table_id, staff_id)
            VALUES ($1, $2 )
            RETURNING *`,
            [table_id, staff_id]
        );

        res.status(201).json(result.rows[0]);
    }catch(err){
        console.error(err);
        res.status(500).json({message: "Internal Server Error"});
    }
};

exports.addItemOrder = async (req, res) => {
    const orderId = parseInt(req.params.id);
    const { menu_item_id, quantity} = req.body;

    if(!quantity || quantity <= 0){
        return res.status(400).json({message: "Invalid quantity"});
    }

    const client = await pool.connect();

    try{
        await client.query("BEGIN");

        const orderCheck = await client.query(
            "SELECT * FROM orders WHERE id = $1", [orderId]
        );

        if(orderCheck.rows.length === 0){
            await client.query("ROLLBACK");
            return res.status(404).json({message: "Order not found"});
        }

        if(orderCheck.rows[0].status !== "OPEN"){
            await client.query("ROLLBACK");
            return res.status(400).json({message: "Order is closed"});
        }

        const menuCheck = await client.query(
            "SELECT * FROM menu_items WHERE id = $1 AND is_available = TRUE", [menu_item_id]
        );

        if(menuCheck.rows.length ===0){
            await client.query("ROLLBACK")
            return res.status(404).json({message: "Menu item not available"});
        }

        const price = menuCheck.rows[0].price;

        const insertResult = await client.query(
            `INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time)
            VALUES($1, $2, $3, $4)
            RETURNING *`, [orderId, menu_item_id, quantity, price]
        );

        await client.query("COMMIT");

        res.status(201).json(insertResult.rows[0])
    }catch(err){
        await client.query("ROLLBACK");
        console.error(err);
        res.status(500).json({message: "Internal Server Error"});
    }finally{
        client.release();
    }
};

exports.getAllOrders = async (req, res) => {
    try{
        const result = await pool.query(
            `SELECT o.*,
                    rt.table_number,
                    s.name AS staff_name
            FROM orders o 
            JOIN restaurant_tables rt ON o.table_id = rt.id
            JOIN staff s ON o.staff_id = s.ID
            ORDER BY o.created_at DESC`
        );

        res.json(result.rows);
    }catch(err){
        console.error(err);
        res.status(500).json({message: "Internal Server Error"});
    }
};

exports.getOrderById = async (req, res) => {
    const orderId = parseInt(req.params.id);

    try{
        const orderResult = await pool.query(
            `SELECT o.*,
                    rt.table_number,
                    s.name AS staff_name
            FROM orders o
            JOIN restaurant_tables rt ON o.table_id = rt.id
            JOIN staff s ON o.staff_id = s.id
            WHERE o.id = $1`, [orderId]
        );

        if(orderResult.rows.length === 0){
            return res.status(404).json({message: "Order not found"});

        }

        const itemsResult = await pool.query(
            `SELECT
                oi.id,
                m.name,
                oi.quantity,
                oi.price_at_time,
                (oi.quantity * oi.price_at_time) AS subtotal
            FROM order_items oi
            JOIN menu_items m ON oi.menu_item_id = m.id
            WHERE oi.order_id = $1`,[orderId]
        );

        const totalResult = await pool.query(
            `SELECT COALESCE(SUM(quantity * price_at_time), 0) AS total
            FROM order_items
            WHERE order_id = $1`, [orderId]
        );

        res.json({
            ...orderResult.rows[0],
            items: itemsResult.rows,
            total: totalResult.rows[0].total
        });
    }catch(err){
        console.error(err);
        res.status(500).json({ message: "Internal Server Error"});
    }
};

exports.closeOrder = async (req, res) => {
    const orderId = parseInt(req.params.id);

    try{
        const result = await pool.query(
            `UPDATE orders
            SET status = 'CLOSED'
            WHERE id = $1 AND status = 'OPEN'
            RETURNING *`,[orderId]
        );

        if(result.rows.length === 0){
            return res.status(400).json({message: "Order not found or already closed"});
        }

        res.json({
            message: "Order Closed Successfully",
            order: result.rows[0]
        });
    }catch(err){
        console.error(err);
        res.status(500).json({message: "Internal Server Error"});
    }
};