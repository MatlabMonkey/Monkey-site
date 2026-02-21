import Link from "next/link"
import { ArrowLeft, GraduationCap, Briefcase, Wrench, Star, MapPin } from "lucide-react"

export default function AvaLandonPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href="/tools"
          className="inline-flex items-center gap-2 text-slate-300 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tools
        </Link>

        {/* Header */}
        <header className="mt-8 rounded-3xl border border-slate-700/70 bg-slate-900/70 p-8">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-amber-400/40 bg-amber-900/30 text-4xl">
              👱‍♀️
            </div>
            <div>
              <h1 className="text-3xl font-bold md:text-4xl">Ava Landon</h1>
              <p className="mt-1 text-slate-400">Mechanical Engineer</p>
              <div className="mt-2 flex items-center gap-2 text-sm text-slate-400">
                <MapPin className="h-3.5 w-3.5" />
                Los Angeles, CA
              </div>
            </div>
          </div>
        </header>

        {/* Education */}
        <section className="mt-5 rounded-3xl border border-slate-700/70 bg-slate-900/60 p-6">
          <div className="flex items-center gap-3 mb-4">
            <GraduationCap className="h-5 w-5 text-amber-300" />
            <h2 className="text-xl font-semibold">Education</h2>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
            <p className="font-semibold text-white">University of Southern California</p>
            <p className="text-slate-300 text-sm mt-1">B.S. Mechanical Engineering</p>
            <p className="text-slate-400 text-sm mt-1">Class of 2025</p>
          </div>
        </section>

        {/* Experience */}
        <section className="mt-5 rounded-3xl border border-slate-700/70 bg-slate-900/60 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Briefcase className="h-5 w-5 text-blue-300" />
            <h2 className="text-xl font-semibold">Experience</h2>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-white">Boeing</p>
                <p className="text-slate-300 text-sm mt-1">Mechanical Engineer</p>
              </div>
              <span className="text-xs text-slate-400 mt-1">2025 — Present</span>
            </div>
            <p className="mt-3 text-sm text-slate-400">Details coming soon.</p>
          </div>
        </section>

        {/* Skills */}
        <section className="mt-5 rounded-3xl border border-slate-700/70 bg-slate-900/60 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Wrench className="h-5 w-5 text-purple-300" />
            <h2 className="text-xl font-semibold">Skills</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {["Mechanical Engineering", "CAD/CAM", "FEA Analysis", "Aerospace Systems", "SolidWorks", "MATLAB"].map((skill) => (
              <span key={skill} className="rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-sm text-slate-300">
                {skill}
              </span>
            ))}
          </div>
        </section>

        {/* Fun Facts */}
        <section className="mt-5 rounded-3xl border border-amber-800/30 bg-amber-950/20 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Star className="h-5 w-5 text-amber-300" />
            <h2 className="text-xl font-semibold">Important Facts</h2>
          </div>
          <ul className="space-y-2 text-slate-300 text-sm">
            <li className="flex items-center gap-2">🌮 Devoted Taco Bell connoisseur — this is non-negotiable</li>
            <li className="flex items-center gap-2">✈️ Helps build planes at one of the most iconic aerospace companies in the world</li>
            <li className="flex items-center gap-2">🎓 USC Trojan — Fight On</li>
          </ul>
        </section>

        <footer className="mt-8 text-center text-xs text-slate-600">
          Page commissioned by a friend. Ava has not reviewed this and probably should.
        </footer>
      </div>
    </main>
  )
}
