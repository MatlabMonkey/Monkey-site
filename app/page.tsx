"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { BookOpen, CheckSquare, Wrench, Activity, MessageCircle, BriefcaseBusiness, Lock, Unlock, SquarePen } from "lucide-react"
import { useEffect, useState } from "react"

// Daily nature photo system with dynamic Unsplash API
const UNSPLASH_ACCESS_KEY = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY

function getDailyPhotoSeed() {
  const today = new Date()
  const dateString = today.toISOString().split("T")[0] // YYYY-MM-DD format
  return dateString
}

const naturePhotos = [
  { 
    id: 1, 
    location: "Yosemite National Park, California", 
    description: "Misty mountain peaks at sunrise",
    searchTerms: ["yosemite national park", "mountain peaks", "california mountains"]
  },
  { 
    id: 2, 
    location: "Banff National Park, Canada", 
    description: "Turquoise lake surrounded by mountains",
    searchTerms: ["banff national park", "lake louise", "canadian rockies"]
  },
  { 
    id: 3, 
    location: "Torres del Paine, Chile", 
    description: "Dramatic granite peaks and glacial lakes",
    searchTerms: ["torres del paine", "patagonia chile", "granite peaks"]
  },
  { 
    id: 4, 
    location: "Lofoten Islands, Norway", 
    description: "Northern lights over fjords",
    searchTerms: ["lofoten islands", "northern lights", "norway fjords"]
  },
  { 
    id: 5, 
    location: "Milford Sound, New Zealand", 
    description: "Pristine fjord with waterfalls",
    searchTerms: ["milford sound", "new zealand fjord", "waterfalls"]
  },
  { 
    id: 6, 
    location: "Antelope Canyon, Arizona", 
    description: "Sculpted sandstone slot canyon",
    searchTerms: ["antelope canyon", "slot canyon", "arizona desert"]
  },
  { 
    id: 7, 
    location: "Mount Fuji, Japan", 
    description: "Cherry blossoms with iconic mountain",
    searchTerms: ["mount fuji", "cherry blossoms", "japan mountain"]
  },
  { 
    id: 8, 
    location: "Patagonia, Argentina", 
    description: "Jagged peaks and pristine wilderness",
    searchTerms: ["patagonia argentina", "andes mountains", "wilderness"]
  },
  { 
    id: 9, 
    location: "Dolomites, Italy", 
    description: "Alpine meadows and limestone cliffs",
    searchTerms: ["dolomites", "italian alps", "limestone cliffs"]
  },
  { 
    id: 10, 
    location: "Faroe Islands", 
    description: "Dramatic cliffs and grass-roof houses",
    searchTerms: ["faroe islands", "grass roof houses", "dramatic cliffs"]
  },
  { 
    id: 11, 
    location: "Swiss Alps, Switzerland", 
    description: "Snow-capped peaks and alpine meadows",
    searchTerms: ["swiss alps", "alpine meadows", "switzerland mountains"]
  },
  { 
    id: 12, 
    location: "Iceland Highlands", 
    description: "Volcanic landscapes and geothermal wonders",
    searchTerms: ["iceland highlands", "volcanic landscape", "geothermal"]
  },
  { 
    id: 13, 
    location: "Maldives Atolls", 
    description: "Crystal clear turquoise waters and white sand",
    searchTerms: ["maldives", "turquoise water", "white sand beach"]
  },
  { 
    id: 14, 
    location: "Santorini, Greece", 
    description: "White-washed buildings and Aegean Sea",
    searchTerms: ["santorini", "white buildings", "aegean sea"]
  },
  { 
    id: 15, 
    location: "Machu Picchu, Peru", 
    description: "Ancient Incan citadel in the Andes",
    searchTerms: ["machu picchu", "incan ruins", "andes mountains"]
  },
  { 
    id: 16, 
    location: "Grand Canyon, Arizona", 
    description: "Vast red rock formations and deep gorges",
    searchTerms: ["grand canyon", "red rock", "arizona canyon"]
  },
  { 
    id: 17, 
    location: "Yellowstone National Park, Wyoming", 
    description: "Geysers, hot springs, and wildlife",
    searchTerms: ["yellowstone", "geysers", "hot springs"]
  },
  { 
    id: 18, 
    location: "Great Barrier Reef, Australia", 
    description: "Coral reefs and tropical marine life",
    searchTerms: ["great barrier reef", "coral reef", "tropical fish"]
  },
  { 
    id: 19, 
    location: "Serengeti Plains, Tanzania", 
    description: "African savanna and wildlife migration",
    searchTerms: ["serengeti", "african savanna", "wildlife migration"]
  },
  { 
    id: 20, 
    location: "Himalayas, Nepal", 
    description: "World's highest peaks and mountain villages",
    searchTerms: ["himalayas", "nepal mountains", "mountain villages"]
  },
  { 
    id: 21, 
    location: "Amalfi Coast, Italy", 
    description: "Dramatic cliffs and Mediterranean charm",
    searchTerms: ["amalfi coast", "mediterranean", "italian coastline"]
  },
  { 
    id: 22, 
    location: "Galapagos Islands, Ecuador", 
    description: "Unique wildlife and volcanic landscapes",
    searchTerms: ["galapagos islands", "volcanic landscape", "marine iguana"]
  },
  { 
    id: 23, 
    location: "Canadian Rockies, Alberta", 
    description: "Jagged peaks and pristine lakes",
    searchTerms: ["canadian rockies", "alberta mountains", "pristine lakes"]
  },
  { 
    id: 24, 
    location: "Namib Desert, Namibia", 
    description: "Red sand dunes and desert wildlife",
    searchTerms: ["namib desert", "red sand dunes", "desert wildlife"]
  },
  { 
    id: 25, 
    location: "Bali, Indonesia", 
    description: "Tropical rainforests and rice terraces",
    searchTerms: ["bali", "rice terraces", "tropical rainforest"]
  },
  { 
    id: 26, 
    location: "Scottish Highlands", 
    description: "Misty glens and ancient castles",
    searchTerms: ["scottish highlands", "misty glens", "ancient castles"]
  },
  { 
    id: 27, 
    location: "Amazon Rainforest, Brazil", 
    description: "Lush jungle and diverse wildlife",
    searchTerms: ["amazon rainforest", "jungle", "tropical wildlife"]
  },
  { 
    id: 28, 
    location: "Alaska Wilderness", 
    description: "Glaciers, fjords, and northern lights",
    searchTerms: ["alaska wilderness", "glaciers", "northern lights"]
  },
  { 
    id: 29, 
    location: "Morocco Sahara", 
    description: "Golden sand dunes and desert camps",
    searchTerms: ["morocco sahara", "golden sand dunes", "desert camps"]
  },
  { 
    id: 30, 
    location: "New Zealand Fiordland", 
    description: "Pristine wilderness and dramatic fjords",
    searchTerms: ["new zealand fiordland", "dramatic fjords", "wilderness"]
  },
  { 
    id: 31, 
    location: "Abel Tasman National Park, New Zealand", 
    description: "Golden beaches and coastal walking tracks",
    searchTerms: ["abel tasman", "golden beaches", "coastal walking"]
  },
  { 
    id: 32, 
    location: "Volcán de Fuego, Guatemala", 
    description: "Active volcano with lava flows and ash plumes",
    searchTerms: ["volcan de fuego", "guatemala volcano", "lava flows"]
  },
  { 
    id: 33, 
    location: "Piha Beach, New Zealand", 
    description: "Black sand beach with dramatic surf",
    searchTerms: ["piha beach", "black sand", "dramatic surf"]
  },
  { 
    id: 34, 
    location: "Komodo Island, Indonesia", 
    description: "Dragon habitat and pristine coral reefs",
    searchTerms: ["komodo island", "komodo dragon", "coral reefs"]
  },
  { 
    id: 35, 
    location: "Fraser Island, Australia", 
    description: "World's largest sand island with rainforest",
    searchTerms: ["fraser island", "sand island", "rainforest"]
  },
  { 
    id: 36, 
    location: "Whitsunday Islands, Australia", 
    description: "Whitehaven Beach and turquoise waters",
    searchTerms: ["whitsunday islands", "whitehaven beach", "turquoise water"]
  },
  { 
    id: 37, 
    location: "Joshua Tree National Park, California", 
    description: "Desert landscape with unique Joshua trees",
    searchTerms: ["joshua tree", "desert landscape", "california desert"]
  },
  { 
    id: 38, 
    location: "Sierra Nevada, California", 
    description: "Alpine lakes and granite peaks",
    searchTerms: ["sierra nevada", "alpine lakes", "granite peaks"]
  },
  { 
    id: 39, 
    location: "Big Sur, California", 
    description: "Dramatic coastline and redwood forests",
    searchTerms: ["big sur", "california coastline", "redwood forests"]
  },
  { 
    id: 40, 
    location: "Coromandel Peninsula, New Zealand", 
    description: "Hot Water Beach and Cathedral Cove",
    searchTerms: ["coromandel peninsula", "hot water beach", "cathedral cove"]
  },
  { 
    id: 41, 
    location: "Cape Reinga, New Zealand", 
    description: "Northernmost point where oceans meet",
    searchTerms: ["cape reinga", "northernmost point", "ocean meeting"]
  },
  { 
    id: 42, 
    location: "Prague, Czech Republic", 
    description: "Medieval architecture and Charles Bridge",
    searchTerms: ["prague", "charles bridge", "medieval architecture"]
  },
  { 
    id: 43, 
    location: "Mount Shasta, California", 
    description: "Volcanic peak and alpine wilderness",
    searchTerms: ["mount shasta", "volcanic peak", "alpine wilderness"]
  },
  { 
    id: 44, 
    location: "Zion National Park, Utah", 
    description: "Red rock canyons and narrow slot canyons",
    searchTerms: ["zion national park", "red rock canyons", "slot canyons"]
  },
]

