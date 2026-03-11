require("dotenv").config({ path: "./config/.env" });
const bcrypt = require("bcrypt");
const pool = require("../config/db");

const DEFAULT_PASSWORD = process.env.INITIAL_PASSWORD || "123456";

const BASE_STAFF = [
  { name: "Admin", email: "admin@test.com", role: "MANAGER" },
  { name: "Anna", email: "anna@test.com", role: "BARTENDER" },
  { name: "Michael", email: "michael@test.com", role: "WAITER" }
];

const BASE_TABLES = [
  { table_number: "VIP 1", capacity: 6 },
  { table_number: "Terrace 1", capacity: 4 },
  { table_number: "Table 1", capacity: 4 },
  { table_number: "Table 2", capacity: 2 }
];

const BASE_MENU = [
  { name: "Espresso", category: "DRINK", price: 30000 },
  { name: "Iced Tea", category: "DRINK", price: 18000 },
  { name: "Mojito", category: "DRINK", price: 28000 },
  { name: "Burger", category: "FOOD", price: 75000 },
  { name: "Pasta Carbonara", category: "FOOD", price: 85000 },
  { name: "Chocolate Cake", category: "DESSERT", price: 45000 }
];

const TRUNCATE_CANDIDATES = [
  "order_items",
  "orders",
  "password_reset_tokens",
  "menu_items",
  "restaurant_tables",
  "staff"
];

const REQUIRED_TABLES = ["staff", "restaurant_tables", "menu_items", "orders", "order_items"];

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

async function getExistingTables(client, tableNames) {
  const result = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])`,
    [tableNames]
  );

  return new Set(result.rows.map((row) => row.table_name));
}

function assertRequiredTables(existingSet) {
  const missing = REQUIRED_TABLES.filter((table) => !existingSet.has(table));
  if (missing.length > 0) {
    throw new Error(`Missing required tables: ${missing.join(", ")}`);
  }
}

function assertSafeEnvironment() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_RESET !== "true") {
    throw new Error("Refusing to reset DB in production (set ALLOW_PROD_RESET=true to override)");
  }
}

async function resetSequencesToMax(client) {
  const statements = [
    ["staff", "staff_id_seq"],
    ["restaurant_tables", "restaurant_tables_id_seq"],
    ["menu_items", "menu_items_id_seq"],
    ["orders", "orders_id_seq"],
    ["order_items", "order_items_id_seq"]
  ];

  for (const [tableName, seqName] of statements) {
    await client.query(
      `SELECT setval($1::regclass, COALESCE((SELECT MAX(id) FROM ${quoteIdentifier(
        tableName
      )}), 0) + 1, false)`,
      [seqName]
    );
  }
}

async function main() {
  assertSafeEnvironment();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await getExistingTables(client, TRUNCATE_CANDIDATES);
    assertRequiredTables(existing);

    const tablesToTruncate = TRUNCATE_CANDIDATES.filter((table) => existing.has(table));
    const truncateSql = `TRUNCATE TABLE ${tablesToTruncate
      .map((table) => quoteIdentifier(table))
      .join(", ")} RESTART IDENTITY CASCADE`;
    await client.query(truncateSql);

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    const staffRows = [];
    for (const staff of BASE_STAFF) {
      const result = await client.query(
        `INSERT INTO staff (name, email, role, password)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email, role`,
        [staff.name, staff.email.toLowerCase(), staff.role, passwordHash]
      );
      staffRows.push(result.rows[0]);
    }

    const tableRows = [];
    for (const table of BASE_TABLES) {
      const result = await client.query(
        `INSERT INTO restaurant_tables (table_number, capacity)
         VALUES ($1, $2)
         RETURNING id, table_number, capacity`,
        [table.table_number, table.capacity]
      );
      tableRows.push(result.rows[0]);
    }

    const menuRows = [];
    for (const menu of BASE_MENU) {
      const result = await client.query(
        `INSERT INTO menu_items (name, category, price, is_available)
         VALUES ($1, $2, $3, TRUE)
         RETURNING id, name, category, price, is_available`,
        [menu.name, menu.category, menu.price]
      );
      menuRows.push(result.rows[0]);
    }

    await resetSequencesToMax(client);
    await client.query("COMMIT");

    console.log("Database reset complete with minimal initial data.");
    console.log(`Default password for seeded staff: ${DEFAULT_PASSWORD}`);

    console.log("\nSeeded Staff");
    console.table(staffRows);

    console.log("Seeded Tables");
    console.table(tableRows);

    console.log("Seeded Menu");
    console.table(menuRows);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Reset failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
