require("dotenv").config({ path: "./config/.env" });
const bcrypt = require("bcrypt");
const pool = require("../config/db");

const DEFAULT_PASSWORD = "123456";
const SHIFT_START = "06:00:00";
const SHIFT_END = "12:00:00";

const CORE_STAFF = [
  { id: 2, name: "Anna", email: "anna@test.com", role: "BARTENDER" },
  { id: 3, name: "Michael", email: "michael@test.com", role: "WAITER" },
  { id: 4, name: "Admin", email: "admin@test.com", role: "MANAGER" },
  { id: 5, name: "Jordan", email: "jordan@test.com", role: "WAITER" },
  { id: 6, name: "Lisa", email: "lisa@test.com", role: "WAITER" }
];

const REAL_STAFF = [
  { name: "Rafi Nugroho", email: "rafi.nugroho@test.com", role: "WAITER" },
  { name: "Nadia Putri", email: "nadia.putri@test.com", role: "BARTENDER" },
  { name: "Kevin Pratama", email: "kevin.pratama@test.com", role: "WAITER" }
];

const TABLE_LAYOUT = [
  { table_number: "VIP 1", capacity: 6 },
  { table_number: "VIP 2", capacity: 6 },
  { table_number: "VIP 3", capacity: 8 },
  { table_number: "Terrace 1", capacity: 4 },
  { table_number: "Terrace 2", capacity: 4 },
  { table_number: "Terrace 3", capacity: 4 },
  { table_number: "Table 1", capacity: 2 },
  { table_number: "Table 2", capacity: 4 },
  { table_number: "Table 3", capacity: 4 }
];

const MENU_SETUP = [
  { name: "Espresso", category: "DRINK", price: 30000 },
  { name: "Cappuccino", category: "DRINK", price: 35000 },
  { name: "Iced Tea", category: "DRINK", price: 18000 },
  { name: "Mojito", category: "DRINK", price: 28000 },
  { name: "Burger", category: "FOOD", price: 75000 },
  { name: "Chicken Steak", category: "FOOD", price: 95000 },
  { name: "Caesar Salad", category: "FOOD", price: 55000 },
  { name: "Pasta Carbonara", category: "FOOD", price: 85000 },
  { name: "Chocolate Cake", category: "DESSERT", price: 45000 },
  { name: "Tiramisu", category: "DESSERT", price: 48000 }
];

const SHIFT_ORDERS = [
  { time: "06:05:00", table: "Terrace 1", staff_id: 5, items: [{ menu: "Espresso", quantity: 2 }, { menu: "Caesar Salad", quantity: 1 }] },
  { time: "06:20:00", table: "VIP 1", staff_id: 3, items: [{ menu: "Cappuccino", quantity: 2 }, { menu: "Pasta Carbonara", quantity: 1 }] },
  { time: "06:40:00", table: "Table 1", staff_id: 6, items: [{ menu: "Iced Tea", quantity: 2 }, { menu: "Burger", quantity: 2 }] },
  { time: "07:10:00", table: "Terrace 2", staff_id: 5, items: [{ menu: "Mojito", quantity: 2 }, { menu: "Chicken Steak", quantity: 1 }] },
  { time: "08:00:00", table: "VIP 2", staff_id: 3, items: [{ menu: "Espresso", quantity: 3 }, { menu: "Burger", quantity: 3 }, { menu: "Chocolate Cake", quantity: 1 }] },
  { time: "09:15:00", table: "Table 2", staff_id: 6, items: [{ menu: "Iced Tea", quantity: 2 }, { menu: "Caesar Salad", quantity: 2 }] },
  { time: "10:00:00", table: "Terrace 3", staff_id: 5, items: [{ menu: "Cappuccino", quantity: 1 }, { menu: "Pasta Carbonara", quantity: 2 }] },
  { time: "10:35:00", table: "VIP 3", staff_id: 3, items: [{ menu: "Mojito", quantity: 2 }, { menu: "Chicken Steak", quantity: 2 }, { menu: "Tiramisu", quantity: 2 }] },
  { time: "11:05:00", table: "Table 3", staff_id: 6, items: [{ menu: "Espresso", quantity: 1 }, { menu: "Burger", quantity: 1 }] },
  { time: "11:40:00", table: "VIP 1", staff_id: 5, items: [{ menu: "Cappuccino", quantity: 2 }, { menu: "Chocolate Cake", quantity: 2 }] }
];

function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function ensureCoreStaff(client, passwordHash) {
  for (const member of CORE_STAFF) {
    const exists = await client.query("SELECT id FROM staff WHERE id = $1", [member.id]);
    if (exists.rows.length === 0) {
      throw new Error(`Missing required staff id ${member.id}. Seed baseline staff first.`);
    }

    await client.query(
      `UPDATE staff
       SET name = $1, email = $2, role = $3, password = $4
       WHERE id = $5`,
      [member.name, member.email.toLowerCase(), member.role, passwordHash, member.id]
    );
  }
}

