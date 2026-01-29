-- Simple RLS fix for todos - NO API key required
-- Run this in Supabase SQL Editor

-- Drop ALL existing policies on todos (clean slate)
DROP POLICY IF EXISTS "Allow all operations on todos" ON todos;
DROP POLICY IF EXISTS "Allow anonymous read on todos" ON todos;
DROP POLICY IF EXISTS "Allow anonymous insert on todos" ON todos;
DROP POLICY IF EXISTS "Allow anonymous update on todos" ON todos;
DROP POLICY IF EXISTS "Allow anonymous delete on todos" ON todos;
DROP POLICY IF EXISTS "Secure todos access" ON todos;

-- Create a simple policy that allows ALL operations without checking API key
CREATE POLICY "Allow all operations on todos" ON todos
    FOR ALL USING (true);

-- Verify the policy was created
SELECT * FROM pg_policies WHERE tablename = 'todos';
