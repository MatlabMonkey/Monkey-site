"use client"

import Link from "next/link"
import { ArrowRight, BarChart3, Calendar, TrendingUp, CheckSquare, Plus } from "lucide-react"
import { useEffect, useState } from "react"

// Daily nature photo system
function getDailyPhotoSeed() {
  const today = new Date()
  const dateString = today.toISOString().split("T")[0] // YYYY-MM-DD format
  return dateString
}

const naturePhotos = [
  { id: 1, location: "Yosemite National Park, California", description: "Misty mountain peaks at sunrise" },
  { id: 2, location: "Banff National Park, Canada", description: "Turquoise lake surrounded by mountains" },
  { id: 3, location: "Torres del Paine, Chile", description: "Dramatic granite peaks and glacial lakes" },
  { id: 4, location: "Lofoten Islands, Norway", description: "Northern lights over fjords" },
  { id: 5, location: "Milford Sound, New Zealand", description: "Pristine fjord with waterfalls" },
  { id: 6, location: "Antelope Canyon, Arizona", description: "Sculpted sandstone slot canyon" },
  { id: 7, location: "Mount Fuji, Japan", description: "Cherry blossoms with iconic mountain" },
  { id: 8, location: "Patagonia, Argentina", description: "Jagged peaks and pristine wilderness" },
  { id: 9, location: "Dolomites, Italy", description: "Alpine meadows and limestone cliffs" },
  { id: 10, location: "Faroe Islands", description: "Dramatic cliffs and grass-roof houses" },
]

function getDailyPhoto() {
  const seed = getDailyPhotoSeed()
  const hash = seed.split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0)
    return a & a
  }, 0)
  const index = Math.abs(hash) % naturePhotos.length
  return naturePhotos[index]
}

export default function Home() {
  const [dailyPhoto, setDailyPhoto] = useState(getDailyPhoto())
  const [imageLoaded, setImageLoaded] = useState(false)

  useEffect(() => {
    setDailyPhoto(getDailyPhoto())
  }, [])

  const backgroundPattern =
    "data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%239C92AC' fillOpacity='0.05'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E"

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Dynamic Nature Background */}
      <div className="absolute inset-0">
        <img
          src={`https://source.unsplash.com/1920x1080/?nature,landscape,${dailyPhoto.id}`}
          alt={dailyPhoto.description}
          className={`w-full h-full object-cover transition-opacity duration-1000 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setImageLoaded(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-purple-900/70 to-slate-900/80"></div>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url("${backgroundPattern}")` }}></div>
      </div>

      <div className="relative flex items-center justify-center min-h-screen p-6">
        <div className="text-center space-y-8 max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 text-white/80 text-sm font-medium">
              <Calendar className="w-4 h-4" />
              Personal Life Dashboard
            </div>

            <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent leading-tight">
              Welcome to ZT
              <span className="block text-4xl md:text-6xl mt-2">Dashboard</span>
            </h1>

            <p className="text-xl md:text-2xl text-white/70 max-w-2xl mx-auto leading-relaxed">
              Visualize your journey, track your habits, manage your tasks, and reflect on your daily life with
              beautiful insights.
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-4 gap-6 mt-12">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300">
              <BarChart3 className="w-8 h-8 text-purple-300 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Analytics</h3>
              <p className="text-white/70 text-sm">Track mood, productivity, and habits with interactive charts</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300">
              <TrendingUp className="w-8 h-8 text-blue-300 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Progress</h3>
              <p className="text-white/70 text-sm">Monitor your goals and celebrate achievements</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300">
              <CheckSquare className="w-8 h-8 text-green-300 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Tasks</h3>
              <p className="text-white/70 text-sm">Manage your todos with lightning-fast inbox system</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300">
              <Calendar className="w-8 h-8 text-orange-300 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Reflection</h3>
              <p className="text-white/70 text-sm">Daily highlights, gratitude, and thoughts</p>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-12">
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl font-semibold text-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              Open Dashboard
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/todos"
              className="group inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl font-semibold text-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <CheckSquare className="w-5 h-5" />
              Todo Inbox
              <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
            </Link>
          </div>

          {/* Daily Photo Credit */}
          <div className="mt-16 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-black/20 backdrop-blur-sm rounded-full border border-white/10 text-white/60 text-sm">
              <Calendar className="w-4 h-4" />
              Today's view: {dailyPhoto.location}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