// Function to fetch image from Unsplash API
async function fetchUnsplashImage(searchTerms: string[]) {
  try {
    // Check if API key is available
    if (!UNSPLASH_ACCESS_KEY) {
      console.warn('Unsplash API key not found, using fallback image')
      return {
        url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop&crop=center&auto=format&q=80',
        alt: 'Mountain landscape',
        photographer: 'Unsplash',
        unsplashLink: 'https://unsplash.com'
      }
    }

    const query = searchTerms.join(' ')
    const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape`
    const response = await fetch(url, {
      headers: { 'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}` }
    })
    
    if (!response.ok) {
      // Silently fail if API key is invalid - use fallback image
      if (response.status === 401) {
        console.warn('Unsplash API key invalid or expired. Using fallback image.')
        return {
          url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop&crop=center&auto=format&q=80',
          alt: 'Mountain landscape',
          photographer: 'Unsplash',
          unsplashLink: 'https://unsplash.com'
        }
      }
      const errorText = await response.text()
      console.warn('Unsplash API error:', errorText)
      // Return fallback instead of throwing
      return {
        url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop&crop=center&auto=format&q=80',
        alt: 'Mountain landscape',
        photographer: 'Unsplash',
        unsplashLink: 'https://unsplash.com'
      }
    }
    
    const data = await response.json()
    
    // Trigger download event for Unsplash compliance
    fetch(`https://api.unsplash.com/photos/${data.id}/download`, {
      method: 'GET',
      headers: {
        'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
      }
    }).catch(console.error) // Don't block on download tracking
    
    return {
      url: data.urls.regular,
      alt: data.alt_description || 'Nature landscape',
      photographer: data.user?.name || 'Unknown',
      unsplashLink: data.links.html
    }
  } catch (error) {
    // Silently handle errors - use fallback image
    console.warn('Error fetching Unsplash image:', error instanceof Error ? error.message : 'Unknown error')
    return {
      url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop&crop=center&auto=format&q=80',
      alt: 'Mountain landscape',
      photographer: 'Unsplash',
      unsplashLink: 'https://unsplash.com'
    }
  }
}

