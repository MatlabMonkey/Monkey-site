"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabaseClient"

export default function TestSupabase() {
  const [status, setStatus] = useState<string>("Testing connection...")
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>({})

  useEffect(() => {
    async function testConnection() {
      try {
        // Test basic connection
        setStatus("Testing Supabase connection...")
        
        // Check if environment variables are set
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          setError("Environment variables not set. Please check your .env.local file.")
          return
        }

        // Test querying the journal_entries table
        setStatus("Querying journal_entries table...")
        const { data, error } = await supabase.from("journal_entries").select("*").limit(5)

        if (error) {
          setError(`Database error: ${error.message}`)
          setDebugInfo({
            code: error.code,
            details: error.details,
            hint: error.hint
          })
          return
        }

        setData(data)
        setStatus(`Connection successful! Found ${data?.length || 0} entries.`)
      } catch (err) {
        setError(`Connection failed: ${err}`)
      }
    }

    testConnection()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Supabase Connection Test</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Status</h2>
          <p className="text-gray-700">{status}</p>
          
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-semibold text-red-800">Error:</h3>
              <p className="text-red-700">{error}</p>
              {debugInfo && Object.keys(debugInfo).length > 0 && (
                <div className="mt-2">
                  <h4 className="font-semibold text-red-800">Debug Info:</h4>
                  <pre className="text-xs bg-red-100 p-2 rounded overflow-auto">
                    {JSON.stringify(debugInfo, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {data && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Sample Data</h2>
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4 text-blue-800">Environment Variables</h2>
          <div className="space-y-2 text-sm">
            <p><strong>NEXT_PUBLIC_SUPABASE_URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Set" : "❌ Not set"}</p>
            <p><strong>NEXT_PUBLIC_SUPABASE_ANON_KEY:</strong> {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✅ Set" : "❌ Not set"}</p>
            <p><strong>NEXT_PUBLIC_API_KEY:</strong> {process.env.NEXT_PUBLIC_API_KEY ? "✅ Set" : "❌ Not set"}</p>
            {process.env.NEXT_PUBLIC_API_KEY && (
              <p><strong>API Key (first 10 chars):</strong> {process.env.NEXT_PUBLIC_API_KEY.substring(0, 10)}...</p>
            )}
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4 text-yellow-800">Troubleshooting Steps</h2>
          <div className="space-y-2 text-sm">
            <p>1. Check that your API key is set in <code>.env.local</code></p>
            <p>2. Verify the migration was applied to your database</p>
            <p>3. Check that the API key in the migration matches your environment variable</p>
            <p>4. Restart your development server after changing environment variables</p>
          </div>
        </div>
      </div>
    </div>
  )
} 