import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("No DATABASE_URL found.");
    return;
  }
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log("Applying db changes...");

    await client.query(`
      ALTER TABLE opportunities
      ADD COLUMN IF NOT EXISTS ingested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    `);

    console.log("Added ingested_at");

    await client.query(`
      UPDATE opportunities
      SET ingested_at = created_at
      WHERE ingested_at IS NULL OR ingested_at = created_at;
    `);

    console.log("Backfilled ingested_at");

    await client.query(`
      ALTER TABLE opportunities
      ALTER COLUMN posted_at DROP DEFAULT;
    `);

    console.log("Dropped default from posted_at");

    console.log("DB changes applied successfully!");
  } catch (err) {
    console.error("Error applying db changes:", err);
  } finally {
    await client.end();
  }
}
run();
