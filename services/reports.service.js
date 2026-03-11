const { exactOptional } = require("zod");
const pool = require("../config/db");

exports.getDailySales = async () => { 
    
    const result = await pool.query(
    `SELECT
        DATE(o.created_at) AS date,
        COUNT(DISTINCT o.id) AS total_orders,
        SUM(oi.quantity * oi.price_at_time) AS total_revenue
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE o.status = 'CLOSED'
     GROUP BY DATE(o.created_at) ORDER BY date DESC`
    );

    return result.rows;
};

exports.getTopMenuItems = async () => {
    
    const result = await pool.query(
        `SELECT m.name, SUM(oi.quantity) AS total_sold FROM order_items oi
         JOIN menu_items m ON m.id = oi.menu_item_id
         JOIN orders o ON o.id = oi.order_id
         WHERE o.status = 'CLOSED'
         GROUP BY m.name ORDER BY total_sold DESC LIMIT 10`
    );
}

exports.getRevenue = async () => {

    const result = await pool.query(
        `SELECT SUM(oi.quantity * oi.price_at_time) AS total_revenue
         FROM orders o JOIN order_items oi ON oi.order_id = o.id
         WHERE o.status = 'CLOSED'`
    );

    return result.rows[0];
};
