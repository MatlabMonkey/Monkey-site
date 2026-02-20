"use client"

import Link from "next/link"
import { ArrowRight, CheckSquare, Plus, BarChart3, Compass, PenLine } from "lucide-react"
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
  const [dailyPhoto, setDailyPhoto] = useState(getDailyPhoto())
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageData, setImageData] = useState<{
    url: string
    alt: string
    photographer: string
    unsplashLink: string
  } | null>(null)
  const quoteIndex = getDailyQuoteIndex()

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

  const backgroundPattern =
    "data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%239C92AC' fillOpacity='0.05'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E"

  return (
    <main className="min-h-screen relative overflow-hidden">
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
          <div className="w-full h-full bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900" />
        )}
      </div>

      <div className="relative flex items-center justify-center min-h-screen p-6">
        <div className="text-center space-y-8 max-w-4xl mx-auto">
          {/* Heading */}
          <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent leading-tight">
            Welcome zach
          </h1>

          {/* Arias test message */}
          <p className="text-2xl md:text-3xl font-semibold text-green-300">
            It worked. 🦧
          </p>

          {/* Rotating Quote */}
          <div className="text-xl md:text-2xl text-white/80 max-w-2xl mx-auto leading-relaxed min-h-[60px] flex items-center justify-center">
            <span className="italic">{quotes[quoteIndex]}</span>
          </div>

          {/* Feature Buttons */}
          <div className="grid md:grid-cols-2 gap-6 mt-12">
            <Link
              href="/dashboard"
              className="group bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300 flex flex-col items-center justify-center shadow-lg hover:shadow-xl hover:scale-105"
            >
              <BarChart3 className="w-8 h-8 text-purple-300 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Dashboard</h3>
              <p className="text-white/70 text-sm">View your journal analytics, progress, and reflections</p>
            </Link>
            <Link
              href="/journal/explorer"
              className="group bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300 flex flex-col items-center justify-center shadow-lg hover:shadow-xl hover:scale-105"
            >
              <Compass className="w-8 h-8 text-blue-300 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Journal Explorer</h3>
              <p className="text-white/70 text-sm">Explore and query your past journal entries</p>
            </Link>
            <Link
              href="/journal"
              className="group bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300 flex flex-col items-center justify-center shadow-lg hover:shadow-xl hover:scale-105"
            >
              <PenLine className="w-8 h-8 text-amber-300 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">New Entry</h3>
              <p className="text-white/70 text-sm">Write today's journal entry</p>
            </Link>
            <Link
              href="/todos"
              className="group bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300 flex flex-col items-center justify-center shadow-lg hover:shadow-xl hover:scale-105"
            >
              <CheckSquare className="w-8 h-8 text-green-300 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Todo Inbox</h3>
              <p className="text-white/70 text-sm">Manage your todos and tasks</p>
            </Link>
          </div>

          {/* Daily Photo Credit */}
          <div className="mt-16 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-black/20 backdrop-blur-sm rounded-full border border-white/10 text-white/60 text-sm">
              Today's view: {dailyPhoto.location}
              {imageData?.photographer && (
                <span className="text-white/40">
                  • Photo by <a href={imageData.unsplashLink} target="_blank" rel="noopener noreferrer" className="underline hover:text-white/80">{imageData.photographer}</a> on <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/80">Unsplash</a>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
