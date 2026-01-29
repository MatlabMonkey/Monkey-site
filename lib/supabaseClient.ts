import { createClient } from "@supabase/supabase-js";

// Single Supabase client for the project. Uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'your-secret-api-key-here';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.error('Create a .env.local file in the project root with these variables.');
}

// Create client - API key header is optional (only needed if RLS policies check for it)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    // Only add API key header if it's set and not the default
    // Remove this if your RLS policies don't check for x-api-key
    ...(apiKey && apiKey !== 'your-secret-api-key-here' ? {
      global: {
        headers: {
          'x-api-key': apiKey,
        },
      },
    } : {}),
  }
);
