CREATE OR REPLACE FUNCTION claim_queue_batch(batch_size INT)
RETURNS SETOF ingestion_queue AS $$
  UPDATE ingestion_queue
  SET status = 'processing', updated_at = NOW()
  WHERE id IN (
    SELECT id
    FROM ingestion_queue
    WHERE status = 'pending'
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT batch_size
  )
  RETURNING *;
$$ LANGUAGE sql VOLATILE;