async function cleanupPlaceholderStaff(client) {
  const managerId = 4;
  const placeholderRows = await client.query(
    "SELECT id FROM staff WHERE LOWER(name) IN ('mgr', 'waiter')"
  );
  const placeholderIds = placeholderRows.rows.map((row) => row.id);

  if (placeholderIds.length === 0) {
    return 0;
  }

  await client.query(
    "UPDATE orders SET staff_id = $1 WHERE staff_id = ANY($2::int[])",
    [managerId, placeholderIds]
  );

  const deleted = await client.query(
    "DELETE FROM staff WHERE id = ANY($1::int[]) RETURNING id",
    [placeholderIds]
  );

  return deleted.rows.length;
}

async function upsertRealStaff(client, passwordHash) {
  let created = 0;
  let updated = 0;

  for (const member of REAL_STAFF) {
    const existing = await client.query("SELECT id FROM staff WHERE email = $1", [
      member.email.toLowerCase()
    ]);

    if (existing.rows.length > 0) {
      await client.query(
        `UPDATE staff
         SET name = $1, role = $2, password = $3
         WHERE id = $4`,
        [member.name, member.role, passwordHash, existing.rows[0].id]
      );
      updated += 1;
      continue;
    }

    await client.query(
      `INSERT INTO staff (name, email, role, password)
       VALUES ($1, $2, $3, $4)`,
      [member.name, member.email.toLowerCase(), member.role, passwordHash]
    );
    created += 1;
  }

  return { created, updated };
}

async function normalizeTables(client) {
  const existing = await client.query(
    "SELECT id, capacity FROM restaurant_tables ORDER BY id"
  );

  for (const row of existing.rows) {
    await client.query(
      "UPDATE restaurant_tables SET table_number = $1 WHERE id = $2",
      [`TMP-${row.id}`, row.id]
    );
  }

  const assignCount = Math.min(existing.rows.length, TABLE_LAYOUT.length);

  for (let i = 0; i < assignCount; i += 1) {
    const table = TABLE_LAYOUT[i];
    await client.query(
      `UPDATE restaurant_tables
       SET table_number = $1, capacity = $2
       WHERE id = $3`,
      [table.table_number, table.capacity, existing.rows[i].id]
    );
  }

  for (let i = assignCount; i < TABLE_LAYOUT.length; i += 1) {
    const table = TABLE_LAYOUT[i];
    await client.query(
      `INSERT INTO restaurant_tables (table_number, capacity)
       VALUES ($1, $2)`,
      [table.table_number, table.capacity]
    );
  }

  if (existing.rows.length > TABLE_LAYOUT.length) {
    let nextTableNumber = 4;

    for (let i = TABLE_LAYOUT.length; i < existing.rows.length; i += 1) {
      await client.query(
        `UPDATE restaurant_tables
         SET table_number = $1, capacity = $2
         WHERE id = $3`,
        [`Table ${nextTableNumber}`, existing.rows[i].capacity || 4, existing.rows[i].id]
      );
      nextTableNumber += 1;
    }
  }
}

async function upsertMenu(client) {
  for (const item of MENU_SETUP) {
    const existing = await client.query(
      "SELECT id FROM menu_items WHERE LOWER(name) = LOWER($1) LIMIT 1",
      [item.name]
    );

    if (existing.rows.length > 0) {
      await client.query(
        `UPDATE menu_items
         SET category = $1, price = $2, is_available = TRUE
         WHERE id = $3`,
        [item.category, item.price, existing.rows[0].id]
      );
      continue;
    }

    await client.query(
      `INSERT INTO menu_items (name, category, price, is_available)
       VALUES ($1, $2, $3, TRUE)`,
      [item.name, item.category, item.price]
    );
  }
}

async function loadLookupMaps(client) {
  const tables = await client.query("SELECT id, table_number FROM restaurant_tables");
  const menu = await client.query("SELECT id, name, price FROM menu_items");

  const tableIdByNumber = new Map(
    tables.rows.map((row) => [row.table_number, row.id])
  );
  const menuByName = new Map(
    menu.rows.map((row) => [row.name.toLowerCase(), { id: row.id, price: Number(row.price) }])
  );

  return { tableIdByNumber, menuByName };
}

