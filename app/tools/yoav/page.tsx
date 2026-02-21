import Link from "next/link"
import { ArrowLeft, GraduationCap, MapPin, Star, Users, Heart } from "lucide-react"

export default function YoavPage() {
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
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-yellow-400/40 bg-yellow-900/30 text-4xl">
              🐐
            </div>
            <div>
              <h1 className="text-3xl font-bold md:text-4xl">Yoav Gillath</h1>
              <p className="mt-1 text-slate-400">Certified GOAT · Man Who Knows Everyone</p>
              <div className="mt-2 flex items-center gap-2 text-sm text-slate-400">
                <MapPin className="h-3.5 w-3.5" />
                New York, NY
              </div>
            </div>
          </div>
        </header>

        {/* Official Credentials */}
        <section className="mt-5 rounded-3xl border border-yellow-800/30 bg-yellow-950/20 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Star className="h-5 w-5 text-yellow-300" />
            <h2 className="text-xl font-semibold">Official Credentials</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { label: "GOAT Status", value: "Confirmed" },
              { label: "People Known", value: "Everyone" },
              { label: "Exceptions", value: "None" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-center">
                <p className="text-sm text-slate-400">{stat.label}</p>
                <p className="mt-1 text-lg font-semibold text-yellow-300">{stat.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Education */}
        <section className="mt-5 rounded-3xl border border-slate-700/70 bg-slate-900/60 p-6">
          <div className="flex items-center gap-3 mb-4">
            <GraduationCap className="h-5 w-5 text-amber-300" />
            <h2 className="text-xl font-semibold">Education</h2>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
            <p className="font-semibold text-white">University of Southern California</p>
            <p className="text-slate-400 text-sm mt-1">Fight On — fellow Trojan</p>
          </div>
        </section>

        {/* Network */}
        <section className="mt-5 rounded-3xl border border-slate-700/70 bg-slate-900/60 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Users className="h-5 w-5 text-blue-300" />
            <h2 className="text-xl font-semibold">The Network</h2>
          </div>
          <p className="text-slate-300 leading-relaxed">
            Yoav operates with a social graph that defies conventional understanding. 
            Need to know someone? Yoav already does. Need an introduction? Consider it done. 
            Researchers have been unable to find a single person on Earth that Yoav does not, 
            in some capacity, already know. Studies ongoing.
          </p>
        </section>

        {/* Personal Life */}
        <section className="mt-5 rounded-3xl border border-pink-800/30 bg-pink-950/20 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Heart className="h-5 w-5 text-pink-300" />
            <h2 className="text-xl font-semibold">Personal Life</h2>
          </div>
          <p className="text-slate-300">
            Happily married to <span className="text-white font-semibold">Olivia</span> — 
            widely considered the power couple of the New York social scene. 
            Between the two of them, they probably know the entire city.
          </p>
        </section>

        <footer className="mt-8 text-center text-xs text-slate-600">
          Page commissioned by Zach. Yoav almost certainly already knows everyone who will read this.
        </footer>
      </div>
    </main>
  )
}
