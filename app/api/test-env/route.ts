import { NextResponse } from "next/server"

export async function GET() {
  // Server-side can access all env vars
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const apiKey = process.env.NEXT_PUBLIC_API_KEY
  const unsplashKey = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY

  return NextResponse.json({
    serverSide: {
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? "✓ Found" : "✗ Not found",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseKey ? `✓ Found (${supabaseKey.length} chars)` : "✗ Not found",
      NEXT_PUBLIC_API_KEY: apiKey ? (apiKey === 'your-secret-api-key-here' ? '⚠️ Default placeholder' : '✓ Custom value') : "⚠ Not set",
      NEXT_PUBLIC_UNSPLASH_ACCESS_KEY: unsplashKey ? (unsplashKey === 'your-unsplash-key' ? '⚠️ Default placeholder' : '✓ Custom value') : "⚠ Not set",
    },
    note: "Server-side API routes can access all environment variables",
  })
}
