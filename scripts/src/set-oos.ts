import { pool } from "@workspace/db";

const AVAILABLE = ['blue-pea-flower', 'hibiscus-tea', 'dr-tea-gold-ctc'];

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      UPDATE products
      SET variants = (
        SELECT jsonb_agg(v || '{"stock": 0}'::jsonb)
        FROM jsonb_array_elements(variants::jsonb) AS v
      )
      WHERE slug != ALL($1::text[])
    `, [AVAILABLE]);
    console.log(`Set ${res.rowCount} products to out-of-stock.`);
  } finally {
    client.release();
    await pool.end();
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
