-- 1. BACKUP TABLE
CREATE TABLE IF NOT EXISTS opportunities_backup_1781203127153 AS SELECT * FROM opportunities;

-- 2. DELETE NON-UNSTOP RECORDS
DELETE FROM opportunities WHERE apply_url NOT LIKE '%unstop.com%';

-- 3. FIX SOURCE TYPE FOR REMAINING RECORDS
UPDATE opportunities SET source_type = 'Unstop' WHERE apply_url LIKE '%unstop.com%';

-- 4. CLEANUP ORPHANED RECORDS
DELETE FROM application_tracker WHERE opportunity_id NOT IN (SELECT id FROM opportunities);
DELETE FROM bookmarks WHERE opportunity_id NOT IN (SELECT id FROM opportunities);
DELETE FROM recently_viewed WHERE opportunity_id NOT IN (SELECT id FROM opportunities);
DELETE FROM reports WHERE opportunity_id NOT IN (SELECT id FROM opportunities);
DELETE FROM opportunity_tags WHERE opportunity_id NOT IN (SELECT id FROM opportunities);
