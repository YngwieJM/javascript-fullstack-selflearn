require("dotenv").config({ path: "./config/.env" });
const bcrypt = require("bcrypt");
const pool = require("../config/db");
const dataBank = require("./scenario.data-bank");

const DEFAULT_PASSWORD = "123456";
const SHIFT_START_HOUR = 9;
const SHIFT_END_HOUR = 23;
const PRICE_STEP = 1000;
const SHIFT_WINDOW_LABEL = `${String(SHIFT_START_HOUR).padStart(2, "0")}:00-${String(
  SHIFT_END_HOUR
).padStart(2, "0")}:00`;

const CORE_STAFF = [
  { id: 2, name: "Anna", email: "anna@test.com", role: "BARTENDER" },
  { id: 3, name: "Michael", email: "michael@test.com", role: "WAITER" },
  { id: 4, name: "Admin", email: "admin@test.com", role: "MANAGER" },
  { id: 5, name: "Jordan", email: "jordan@test.com", role: "WAITER" },
  { id: 6, name: "Lisa", email: "lisa@test.com", role: "WAITER" }
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

function createSeededRandom(seedText) {
  let seed = 0;
  const text = String(seedText);

  for (let i = 0; i < text.length; i += 1) {
    seed = ((seed * 31) + text.charCodeAt(i)) >>> 0;
  }

  if (seed === 0) {
    seed = 123456789;
  }

  return () => {
    seed = ((1664525 * seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pickOne(rng, items) {
  return items[randomInt(rng, 0, items.length - 1)];
}

function shuffle(rng, items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = randomInt(rng, 0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function uniquePick(rng, items, count) {
  return shuffle(rng, items).slice(0, count);
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function secondsToTime(seconds) {
  const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function toIdrPrice(price) {
  const rounded = Math.round(price / PRICE_STEP) * PRICE_STEP;
  return Math.max(rounded, PRICE_STEP);
}

function buildRunTag(shiftDate, rng) {
  const compactDate = shiftDate.replace(/-/g, "");
  const token = Math.floor(rng() * 1e7).toString().padStart(7, "0");
  return `${compactDate}-${token}`;
}

function generateRandomStaff(rng, runTag) {
  const generated = [];
  const usedNames = new Set();
  const usedEmails = new Set();
  const roles = ["WAITER", "BARTENDER"];

  for (const role of roles) {
    const plan = dataBank.rolePlan[role];
    const targetCount = randomInt(rng, plan.min, plan.max);

    for (let i = 0; i < targetCount; i += 1) {
      let fullName = "";
      let email = "";
      let safety = 0;

      do {
        const first = pickOne(rng, dataBank.firstNames);
        const last = pickOne(rng, dataBank.lastNames);
        fullName = `${first} ${last}`;
        const suffix = Math.floor(rng() * 1000);
        email = `scn.${runTag}.${slugify(first)}.${slugify(last)}.${suffix}@test.local`;
        safety += 1;
      } while (
        safety < 40 &&
        (usedNames.has(fullName.toLowerCase()) || usedEmails.has(email.toLowerCase()))
      );

      usedNames.add(fullName.toLowerCase());
      usedEmails.add(email.toLowerCase());
      generated.push({ name: fullName, email: email.toLowerCase(), role });
    }
  }

  return generated;
}

function buildTablePlan(rng, currentTableCount) {
  const targetCount = currentTableCount > 0 ? currentTableCount : randomInt(rng, 7, 10);
  const plan = [];

  for (const zone of dataBank.tableZones) {
    const count = randomInt(rng, zone.min, zone.max);
    for (let i = 1; i <= count; i += 1) {
      plan.push({
        table_number: `${zone.prefix} ${i}`,
        capacity: pickOne(rng, zone.capacities)
      });
    }
  }

  if (plan.length < targetCount) {
    let index = 1;
    while (plan.length < targetCount) {
      plan.push({
        table_number: `Table ${index}`,
        capacity: pickOne(rng, [2, 4, 6])
      });
      index += 1;
    }
  }

  return shuffle(rng, plan).slice(0, targetCount);
}

function generateMenuSetup(rng, runTag) {
  const minCount = 10;
  const maxCount = Math.min(16, dataBank.menuTemplates.length);
  const count = randomInt(rng, minCount, maxCount);
  const selectedTemplates = uniquePick(rng, dataBank.menuTemplates, count);

  return selectedTemplates.map((template) => {
    const prefix = pickOne(rng, dataBank.menuNamePrefixes);
    const rawPrice = randomInt(rng, template.minPrice, template.maxPrice);
    const idrPrice = toIdrPrice(rawPrice);
    return {
      name: `${prefix} ${template.name} (SCN-${runTag})`,
      category: template.category,
      price: idrPrice
    };
  });
}

function generateShiftOrderPlan(rng, tableIds, staffIds, menuRows) {
  const tx = dataBank.transactionPlan;
  const totalOrders = randomInt(rng, tx.minOrders, tx.maxOrders);
  const minSecond = SHIFT_START_HOUR * 3600;
  const maxSecond = (SHIFT_END_HOUR * 3600) - 1;

  const times = Array.from({ length: totalOrders }, () =>
    randomInt(rng, minSecond, maxSecond)
  ).sort((a, b) => a - b);

  const orders = [];

  for (const second of times) {
    const tableId = pickOne(rng, tableIds);
    const staffId = pickOne(rng, staffIds);
    const itemsCount = Math.min(
      randomInt(rng, tx.minItemsPerOrder, tx.maxItemsPerOrder),
      menuRows.length
    );
    const selectedMenu = uniquePick(rng, menuRows, itemsCount);
    const items = selectedMenu.map((menu) => ({
      menu_item_id: menu.id,
      quantity: randomInt(rng, tx.minQtyPerItem, tx.maxQtyPerItem),
      price_at_time: Number(menu.price)
    }));

    orders.push({
      second,
      table_id: tableId,
      staff_id: staffId,
      items
    });
  }

  return orders;
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

async function insertRandomStaff(client, passwordHash, randomStaff) {
  const inserted = [];

  for (const member of randomStaff) {
    const result = await client.query(
      `INSERT INTO staff (name, email, role, password)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [member.name, member.email, member.role, passwordHash]
    );
    inserted.push(result.rows[0]);
  }

  return inserted;
}

async function applyRandomTables(client, tablePlan) {
  const existing = await client.query(
    "SELECT id FROM restaurant_tables ORDER BY id"
  );

  if (existing.rows.length > 0) {
    for (const row of existing.rows) {
      await client.query(
        "UPDATE restaurant_tables SET table_number = $1 WHERE id = $2",
        [`TMP-${row.id}`, row.id]
      );
    }

    for (let i = 0; i < tablePlan.length && i < existing.rows.length; i += 1) {
      const target = tablePlan[i];
      await client.query(
        `UPDATE restaurant_tables
         SET table_number = $1, capacity = $2
         WHERE id = $3`,
        [target.table_number, target.capacity, existing.rows[i].id]
      );
    }

    return;
  }

  for (const table of tablePlan) {
    await client.query(
      `INSERT INTO restaurant_tables (table_number, capacity)
       VALUES ($1, $2)`,
      [table.table_number, table.capacity]
    );
  }
}

async function insertRandomMenu(client, menuSetup) {
  const inserted = [];

  for (const item of menuSetup) {
    const result = await client.query(
      `INSERT INTO menu_items (name, category, price, is_available)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id, name, category, price`,
      [item.name, item.category, item.price]
    );
    inserted.push(result.rows[0]);
  }

  return inserted;
}

async function createRandomShiftOrders(client, shiftDate, orderPlan) {
  let createdOrders = 0;
  let createdItems = 0;

  for (const order of orderPlan) {
    const createdAt = `${shiftDate} ${secondsToTime(order.second)}`;
    const orderResult = await client.query(
      `INSERT INTO orders (table_id, staff_id, status, created_at)
       VALUES ($1, $2, 'CLOSED', $3)
       RETURNING id`,
      [order.table_id, order.staff_id, createdAt]
    );
    const orderId = orderResult.rows[0].id;
    createdOrders += 1;

    for (const item of order.items) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time)
         VALUES ($1, $2, $3, $4)`,
        [orderId, item.menu_item_id, item.quantity, item.price_at_time]
      );
      createdItems += 1;
    }
  }

  return { createdOrders, createdItems };
}

async function buildSalesReport(shiftDate) {
  const startTimestamp = `${shiftDate} ${String(SHIFT_START_HOUR).padStart(2, "0")}:00:00`;
  const endTimestamp = `${shiftDate} ${String(SHIFT_END_HOUR).padStart(2, "0")}:00:00`;

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
  assertDateInput(shiftDate);

  const seedInput = process.env.OPS_SEED || `${Date.now()}-${Math.random()}`;
  const rng = createSeededRandom(seedInput);
  const runTag = process.env.OPS_RUN_TAG || buildRunTag(shiftDate, rng);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    await ensureCoreStaff(client, passwordHash);
    const deletedPlaceholders = await cleanupPlaceholderStaff(client);

    const randomStaffPayload = generateRandomStaff(rng, runTag);
    const insertedStaff = await insertRandomStaff(client, passwordHash, randomStaffPayload);

    const currentTables = await client.query("SELECT id FROM restaurant_tables");
    const tablePlan = buildTablePlan(rng, currentTables.rows.length);
    await applyRandomTables(client, tablePlan);
    const availableTables = await client.query(
      "SELECT id, table_number, capacity FROM restaurant_tables ORDER BY id"
    );

    const randomMenuPayload = generateMenuSetup(rng, runTag);
    const insertedMenu = await insertRandomMenu(client, randomMenuPayload);

    const waiterIds = CORE_STAFF
      .filter((member) => member.role === "WAITER")
      .map((member) => member.id)
      .concat(
        insertedStaff
          .filter((member) => member.role === "WAITER")
          .map((member) => member.id)
      );

    const tableIds = availableTables.rows.map((row) => row.id);
    const orderPlan = generateShiftOrderPlan(rng, tableIds, waiterIds, insertedMenu);
    const created = await createRandomShiftOrders(client, shiftDate, orderPlan);

    await client.query("COMMIT");

    const report = await buildSalesReport(shiftDate);

    console.log(`\nOne-day random operation scenario created for ${shiftDate} (${SHIFT_WINDOW_LABEL}).`);
    console.log(`Run tag: ${runTag}`);
    console.log(`Seed: ${seedInput}`);
    console.log(`Placeholder staff removed: ${deletedPlaceholders}`);
    console.log(`Random staff inserted: ${insertedStaff.length}`);
    console.log(`Random menu inserted: ${insertedMenu.length}`);
    console.log(`Orders created: ${created.createdOrders}, order items created: ${created.createdItems}`);

    console.log("\nGenerated Staff");
    console.table(insertedStaff);

    console.log("Generated Menu");
    console.table(
      insertedMenu.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.price
      }))
    );

    console.log("Tables In Use");
    console.table(availableTables.rows);

    console.log("Daily Sales");
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
