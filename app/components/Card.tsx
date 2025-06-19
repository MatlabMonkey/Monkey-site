import type { ReactNode } from "react"

type CardProps = {
  title: string
  children: ReactNode
  className?: string
  gradient?: "purple" | "blue" | "green" | "orange" | "pink" | "yellow" | "gray"
  icon?: ReactNode
}

const gradientMap = {
  purple: "from-purple-50 to-purple-100 border-purple-200",
  blue: "from-blue-50 to-blue-100 border-blue-200",
  green: "from-green-50 to-green-100 border-green-200",
  orange: "from-orange-50 to-orange-100 border-orange-200",
  pink: "from-pink-50 to-pink-100 border-pink-200",
  yellow: "from-yellow-50 to-yellow-100 border-yellow-200",
  gray: "from-gray-50 to-gray-100 border-gray-200",
}

export default function Card({ title, children, className = "", gradient = "gray", icon }: CardProps) {
  return (
    <div
      className={`
      bg-gradient-to-br ${gradientMap[gradient]}
      rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300
      p-6 h-full
      ${className}
    `}
    >
      <div className="flex items-center gap-3 mb-4">
        {icon && <div className="p-2 bg-white/60 rounded-xl">{icon}</div>}
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
      </div>
      <div className="text-gray-700">{children}</div>
    </div>
  )
}
