-- Sync Helper Functions
-- This adds functions to help track and manage data synchronization

-- Function to get the latest entry date from journal_entries
CREATE OR REPLACE FUNCTION get_latest_entry_date()
RETURNS DATE AS $$
BEGIN
  RETURN (
    SELECT MAX(date) 
    FROM journal_entries 
    WHERE date IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get sync status information
CREATE OR REPLACE FUNCTION get_sync_status()
RETURNS TABLE(
  latest_date DATE,
  total_entries BIGINT,
  last_updated TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    MAX(date) as latest_date,
    COUNT(*) as total_entries,
    MAX(created_at) as last_updated
  FROM journal_entries;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if an entry already exists (for deduplication)
CREATE OR REPLACE FUNCTION entry_exists(p_date DATE)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 
    FROM journal_entries 
    WHERE date = p_date
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 