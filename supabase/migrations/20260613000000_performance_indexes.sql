-- Add missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_tracker_opportunity_id ON application_tracker(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_opportunity_id ON bookmarks(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_recently_viewed_user_id ON recently_viewed(user_id);
CREATE INDEX IF NOT EXISTS idx_recently_viewed_opportunity_id ON recently_viewed(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_recently_viewed_viewed_at ON recently_viewed(viewed_at DESC);
