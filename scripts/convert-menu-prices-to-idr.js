require("dotenv").config({ path: "./config/.env" });
const pool = require("../config/db");

const PRICE_MAP_IDR = new Map([
  ["espresso", 30000],
  ["cappuccino", 35000],
  ["iced tea", 18000],
  ["mojito", 28000],
  ["burger", 75000],
  ["chicken steak", 95000],
  ["caesar salad", 55000],
  ["pasta carbonara", 85000],
  ["chocolate cake", 45000],
  ["tiramisu", 48000],
  ["beer", 35000],
  ["pizza", 120000]
]);

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const menuResult = await client.query(
      "SELECT id, name, price FROM menu_items ORDER BY id"
    );

    const changes = [];

    for (const item of menuResult.rows) {
      const currentPrice = toNumber(item.price);
      if (currentPrice == null) continue;

      const mappedPrice = PRICE_MAP_IDR.get(String(item.name).toLowerCase());
      const nextPrice = mappedPrice || (currentPrice < 1000 ? Math.round(currentPrice * 1000) : currentPrice);

      if (Number(nextPrice) === Number(currentPrice)) continue;

      await client.query("UPDATE menu_items SET price = $1 WHERE id = $2", [
        nextPrice,
        item.id
      ]);

      changes.push({
        id: item.id,
        name: item.name,
        from: currentPrice,
        to: nextPrice
      });
    }

    await client.query("COMMIT");

    if (changes.length === 0) {
      console.log("No menu prices needed conversion. Prices are already in IDR scale.");
      return;
    }

    console.log(`Updated ${changes.length} menu item price(s) to IDR.`);
    console.table(changes);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Price conversion failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
