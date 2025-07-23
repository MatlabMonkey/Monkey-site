-- Fix sync helper functions to work with actual table structure
-- The table doesn't have created_at/updated_at columns, so we need to adjust the functions

-- Drop the existing functions
DROP FUNCTION IF EXISTS get_sync_status();

-- Recreate the function without created_at/updated_at references
CREATE OR REPLACE FUNCTION get_sync_status()
RETURNS TABLE(
  latest_date DATE,
  total_entries BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    MAX(date) as latest_date,
    COUNT(*) as total_entries
  FROM journal_entries;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 