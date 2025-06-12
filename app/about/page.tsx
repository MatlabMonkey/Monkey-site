export default function About() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-white bg-black">
      <div className="text-center max-w-xl space-y-4">
        <h1 className="text-4xl font-bold">About This Site</h1>
        <p className="text-gray-400">
          This is my personal digital dashboard. It helps me track health, habits, finances,
          productivity, and anything else I care about — all in one place.
        </p>
        <p className="text-gray-400">
          Built with Next.js, Tailwind, and Supabase. Hosted on Vercel.
        </p>
      </div>
    </main>
  );
}
