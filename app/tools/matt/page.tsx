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

        <section className="mt-6 rounded-3xl border border-cyan-800/40 bg-cyan-950/30 p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-700/50 bg-cyan-900/40 px-3 py-1 text-xs uppercase tracking-widest text-cyan-300 mb-4">
            Appendix A — Remedial Program
          </div>
          <h2 className="text-2xl font-semibold text-cyan-200">How To Find Diamonds (For Matt)</h2>
          <p className="mt-2 text-slate-400 text-sm">Simplified for field use. Please read all steps before entering any cave.</p>
          <ol className="mt-5 space-y-4">
            {[
              { step: "1", title: "Go down", body: "Diamonds spawn between Y-levels -58 and 16. Press F3 to see your coordinates. The number next to \"Y\" is your depth. You want it to say around -58. This is not the same as digging sideways for 45 minutes at Y=64." },
              { step: "2", title: "Bring the right tools", body: "You need an iron or diamond pickaxe. A wooden pickaxe will break the diamond ore and give you nothing. Yes, this has happened. More than once. Bring at least 3 pickaxes." },
              { step: "3", title: "Do NOT mine straight down", body: "You will fall into lava. This is not a suggestion. The lava is always there. It is waiting for you specifically, Matt." },
              { step: "4", title: "Strip mine or branch mine", body: "At Y=-58, dig a long straight tunnel. Every 3 blocks, dig a tunnel to the left and right. This exposes the most surface area. Do NOT just spin in circles hoping a diamond appears." },
              { step: "5", title: "When you find diamonds, STOP", body: "Check for lava below before mining. Place a torch. Make sure you know where you are. Do NOT immediately sprint toward them and fall in a hole. Take a breath. You've got this." },
              { step: "6", title: "Use Fortune III if possible", body: "A pickaxe enchanted with Fortune III can turn 1 diamond ore into up to 4 diamonds. This requires an enchanting table, which requires bookshelves, which requires leather. Yes, you have to farm cows first. No, you cannot skip this step." },
            ].map(({ step, title, body }) => (
              <li key={step} className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-800/60 border border-cyan-700/50 flex items-center justify-center text-cyan-300 font-bold text-sm">{step}</span>
                <div>
                  <p className="font-semibold text-white">{title}</p>
                  <p className="mt-1 text-slate-300 text-sm leading-relaxed">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-xs text-slate-500 italic">Success rate after following this guide: statistically non-zero. We believe in you, Matt.</p>
        </section>

        <footer className="mt-8 rounded-2xl border border-slate-700/70 bg-slate-900/70 p-5 text-sm text-slate-400">
          This report was commissioned by Zach and peer-reviewed by Matt himself, who could not figure out how to open
          the PDF.
        </footer>
      </div>
    </main>
  )
}
