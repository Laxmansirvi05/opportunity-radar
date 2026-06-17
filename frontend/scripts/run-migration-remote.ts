import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runMigration() {
  const sql = `
    -- Add ingested_at column
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    
    -- Backfill ingested_at with created_at for historical records
    UPDATE opportunities SET ingested_at = created_at;
    
    -- Make posted_at nullable and remove DEFAULT NOW()
    ALTER TABLE opportunities ALTER COLUMN posted_at DROP DEFAULT;
    ALTER TABLE opportunities ALTER COLUMN posted_at DROP NOT NULL;
  `;

  // We can't run raw SQL easily via JS client unless there is an RPC, 
  // but wait, is there a psql connection string? 
  // We can just use the Postgres URI if it's available, but we only have SUPABASE_URL.
}

runMigration().catch(console.error);
