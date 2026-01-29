// Simple script to verify connection and provide SQL to run
// Run with: node scripts/setup-database-simple.js

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

console.log('🔍 Checking environment variables...\n');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL not found in .env.local');
  process.exit(1);
}

if (!anonKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY not found in .env.local');
  process.exit(1);
}

console.log('✅ Environment variables found');
console.log(`   URL: ${supabaseUrl}\n`);

// Read the migration file
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_initial_schema.sql');

if (!fs.existsSync(migrationPath)) {
  console.error('❌ Migration file not found:', migrationPath);
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, 'utf8');

console.log('📋 SQL to run in Supabase SQL Editor:\n');
console.log('─'.repeat(60));
console.log(sql);
console.log('─'.repeat(60));

console.log('\n📝 Instructions:');
console.log('1. Go to: https://supabase.com/dashboard');
console.log('2. Select your project');
console.log('3. Click "SQL Editor" in the left sidebar');
console.log('4. Click "New query"');
console.log('5. Copy the SQL above and paste it');
console.log('6. Click "Run" (or press Ctrl+Enter)\n');

console.log('✅ After running, verify tables exist:');
console.log('   - Go to "Table Editor" → you should see "todos" and "journal_entries" tables\n');
