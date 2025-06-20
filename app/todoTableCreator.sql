-- Create todos table for the inbox system
CREATE TABLE IF NOT EXISTS todos (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  folder VARCHAR(50) DEFAULT 'inbox',
  priority INTEGER DEFAULT 0
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_todos_folder ON todos(folder);
CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);

-- Insert some sample todos
INSERT INTO todos (content, folder) VALUES 
('Review quarterly goals', 'inbox'),
('Plan weekend hiking trip', 'inbox'),
('Update personal website', 'inbox')
ON CONFLICT DO NOTHING;
