-- Seed data for personal website
-- This adds sample data to test the dashboard and todo functionality

-- Insert sample journal entries
INSERT INTO journal_entries (date, how_good, productivity, drinks, rose, gratitude, thought_of_day, booleans) VALUES
('2024-01-15', 8.5, 7.0, 2, 'Had a great workout today', 'Grateful for good health', 'Focus on consistency', ARRAY['Push', 'Read ten pages']),
('2024-01-16', 7.0, 8.5, 1, 'Beautiful sunset walk', 'Thankful for nature', 'Small steps lead to big changes', ARRAY['Pull', 'Guitar']),
('2024-01-17', 9.0, 6.5, 0, 'Productive coding session', 'Grateful for learning opportunities', 'Progress over perfection', ARRAY['Legs', 'Watch sunset']),
('2024-01-18', 8.0, 7.5, 1, 'Great conversation with friends', 'Thankful for relationships', 'Connection is key', ARRAY['Core', 'Read ten pages']),
('2024-01-19', 7.5, 8.0, 0, 'Completed a challenging project', 'Grateful for persistence', 'Hard work pays off', ARRAY['Cardio', 'Guitar']),
('2024-01-20', 9.5, 9.0, 1, 'Amazing day at the beach', 'Thankful for beautiful weather', 'Nature is healing', ARRAY['Surfing', 'Watch sunset']),
('2024-01-21', 8.0, 7.0, 2, 'Learned something new today', 'Grateful for curiosity', 'Never stop learning', ARRAY['Full body', 'Read ten pages']);

-- Insert sample todos
INSERT INTO todos (content, folder) VALUES
('Set up Supabase connection', 'inbox'),
('Fix dashboard data loading', 'inbox'),
('Test todo functionality', 'inbox'),
('Update Google Apps Script', 'inbox'),
('Deploy to production', 'inbox'),
('Add authentication', 'inbox'); 