function getDailyPhoto() {
  const seed = getDailyPhotoSeed()
  const hash = seed.split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0)
    return a & a
  }, 0)
  const index = Math.abs(hash) % naturePhotos.length
  return naturePhotos[index]
}

const quotes = [
  // Albert Camus
  "You will never be happy if you continue to search for what happiness consists of. You will never live if you are looking for the meaning of life.",
  "To create is to live twice.",
  "Live to the point of tears.",
  "One must imagine Sisyphus happy.",
  // Friedrich Nietzsche
  "What does not kill me makes me stronger.",
  "He who has a why to live can bear almost any how.",
  "The secret for harvesting from existence the greatest fruitfulness and greatest enjoyment is—to live dangerously!",
  // Søren Kierkegaard
  "The unhappy man is always absent from himself, never present to himself.",
  "Life can only be understood backwards; but it must be lived forwards.",
  // Simone de Beauvoir
  "Change your life today. Don’t gamble on the future, act now, without delay.",
  // Arthur Schopenhauer
  "A man can do what he wants, but not want what he wants.",
  // Marcus Aurelius
  "Very little is needed to make a happy life; it is all within yourself, in your way of thinking.",
  // Epicurus
  "Do not spoil what you have by desiring what you have not; remember that what you now have was once among the things you only hoped for.",
  // My Friend Nikhil
  "I will be there no matter what",
  // No author
  "Start"
];

