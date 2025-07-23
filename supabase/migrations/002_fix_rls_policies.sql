-- Fix RLS policies to allow frontend access
-- This migration updates the policies to allow anonymous users to read data

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all operations on journal_entries" ON journal_entries;
DROP POLICY IF EXISTS "Allow all operations on todos" ON todos;

-- Create new policies that allow anonymous access
CREATE POLICY "Allow anonymous read on journal_entries" ON journal_entries
    FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert on journal_entries" ON journal_entries
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous update on journal_entries" ON journal_entries
    FOR UPDATE USING (true);

CREATE POLICY "Allow anonymous delete on journal_entries" ON journal_entries
    FOR DELETE USING (true);

-- Todo policies
CREATE POLICY "Allow anonymous read on todos" ON todos
    FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert on todos" ON todos
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous update on todos" ON todos
    FOR UPDATE USING (true);

CREATE POLICY "Allow anonymous delete on todos" ON todos
    FOR DELETE USING (true); 