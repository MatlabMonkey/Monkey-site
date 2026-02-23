import type { ReactNode } from "react"

type CardProps = {
  title: string
  children: ReactNode
  className?: string
  gradient?: "purple" | "blue" | "green" | "orange" | "pink" | "yellow" | "gray"
  icon?: ReactNode
}

export default function Card({ title, children, className = "", icon }: CardProps) {
  return (
    <div
      className={`
      rounded-2xl border border-[rgb(var(--border))]
      bg-[rgb(var(--surface))]
      transition-colors
      p-6 h-full
      ${className}
    `}
    >
      <div className="flex items-center gap-3 mb-4">
        {icon && (
          <div className="p-2 rounded-xl border border-[rgb(var(--brand)_/_0.45)] bg-[rgb(var(--brand-weak)_/_0.8)]">
            {icon}
          </div>
        )}
        <h2 className="text-lg font-bold text-[rgb(var(--text))]">{title}</h2>
      </div>
      <div className="text-[rgb(var(--text-muted))]">{children}</div>
    </div>
  )
}