function getDailyQuoteIndex() {
  // Use days since a fixed date (e.g., Jan 1, 2024)
  const start = new Date('2024-01-01T00:00:00Z')
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return diffDays % quotes.length
}

export default function Home() {
  const searchParams = useSearchParams()
  const [dailyPhoto, setDailyPhoto] = useState(getDailyPhoto())
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageData, setImageData] = useState<{
    url: string
    alt: string
    photographer: string
    unsplashLink: string
  } | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showPinInput, setShowPinInput] = useState(false)
  const [pin, setPin] = useState("")
  const [pinError, setPinError] = useState("")
  const quoteIndex = getDailyQuoteIndex()
  const authRequired = searchParams.get("auth") === "required"
  const blockedPath = searchParams.get("from")

  const checkAuthStatus = async () => {
    try {
      const response = await fetch("/api/auth/status", { cache: "no-store" })
      const data = (await response.json()) as { authenticated?: boolean }
      setIsAuthenticated(response.ok && Boolean(data.authenticated))
    } catch {
      setIsAuthenticated(false)
    }
  }

  useEffect(() => {
    void checkAuthStatus()
  }, [])

  useEffect(() => {
    if (authRequired && !isAuthenticated) {
      setShowPinInput(true)
    }
  }, [authRequired, isAuthenticated])

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPinError("")

    try {
      const response = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      })
      const data = (await response.json().catch(() => ({}))) as { authenticated?: boolean; error?: string }

      if (response.ok && data.authenticated) {
        setIsAuthenticated(true)
        setShowPinInput(false)
        setPin("")
        return
      }

      setPinError(data.error || "Incorrect PIN")
      setPin("")
    } catch {
      setPinError("Unable to sign in right now")
      setPin("")
    }
  }

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      setIsAuthenticated(false)
      setShowPinInput(false)
      setPin("")
      setPinError("")
    }
  }

  useEffect(() => {
    let cancelled = false
    const photo = getDailyPhoto()
    setDailyPhoto(photo)
    if (photo.searchTerms) {
      fetchUnsplashImage(photo.searchTerms).then((data) => {
        if (!cancelled) setImageData(data)
      })
    }
    return () => { cancelled = true }
  }, [])

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Corner Auth Widget */}
      <div className="absolute top-4 right-4 z-50">
        {isAuthenticated ? (
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3 py-2 bg-[rgb(var(--surface)_/_0.7)] backdrop-blur-sm rounded-xl border border-[rgb(var(--border))] text-[rgb(var(--text)_/_0.7)] hover:bg-[rgb(var(--surface-2)_/_0.8)] transition-all text-sm"
          >
            <Unlock className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        ) : showPinInput ? (
          <form onSubmit={handlePinSubmit} className="flex items-center gap-2">
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="PIN"
              maxLength={4}
              autoFocus
              className="w-20 px-3 py-2 bg-[rgb(var(--surface)_/_0.9)] backdrop-blur-sm border border-[rgb(var(--border))] rounded-xl text-[rgb(var(--text))] text-center text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand))]"
            />
            <button
              type="submit"
              disabled={pin.length === 0}
              className="px-3 py-2 bg-[rgb(var(--brand))] text-[rgb(var(--text))] rounded-xl text-sm font-medium hover:bg-[rgb(var(--brand-strong))] disabled:opacity-50 transition-all"
            >
              Unlock
            </button>
            <button
              type="button"
              onClick={() => { setShowPinInput(false); setPin(""); setPinError(""); }}
              className="px-3 py-2 bg-[rgb(var(--surface)_/_0.7)] text-[rgb(var(--text)_/_0.7)] rounded-xl text-sm hover:bg-[rgb(var(--surface-2)_/_0.8)] transition-all"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => setShowPinInput(true)}
            className="flex items-center gap-2 px-3 py-2 bg-[rgb(var(--surface)_/_0.7)] backdrop-blur-sm rounded-xl border border-[rgb(var(--border))] text-[rgb(var(--text)_/_0.7)] hover:bg-[rgb(var(--surface-2)_/_0.8)] transition-all text-sm"
          >
            <Lock className="w-4 h-4" />
            <span>Sign in</span>
          </button>
        )}
        {pinError && (
          <p className="absolute top-full right-0 mt-2 px-3 py-1.5 bg-red-500/90 text-white text-xs rounded-lg whitespace-nowrap">
            {pinError}
          </p>
        )}
      </div>

      {/* Dynamic Nature Background */}
      <div className="absolute inset-0">
        {imageData ? (
          <img
            src={imageData.url}
            alt={imageData.alt}
            className={`w-full h-full object-cover transition-opacity duration-1000 ${imageLoaded ? "opacity-100" : "opacity-50"}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageLoaded(true)}
          />
        ) : (
          <div className="w-full h-full bg-[rgb(var(--surface-2))]" />
        )}
      </div>

      <div className="relative flex items-center justify-center min-h-screen p-6">
        <div className="text-center space-y-8 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold text-[rgb(var(--text))] leading-tight">
            Home
          </h1>

          {/* Rotating Quote */}
          <div className="text-xl md:text-2xl text-[rgb(var(--text)_/_0.8)] max-w-2xl mx-auto leading-relaxed min-h-[60px] flex items-center justify-center">
            <span className="italic">{quotes[quoteIndex]}</span>
          </div>

          {/* Feature Buttons */}
          {authRequired && !isAuthenticated && (
            <div className="mx-auto max-w-2xl rounded-2xl border border-amber-300/40 bg-amber-500/15 px-4 py-3 text-sm text-amber-100">
              Access to <span className="font-semibold">{blockedPath || "that section"}</span> requires PIN sign-in.
            </div>
          )}

          <div className="grid gap-6 mt-12 md:grid-cols-3">
            {isAuthenticated && (
              <Link
                href="/dashboard"
                className="group bg-[rgb(var(--surface)_/_0.55)] backdrop-blur-sm rounded-2xl p-6 border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-2)_/_0.75)] transition-all duration-300 flex flex-col items-center justify-center   hover:scale-105"
              >
                <BookOpen className="w-8 h-8 text-[rgb(var(--brand))] mb-4" />
                <h3 className="text-lg font-semibold text-[rgb(var(--text))] mb-2">Journal</h3>
                <p className="text-[rgb(var(--text)_/_0.7)] text-sm">Open your journal dashboard and entries</p>
              </Link>
            )}
            {isAuthenticated && (
              <Link
                href="/journal"
                className="group bg-[rgb(var(--surface)_/_0.55)] backdrop-blur-sm rounded-2xl p-6 border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-2)_/_0.75)] transition-all duration-300 flex flex-col items-center justify-center   hover:scale-105"
              >
                <SquarePen className="w-8 h-8 text-[rgb(var(--brand))] mb-4" />
                <h3 className="text-lg font-semibold text-[rgb(var(--text))] mb-2">New Entry</h3>
                <p className="text-[rgb(var(--text)_/_0.7)] text-sm">Start a fresh journal entry</p>
              </Link>
            )}
            {isAuthenticated && (
              <Link
                href="/todos"
                className="group bg-[rgb(var(--surface)_/_0.55)] backdrop-blur-sm rounded-2xl p-6 border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-2)_/_0.75)] transition-all duration-300 flex flex-col items-center justify-center   hover:scale-105"
              >
                <CheckSquare className="w-8 h-8 text-[rgb(var(--brand))] mb-4" />
                <h3 className="text-lg font-semibold text-[rgb(var(--text))] mb-2">Todos</h3>
                <p className="text-[rgb(var(--text)_/_0.7)] text-sm">Manage your todos and tasks</p>
              </Link>
            )}
            <Link
              href="/tools"
              className="group bg-[rgb(var(--surface)_/_0.55)] backdrop-blur-sm rounded-2xl p-6 border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-2)_/_0.75)] transition-all duration-300 flex flex-col items-center justify-center   hover:scale-105"
            >
              <Wrench className="w-8 h-8 text-[rgb(var(--brand))] mb-4" />
              <h3 className="text-lg font-semibold text-[rgb(var(--text))] mb-2">Tools</h3>
              <p className="text-[rgb(var(--text)_/_0.7)] text-sm">Utilities and calculators</p>
            </Link>
            <Link
              href="/questions"
              className="group bg-[rgb(var(--surface)_/_0.55)] backdrop-blur-sm rounded-2xl p-6 border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-2)_/_0.75)] transition-all duration-300 flex flex-col items-center justify-center   hover:scale-105"
            >
              <MessageCircle className="w-8 h-8 text-[rgb(var(--brand))] mb-4" />
              <h3 className="text-lg font-semibold text-[rgb(var(--text))] mb-2">Q&A</h3>
              <p className="text-[rgb(var(--text)_/_0.7)] text-sm">Ask Zach anything</p>
            </Link>
            {isAuthenticated && (
              <Link
                href="/ops"
                className="group bg-[rgb(var(--surface)_/_0.55)] backdrop-blur-sm rounded-2xl p-6 border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-2)_/_0.75)] transition-all duration-300 flex flex-col items-center justify-center   hover:scale-105"
              >
                <Activity className="w-8 h-8 text-[rgb(var(--brand))] mb-4" />
                <h3 className="text-lg font-semibold text-[rgb(var(--text))] mb-2">Ops Dashboard</h3>
                <p className="text-[rgb(var(--text)_/_0.7)] text-sm">Track current work, updates, and inbox tasks</p>
              </Link>
            )}
            {isAuthenticated && (
              <Link
                href="/workspace"
                className="group bg-[rgb(var(--surface)_/_0.55)] backdrop-blur-sm rounded-2xl p-6 border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-2)_/_0.75)] transition-all duration-300 flex flex-col items-center justify-center hover:scale-105"
              >
                <BriefcaseBusiness className="w-8 h-8 text-[rgb(var(--brand))] mb-4" />
                <h3 className="text-lg font-semibold text-[rgb(var(--text))] mb-2">Workspace</h3>
                <p className="text-[rgb(var(--text)_/_0.7)] text-sm">Quick capture dashboard</p>
              </Link>
            )}
          </div>

          {/* Daily Photo Credit */}
          <div className="mt-16 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[rgb(var(--bg)_/_0.2)] backdrop-blur-sm rounded-full border border-[rgb(var(--border))] text-[rgb(var(--text)_/_0.6)] text-sm">
              Today&apos;s view: {dailyPhoto.location}
              {imageData?.photographer && (
                <span className="text-[rgb(var(--text)_/_0.4)]">
                  • Photo by <a href={imageData.unsplashLink} target="_blank" rel="noopener noreferrer" className="underline hover:text-[rgb(var(--text)_/_0.8)]">{imageData.photographer}</a> on <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-[rgb(var(--text)_/_0.8)]">Unsplash</a>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
