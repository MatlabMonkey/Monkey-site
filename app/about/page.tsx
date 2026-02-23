export default function About() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-[rgb(var(--text))] bg-[rgb(var(--bg))]">
      <div className="text-center max-w-xl space-y-4">
        <h1 className="text-4xl font-bold">About This Site</h1>
        <p className="text-[rgb(var(--text-muted))]">
          Yo whats up welcome to my website I really dont have anything for you here maybe will add some shi
        </p>
        <p className="text-[rgb(var(--text-muted))]">
          Built with Next.js, Tailwind, and Supabase. Hosted on Vercel.
        </p>
      </div>
    </main>
  );
}
