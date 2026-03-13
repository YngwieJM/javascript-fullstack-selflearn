require("dotenv").config({ path: "./config/.env" });
const pool = require("../config/db");
const dataBank = require("./scenario.data-bank");

const SHIFT_START = "09:00:00";
const SHIFT_END = "23:00:00";
const CLEAN_MASTER_DATA =
  String(process.env.CLEAN_MASTER_DATA || "").toLowerCase() === "true" ||
  process.argv.includes("--full");
const GENERATED_EMAIL_DOMAIN =
  typeof dataBank.staffPolicy?.generatedEmailDomain === "string" &&
  dataBank.staffPolicy.generatedEmailDomain.trim() !== ""
    ? dataBank.staffPolicy.generatedEmailDomain.trim().toLowerCase()
    : "restaurantmail.com";

const SCENARIO_STAFF_EMAILS = [
  "rafi.nugroho@test.com",
  "nadia.putri@test.com",
  "kevin.pratama@test.com"
];

const SCENARIO_MENU_NAMES = [
  "Espresso",
  "Cappuccino",
  "Iced Tea",
  "Mojito",
  "Chicken Steak",
  "Caesar Salad",
  "Pasta Carbonara",
  "Chocolate Cake",
  "Tiramisu"
];

function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function assertDateInput(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error("OPS_DATE must use YYYY-MM-DD format");
  }
}

async function main() {
  const operationDate = process.env.OPS_DATE || localDateString();
  assertDateInput(operationDate);

  const startTimestamp = `${operationDate} ${SHIFT_START}`;
  const endTimestamp = `${operationDate} ${SHIFT_END}`;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const ordersResult = await client.query(
      `SELECT id
       FROM orders
       WHERE status = 'CLOSED'
         AND created_at >= $1
         AND created_at < $2
       ORDER BY id`,
      [startTimestamp, endTimestamp]
    );

    const orderIds = ordersResult.rows.map((row) => row.id);

    let deleteItemsResult = { rows: [] };
    let deleteOrdersResult = { rows: [] };

    if (orderIds.length > 0) {
      deleteItemsResult = await client.query(
        `DELETE FROM order_items
         WHERE order_id = ANY($1::int[])
         RETURNING id`,
        [orderIds]
      );

      deleteOrdersResult = await client.query(
        `DELETE FROM orders
         WHERE id = ANY($1::int[])
         RETURNING id`,
        [orderIds]
      );
    }

    let deletedStaffCount = 0;
    let deletedMenuCount = 0;

    if (CLEAN_MASTER_DATA) {
      const deletedStaff = await client.query(
        `DELETE FROM staff s
         WHERE (
             LOWER(s.email) = ANY($1::text[])
             OR LOWER(s.email) LIKE $2
           )
           AND NOT EXISTS (
             SELECT 1 FROM orders o WHERE o.staff_id = s.id
           )
         RETURNING s.id`,
        [SCENARIO_STAFF_EMAILS, `%@${GENERATED_EMAIL_DOMAIN}`]
      );
      deletedStaffCount = deletedStaff.rows.length;

      const deletedMenu = await client.query(
        `DELETE FROM menu_items m
         WHERE (
             m.name = ANY($1::text[])
             OR m.name ILIKE '%(SCN-%)'
           )
           AND NOT EXISTS (
             SELECT 1 FROM order_items oi WHERE oi.menu_item_id = m.id
           )
         RETURNING m.id`,
        [SCENARIO_MENU_NAMES]
      );
      deletedMenuCount = deletedMenu.rows.length;
    }

    await client.query("COMMIT");

    console.log(`Cleanup completed for ${operationDate} (${SHIFT_START}-${SHIFT_END}).`);
    console.log(`Deleted orders: ${deleteOrdersResult.rows.length}`);
    console.log(`Deleted order_items: ${deleteItemsResult.rows.length}`);
    if (CLEAN_MASTER_DATA) {
      console.log(`Deleted scenario staff: ${deletedStaffCount}`);
      console.log(`Deleted scenario menu items (unreferenced): ${deletedMenuCount}`);
    } else {
      console.log("Master data cleanup skipped (set CLEAN_MASTER_DATA=true to enable).");
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Cleanup failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
