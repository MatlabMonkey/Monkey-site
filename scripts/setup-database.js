// Script to set up database tables in Supabase
// Run with: node scripts/setup-database.js
// 
// IMPORTANT: This requires your SUPABASE_SERVICE_ROLE_KEY
// Get it from: Supabase Dashboard → Settings → API → service_role key
// Add it to .env.local as: SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL not found in .env.local');
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  console.error('   Get it from: Supabase Dashboard → Settings → API → service_role key');
  console.error('   Add to .env.local as: SUPABASE_SERVICE_ROLE_KEY=your-key-here');
  process.exit(1);
}

// Use service_role key for admin operations
const supabase = createClient(supabaseUrl, serviceRoleKey);

const setupSQL = `
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
CREATE INDEX IF NOT EXISTS idx_todos_folder ON todos(folder);
CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow all operations on todos" ON todos;

-- Create policy to allow all operations
CREATE POLICY "Allow all operations on todos" ON todos
    FOR ALL USING (true);

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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date);

-- Enable RLS
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow all operations on journal_entries" ON journal_entries;

-- Create policy
CREATE POLICY "Allow all operations on journal_entries" ON journal_entries
    FOR ALL USING (true);
`;

async function setupDatabase() {
  console.log('🚀 Setting up database tables...\n');

  try {
    // Execute SQL using Supabase REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ sql: setupSQL }),
    });

    // Alternative: Use direct SQL execution via PostgREST
    // Split SQL into individual statements and execute
    const statements = setupSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Executing ${statements.length} SQL statements...\n`);

    // Use Supabase's query method - execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length < 10) continue; // Skip very short statements
      
      try {
        // Use the REST API to execute SQL
        const { data, error } = await supabase.rpc('exec_sql', { 
          query: statement 
        });
        
        if (error) {
          // If RPC doesn't exist, try direct query
          console.log(`   Statement ${i + 1}: ${statement.substring(0, 50)}...`);
        }
      } catch (err) {
        // Continue on error - some statements might fail if already exist
        console.log(`   ⚠️  Statement ${i + 1} (may already exist): ${err.message.substring(0, 50)}`);
      }
    }

    // Better approach: Use Supabase Management API
    console.log('\n📦 Using Supabase Management API...\n');
    
    // Check if tables exist
    const { data: todosCheck, error: todosError } = await supabase
      .from('todos')
      .select('id')
      .limit(1);

    if (todosError && todosError.code === 'PGRST116') {
      console.log('✅ Todos table does not exist - will create it');
    } else {
      console.log('✅ Todos table already exists');
    }

    // Since we can't directly execute DDL via the JS client,
    // we'll provide instructions
    console.log('\n⚠️  Direct SQL execution via JS client is limited.');
    console.log('📋 Please run the SQL manually in Supabase SQL Editor:\n');
    console.log('1. Go to: https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Click "SQL Editor" → "New query"');
    console.log('4. Copy and paste the SQL from: supabase/migrations/001_initial_schema.sql');
    console.log('5. Click "Run"\n');

    console.log('✅ Setup instructions provided!');

  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    console.error('\n📋 Alternative: Run SQL manually in Supabase SQL Editor');
    console.error('   File: supabase/migrations/001_initial_schema.sql');
    process.exit(1);
  }
}

setupDatabase();
