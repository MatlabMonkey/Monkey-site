import Link from "next/link"
import { ArrowLeft, FileText } from "lucide-react"

const stats = [
  { label: "Creeper deaths", value: "847" },
  { label: "Times punched a tree for 20 minutes", value: "203" },
  { label: "Dirt houses built", value: "12" },
  { label: "Diamonds found", value: "0" },
  { label: "Times lost in his own mine", value: "94" },
  { label: "Beds placed in the Nether", value: "3 (all exploded)" },
]

const patterns = [
  "Insists every cave is \"definitely where diamonds are\" before immediately falling into lava.",
  "Carries 47 seeds at all times but forgets to bring food.",
  "Sprints at Endermen while making direct eye contact and then files formal complaints.",
  "Calls every redstone mechanism \"basically impossible\" after placing one torch.",
]

export default function MattReportPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href="/tools"
          className="inline-flex items-center gap-2 text-slate-300 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tools
        </Link>

        <header className="mt-6 rounded-3xl border border-slate-700/70 bg-slate-900/70 p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/70 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
            <FileText className="h-3.5 w-3.5" />
            Official Research Dossier
          </div>
          <h1 className="mt-4 text-3xl font-bold md:text-5xl">The Matt Dembiak Minecraft Incident Report</h1>
          <p className="mt-3 text-lg text-slate-300">A Peer-Reviewed Analysis</p>
        </header>

        <section className="mt-6 rounded-3xl border border-slate-700/70 bg-slate-900/60 p-6">
          <h2 className="text-2xl font-semibold">Executive Statistics</h2>
          <p className="mt-2 text-slate-400">
            Compiled over many sessions and at least one completely avoidable inventory wipe.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {stats.map((stat) => (
              <article key={stat.label} className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
                <p className="text-sm text-slate-400">{stat.label}</p>
                <p className="mt-1 text-xl font-semibold text-rose-300">{stat.value}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-700/70 bg-slate-900/60 p-6">
          <h2 className="text-2xl font-semibold">The Incident of 2023</h2>
          <p className="mt-3 leading-relaxed text-slate-300">
            At approximately 8:14 PM, Matt declared he had \"full situational awareness\" and walked backward into a
            ravine while reading chat. Recovery efforts were hindered by the fact that his respawn point was, for
            reasons still under investigation, inside a decorative hole behind his own base.
          </p>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-700/70 bg-slate-900/60 p-6">
          <h2 className="text-2xl font-semibold">Known Behavioral Patterns</h2>
          <ul className="mt-4 space-y-3 text-slate-300">
            {patterns.map((pattern) => (
              <li key={pattern} className="rounded-xl border border-slate-700/70 bg-slate-800/60 p-3">
                {pattern}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-700/70 bg-slate-900/60 p-6">
          <h2 className="text-2xl font-semibold">Expert Testimony</h2>
          <blockquote className="mt-4 border-l-4 border-amber-500 pl-4 text-slate-200">
            \"In 17 years of studying block-based decision making, I have never documented this level of confidence
            paired with this level of immediate catastrophe.\"
          </blockquote>
          <p className="mt-3 text-sm text-slate-400">
            Professor Edith Cobblestone, Department of Applied Crafting, National Institute of Square Sciences
          </p>
        </section>

        <footer className="mt-8 rounded-2xl border border-slate-700/70 bg-slate-900/70 p-5 text-sm text-slate-400">
          This report was commissioned by Zach and peer-reviewed by Matt himself, who could not figure out how to open
          the PDF.
        </footer>
      </div>
    </main>
  )
}
