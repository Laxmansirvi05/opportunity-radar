-- 1. Check Table
SELECT table_name FROM information_schema.tables WHERE table_name = 'ingestion_queue';

-- 2. Check Indexes
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'ingestion_queue';

-- 3. Check Trigger
SELECT trigger_name, event_manipulation, event_object_table FROM information_schema.triggers WHERE event_object_table = 'ingestion_queue';

-- 4. Check Constraint (Unique)
SELECT constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_name = 'ingestion_queue';
