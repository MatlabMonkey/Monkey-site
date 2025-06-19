export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-white bg-black">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">SITEARIAS</h1>
        <p className="text-gray-400">A hub for all my personal data and projects.</p>
        <a
          href="/dashboard"
          className="inline-block mt-4 px-6 py-2 bg-white text-black rounded hover:bg-gray-200"
        >
          Dashboard
        </a>
        <a
          href="/about"
          className="inline-block mt-2 px-4 py-1 text-sm text-gray-400 underline hover:text-white"
        >
          About
        </a>

      </div>
    </main>
  );
}