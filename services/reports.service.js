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

    return result.rows;
}

exports.getRevenue = async () => {

    const result = await pool.query(
        `SELECT SUM(oi.quantity * oi.price_at_time) AS total_revenue
         FROM orders o JOIN order_items oi ON oi.order_id = o.id
         WHERE o.status = 'CLOSED'`
    );

    return result.rows[0];
};


exports.getSalesByStaff = async () => {

    const result = await pool.query(
        `SELECT s.id, s.name, COUNT(DISTINCT o.id) AS total_orders, SUM(oi.quantity * oi.price_at_time) AS total_revenue
         FROM orders o JOIN staff s ON s.id = o.staff_id
         JOIN order_items oi ON oi.order_id = o.id
         WHERE o.status = 'CLOSED' GROUP BY s.id, s.name ORDER BY total_revenue DESC`
    );

    return result.rows;
};

exports.getSalesByCategory = async () => {

    const result = await pool.query(
        `SELECT m.category, SUM(oi.quantity) AS total_items_sold, SUM(oi.quantity * oi.price_at_time) AS total_revenue
         FROM order_items oi JOIN menu_items m ON m.id = oi.menu_item_id
         JOIN orders o ON o.id = oi.order_id
         WHERE o.status = 'CLOSED' GROUP BY m.category ORDER BY total_revenue DESC`
    );

    return result.rows;
};

exports.getHourlySales = async (date) => {
  const values = [];
  let where = "o.status = 'CLOSED'";

  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    values.push(date);
    // Adjust timezone if your app is not UTC
    where += " AND DATE(o.created_at) = $1::date";
  }

  const result = await pool.query(
    `SELECT TO_CHAR(DATE_TRUNC('hour', o.created_at), 'DD-MM-YYYY HH24:00:00') AS hour,
         COUNT(DISTINCT o.id)::int AS total_orders,
         COALESCE(SUM(oi.quantity * oi.price_at_time), 0) AS total_revenue
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE ${where}
     GROUP BY DATE_TRUNC('hour', o.created_at)
     ORDER BY DATE_TRUNC('hour', o.created_at)`,
    values
  );

  return result.rows;
};
