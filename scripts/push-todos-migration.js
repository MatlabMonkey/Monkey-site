#!/usr/bin/env node

/**
 * Simple script to push the todos migration to Supabase
 * 
 * Usage:
 *   npm run db:push-todos
 * 
 * Or manually:
 *   node scripts/push-todos-migration.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Pushing todos migration to Supabase...\n');

// Check if Supabase CLI is available
try {
  execSync('npx supabase --version', { stdio: 'ignore' });
} catch (error) {
  console.error('❌ Supabase CLI not found. Installing...');
  console.log('   Run: npm install -g supabase');
  console.log('   Or use: npx supabase db push\n');
  process.exit(1);
}

// Check if migration file exists
const migrationFile = path.join(__dirname, '../supabase/migrations/001_create_todos.sql');
if (!fs.existsSync(migrationFile)) {
  console.error('❌ Migration file not found:', migrationFile);
  process.exit(1);
}

try {
  console.log('📤 Pushing migration...');
  // Use echo to auto-confirm the prompt
  execSync('echo Y | npx supabase db push', { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    shell: true
  });
  console.log('\n✅ Migration pushed successfully!');
  console.log('\n💡 If you see errors about project linking, run:');
  console.log('   npx supabase link --project-ref YOUR_PROJECT_REF');
} catch (error) {
  console.error('\n❌ Failed to push migration');
  console.error('\n💡 Alternative: Copy the SQL from supabase/migrations/001_create_todos.sql');
  console.error('   and run it manually in the Supabase SQL Editor');
  process.exit(1);
}
