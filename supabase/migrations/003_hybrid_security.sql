-- Hybrid Security Implementation
-- This implements multiple security layers for your private journal data

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all operations on journal_entries" ON journal_entries;
DROP POLICY IF EXISTS "Allow all operations on todos" ON todos;
DROP POLICY IF EXISTS "Allow anonymous read on journal_entries" ON journal_entries;
DROP POLICY IF EXISTS "Allow anonymous insert on journal_entries" ON journal_entries;
DROP POLICY IF EXISTS "Allow anonymous update on journal_entries" ON journal_entries;
DROP POLICY IF EXISTS "Allow anonymous delete on journal_entries" ON journal_entries;
DROP POLICY IF EXISTS "Allow anonymous read on todos" ON todos;
DROP POLICY IF EXISTS "Allow anonymous insert on todos" ON todos;
DROP POLICY IF EXISTS "Allow anonymous update on todos" ON todos;
DROP POLICY IF EXISTS "Allow anonymous delete on todos" ON todos;

-- Create secure policies for journal_entries
-- Only allow access with the correct API key
CREATE POLICY "Secure journal_entries access" ON journal_entries
    FOR ALL USING (
        current_setting('request.headers')::json->>'x-api-key' = 'sk-289257434fd03a7719554d2afcbebd9c4b5eab39b78c11120683c66d1fd1461c'
    );

-- Create secure policies for todos
-- Only allow access with the correct API key
CREATE POLICY "Secure todos access" ON todos
    FOR ALL USING (
        current_setting('request.headers')::json->>'x-api-key' = 'sk-289257434fd03a7719554d2afcbebd9c4b5eab39b78c11120683c66d1fd1461c'
    ); 