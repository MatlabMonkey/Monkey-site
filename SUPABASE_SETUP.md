# Supabase Setup Guide

To get your dashboard working, you need to configure your Supabase connection.

## Step 1: Create Environment Variables

Create a `.env.local` file in your project root with the following content:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

## Step 2: Get Your Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to Settings > API
3. Copy your Project URL and paste it as the value for `NEXT_PUBLIC_SUPABASE_URL`
4. Copy your anon/public key and paste it as the value for `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Step 3: Database Schema

Make sure your Supabase database has a table called `journal_entries` with the following columns:

- `id` (uuid, primary key)
- `date` (date)
- `how_good` (numeric)
- `productivity` (numeric)
- `drinks` (numeric)
- `scount` (numeric)
- `rose` (text)
- `gratitude` (text)
- `thought_of_day` (text)
- `booleans` (text array)

## Step 4: Test the Connection

After setting up the environment variables, restart your development server:

```bash
npm run dev
```

The dashboard should now be able to fetch data from your Supabase database.

## Troubleshooting

If you're still having issues:
1. Check that your Supabase project is active
2. Verify that the `journal_entries` table exists and has data
3. Ensure your RLS (Row Level Security) policies allow read access
4. Check the browser console for any error messages 