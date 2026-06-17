import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// We cannot use standard postgrest to run DDL (ALTER TABLE). 
// But Supabase provides a Postgres connection string usually or we can use the SQL editor if this is a remote DB.
// Wait, is there a local db connection string? Let's check .env.local.