async function createShiftOrders(client, shiftDate, tableIdByNumber, menuByName) {
  let createdOrders = 0;
  let createdItems = 0;

  for (const entry of SHIFT_ORDERS) {
    const tableId = tableIdByNumber.get(entry.table);
    if (!tableId) {
      throw new Error(`Table not found in scenario: ${entry.table}`);
    }

    const createdAt = `${shiftDate} ${entry.time}`;
    const orderResult = await client.query(
      `INSERT INTO orders (table_id, staff_id, status, created_at)
       VALUES ($1, $2, 'CLOSED', $3)
       RETURNING id`,
      [tableId, entry.staff_id, createdAt]
    );

    const orderId = orderResult.rows[0].id;
    createdOrders += 1;

    for (const item of entry.items) {
      const menu = menuByName.get(item.menu.toLowerCase());
      if (!menu) {
        throw new Error(`Menu item not found in scenario: ${item.menu}`);
      }

      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time)
         VALUES ($1, $2, $3, $4)`,
        [orderId, menu.id, item.quantity, menu.price]
      );
      createdItems += 1;
    }
  }

  return { createdOrders, createdItems };
}

async function buildSalesReport(shiftDate) {
  const startTimestamp = `${shiftDate} ${SHIFT_START}`;
  const endTimestamp = `${shiftDate} ${SHIFT_END}`;

  const daily = await pool.query(
    `SELECT
       ($1::timestamp)::date::text AS date,
       COUNT(DISTINCT o.id)::int AS total_orders,
       COALESCE(SUM(oi.quantity * oi.price_at_time), 0) AS total_revenue
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.status = 'CLOSED'
       AND o.created_at >= $1
       AND o.created_at < $2`,
    [startTimestamp, endTimestamp]
  );

  const hourly = await pool.query(
    `SELECT
       TO_CHAR(DATE_TRUNC('hour', o.created_at), 'HH24:00') AS hour,
       COUNT(DISTINCT o.id)::int AS total_orders,
       COALESCE(SUM(oi.quantity * oi.price_at_time), 0) AS total_revenue
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE o.status = 'CLOSED'
       AND o.created_at >= $1
       AND o.created_at < $2
     GROUP BY DATE_TRUNC('hour', o.created_at)
     ORDER BY DATE_TRUNC('hour', o.created_at)`,
    [startTimestamp, endTimestamp]
  );

  const byStaff = await pool.query(
    `SELECT
       s.id,
       s.name,
       COUNT(DISTINCT o.id)::int AS total_orders,
       COALESCE(SUM(oi.quantity * oi.price_at_time), 0) AS total_revenue
     FROM orders o
     JOIN staff s ON s.id = o.staff_id
     JOIN order_items oi ON oi.order_id = o.id
     WHERE o.status = 'CLOSED'
       AND o.created_at >= $1
       AND o.created_at < $2
     GROUP BY s.id, s.name
     ORDER BY total_revenue DESC`,
    [startTimestamp, endTimestamp]
  );

  const topMenu = await pool.query(
    `SELECT
       m.name,
       SUM(oi.quantity)::int AS total_sold,
       COALESCE(SUM(oi.quantity * oi.price_at_time), 0) AS total_revenue
     FROM order_items oi
     JOIN menu_items m ON m.id = oi.menu_item_id
     JOIN orders o ON o.id = oi.order_id
     WHERE o.status = 'CLOSED'
       AND o.created_at >= $1
       AND o.created_at < $2
     GROUP BY m.name
     ORDER BY total_sold DESC, total_revenue DESC
     LIMIT 10`,
    [startTimestamp, endTimestamp]
  );

  return {
    daily: daily.rows[0] || { date: shiftDate, total_orders: 0, total_revenue: 0 },
    hourly: hourly.rows,
    byStaff: byStaff.rows,
    topMenu: topMenu.rows
  };
}

async function main() {
  const shiftDate = process.env.OPS_DATE || localDateString();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    await ensureCoreStaff(client, passwordHash);
    const deletedPlaceholders = await cleanupPlaceholderStaff(client);
    const staffUpsert = await upsertRealStaff(client, passwordHash);
    await normalizeTables(client);
    await upsertMenu(client);

    const { tableIdByNumber, menuByName } = await loadLookupMaps(client);
    const created = await createShiftOrders(client, shiftDate, tableIdByNumber, menuByName);

    await client.query("COMMIT");

    const report = await buildSalesReport(shiftDate);

    console.log(`\nOne-day operation scenario created for ${shiftDate} (06:00-12:00).`);
    console.log(`Placeholder staff removed: ${deletedPlaceholders}`);
    console.log(`Real staff created: ${staffUpsert.created}, updated: ${staffUpsert.updated}`);
    console.log(`Orders created: ${created.createdOrders}, order items created: ${created.createdItems}`);

    console.log("\nDaily Sales");
    console.table([report.daily]);

    console.log("Hourly Sales");
    console.table(report.hourly);

    console.log("Sales By Staff");
    console.table(report.byStaff);

    console.log("Top Menu");
    console.table(report.topMenu);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Scenario generation failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
