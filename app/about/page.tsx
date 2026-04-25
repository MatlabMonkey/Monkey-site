export default function About() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-[rgb(var(--text))] bg-[rgb(var(--bg))]">
      <div className="max-w-2xl w-full rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] p-8 md:p-10 space-y-5">
        <h1 className="text-4xl font-bold">About</h1>
        <p className="text-[rgb(var(--text-muted))] leading-relaxed">
          Monkey-site is a personal command center for planning, execution, journaling, and operations.
          It is designed to keep day-to-day work cohesive across Telegram, GitHub, and the dashboard surfaces.
        </p>
        <p className="text-[rgb(var(--text-muted))] leading-relaxed">
          Core sections include Journal, Todos, Workspace, Tools, Ops, and Reports. The architecture is being
          actively streamlined so each section has a clear purpose and minimal overlap.
        </p>
        <p className="text-[rgb(var(--text-muted))] text-sm">
          Built with Next.js, TypeScript, Tailwind, and Supabase.
        </p>
      </div>
    </main>
  )
}
