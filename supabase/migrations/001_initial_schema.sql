-- Initial schema for personal website
-- This creates the required tables for the dashboard and todo functionality
-- Based on the actual Google Apps Script data structure

-- Create journal_entries table for dashboard data
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE,
    date DATE NOT NULL,
    how_good NUMERIC(3,1),
    productivity NUMERIC(3,1),
    drinks INTEGER DEFAULT 0,
    plot NUMERIC(3,1),
    scount INTEGER DEFAULT 0,
    summary TEXT,
    reflection TEXT,
    rose TEXT,
    bud TEXT,
    thorn TEXT,
    proud_of TEXT,
    gratitude TEXT,
    met_person TEXT,
    thought_of_day TEXT,
    raok TEXT,
    goals TEXT,
    booleans TEXT[] DEFAULT '{}',
    deep_work_hours NUMERIC(3,1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create todos table for todo functionality
CREATE TABLE IF NOT EXISTS todos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    folder TEXT DEFAULT 'inbox',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_timestamp ON journal_entries(timestamp);
CREATE INDEX IF NOT EXISTS idx_todos_folder ON todos(folder);
CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (you can restrict these later)
CREATE POLICY "Allow all operations on journal_entries" ON journal_entries
    FOR ALL USING (true);

CREATE POLICY "Allow all operations on todos" ON todos
    FOR ALL USING (true); 