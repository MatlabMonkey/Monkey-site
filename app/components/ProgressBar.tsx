import type React from "react"
interface ProgressBarProps {
  label: string
  value: number
  goal: number
  color: string
  icon?: React.ReactNode
}

export default function ProgressBar({ label, value, goal, color, icon }: ProgressBarProps) {
  const percentage = Math.min(100, (value / goal) * 100)

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon && <span className="text-lg">{icon}</span>}
          <span className="text-sm font-semibold text-gray-800">{label}</span>
        </div>
        <span className="text-sm font-bold text-gray-600">
          {value}/{goal}
        </span>
      </div>

      <div className="relative w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
        </div>
      </div>

      <div className="mt-1 text-xs text-gray-500">{percentage.toFixed(1)}% complete</div>
    </div>
  )
}
