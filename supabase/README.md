# Supabase Database Schema

This directory contains the database schema and migrations for your personal website.

## Files

- `migrations/001_initial_schema.sql` - Creates the required tables
- `seed.sql` - Sample data for testing
- `config.toml` - Supabase project configuration

## How to Apply Schema Changes

### Option 1: Via Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `migrations/001_initial_schema.sql`
4. Run the script
5. Copy and paste the contents of `seed.sql` to add sample data

### Option 2: Via Supabase CLI (if working)
```bash
npx supabase db push
```

## Tables

### journal_entries
Stores your daily journal data for the dashboard:
- `date` - The journal entry date
- `how_good` - Quality of life rating (1-10)
- `productivity` - Productivity rating (1-10)
- `drinks` - Number of drinks consumed
- `scount` - Discretionary count
- `rose` - Daily highlight
- `gratitude` - Gratitude entry
- `thought_of_day` - Daily thought
- `booleans` - Array of completed habits/activities

### todos
Stores your todo items:
- `content` - Todo text
- `completed` - Completion status
- `folder` - Todo category (default: 'inbox')

## Making Changes

When you need to modify the database schema:
1. Edit the migration files in `migrations/`
2. Apply the changes via Supabase dashboard or CLI
3. Update the seed data if needed

## Current Status

✅ Tables created and accessible
✅ Sample data loaded
✅ Dashboard can read data
✅ Todo system functional 