// Script to push database migrations to Supabase using CLI
// Run with: npm run db:push
// 
// First, link your project:
// 1. Get your project reference ID from Supabase Dashboard → Settings → General
// 2. Run: npx supabase link --project-ref your-project-ref

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Pushing database migrations to Supabase...\n');

// Check if Supabase CLI is available
try {
  execSync('npx supabase --version', { stdio: 'ignore' });
} catch (error) {
  console.error('❌ Supabase CLI not found. Installing...\n');
  try {
    execSync('npm install supabase --save-dev', { stdio: 'inherit' });
  } catch (installError) {
    console.error('❌ Failed to install Supabase CLI');
    console.error('   Please run: npm install supabase --save-dev');
    process.exit(1);
  }
}

// Check if project is linked
try {
  const configPath = path.join(__dirname, '..', 'supabase', 'config.toml');
  if (!fs.existsSync(configPath)) {
    console.error('❌ Supabase config not found. Please run:');
    console.error('   npx supabase init');
    process.exit(1);
  }
  
  // Try to check if linked
  try {
    execSync('npx supabase projects list', { stdio: 'ignore' });
  } catch (e) {
    console.log('⚠️  Project may not be linked. Linking required:\n');
    console.log('1. Get your project reference ID:');
    console.log('   Supabase Dashboard → Settings → General → Reference ID\n');
    console.log('2. Run:');
    console.log('   npx supabase link --project-ref YOUR_PROJECT_REF\n');
    console.log('3. Then run this script again\n');
    process.exit(1);
  }
  
  console.log('✅ Supabase CLI ready\n');
  console.log('📦 Pushing migrations...\n');
  console.log('⚠️  Note: This will push ALL migrations including journal_entries');
  console.log('   If you only want todos, use: npm run db:setup-todos\n');
  
  // Push migrations
  execSync('npx supabase db push', { stdio: 'inherit' });
  
  console.log('\n✅ Migrations pushed successfully!');
  
} catch (error) {
  console.error('\n❌ Error pushing migrations:', error.message);
  console.error('\n📋 Alternative: Run SQL manually in Supabase SQL Editor');
  console.error('   File: supabase/migrations/001_initial_schema.sql\n');
  process.exit(1);
}
