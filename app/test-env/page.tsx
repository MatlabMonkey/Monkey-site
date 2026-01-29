"use client"

export default function TestEnvPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const apiKey = process.env.NEXT_PUBLIC_API_KEY
  const unsplashKey = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Environment Variables Test</h1>
        
        <div className="space-y-4">
          <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">NEXT_PUBLIC_SUPABASE_URL</h2>
            <p className="text-gray-300">
              {supabaseUrl ? (
                <>
                  <span className="text-green-400">✓ Found</span>
                  <br />
                  <span className="text-sm text-gray-400">
                    {supabaseUrl.substring(0, 30)}...
                  </span>
                </>
              ) : (
                <span className="text-red-400">✗ Not found</span>
              )}
            </p>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">NEXT_PUBLIC_SUPABASE_ANON_KEY</h2>
            <p className="text-gray-300">
              {supabaseKey ? (
                <>
                  <span className="text-green-400">✓ Found</span>
                  <br />
                  <span className="text-sm text-gray-400">
                    {supabaseKey.substring(0, 20)}... ({supabaseKey.length} chars)
                  </span>
                </>
              ) : (
                <span className="text-red-400">✗ Not found</span>
              )}
            </p>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">NEXT_PUBLIC_API_KEY</h2>
            <p className="text-gray-300">
              {apiKey ? (
                <>
                  <span className="text-green-400">✓ Found</span>
                  <br />
                  <span className="text-sm text-gray-400">
                    {apiKey === 'your-secret-api-key-here' ? '⚠️ Default placeholder value' : 'Custom value set'}
                  </span>
                </>
              ) : (
                <span className="text-yellow-400">⚠ Not set (optional)</span>
              )}
            </p>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">NEXT_PUBLIC_UNSPLASH_ACCESS_KEY</h2>
            <p className="text-gray-300">
              {unsplashKey ? (
                <>
                  <span className="text-green-400">✓ Found</span>
                  <br />
                  <span className="text-sm text-gray-400">
                    {unsplashKey === 'your-unsplash-key' ? '⚠️ Default placeholder value' : 'Custom value set'}
                  </span>
                </>
              ) : (
                <span className="text-yellow-400">⚠ Not set (optional)</span>
              )}
            </p>
          </div>
        </div>

        <div className="mt-8 bg-blue-900/30 border border-blue-700 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Note:</h3>
          <p className="text-sm text-gray-300">
            Client-side components can only access variables prefixed with <code className="bg-gray-800 px-1 rounded">NEXT_PUBLIC_</code>.
            <br />
            Server-side code (API routes) can access all environment variables.
          </p>
        </div>
      </div>
    </div>
  )
}
