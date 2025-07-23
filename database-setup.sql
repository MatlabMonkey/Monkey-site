-- Database Setup for Personal Website
-- Run this in your Supabase SQL Editor

-- Create journal_entries table for dashboard data
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    how_good NUMERIC(3,1),
    productivity NUMERIC(3,1),
    drinks INTEGER DEFAULT 0,
    scount INTEGER DEFAULT 0,
    rose TEXT,
    gratitude TEXT,
    thought_of_day TEXT,
    booleans TEXT[] DEFAULT '{}',
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

-- Insert some sample data for testing (optional)
INSERT INTO journal_entries (date, how_good, productivity, drinks, rose, gratitude, thought_of_day, booleans) VALUES
('2024-01-15', 8.5, 7.0, 2, 'Had a great workout today', 'Grateful for good health', 'Focus on consistency', ARRAY['Push', 'Read ten pages']),
('2024-01-16', 7.0, 8.5, 1, 'Beautiful sunset walk', 'Thankful for nature', 'Small steps lead to big changes', ARRAY['Pull', 'Guitar']),
('2024-01-17', 9.0, 6.5, 0, 'Productive coding session', 'Grateful for learning opportunities', 'Progress over perfection', ARRAY['Legs', 'Watch sunset']);

INSERT INTO todos (content, folder) VALUES
('Set up Supabase connection', 'inbox'),
('Fix dashboard data loading', 'inbox'),
('Test todo functionality', 'inbox'); 