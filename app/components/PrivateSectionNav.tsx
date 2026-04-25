"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Journal" },
  { href: "/todos", label: "Todos" },
  { href: "/workspace", label: "Workspace" },
  { href: "/ops", label: "Ops" },
  { href: "/tools", label: "Tools" },
]

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname.startsWith("/journal")
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function PrivateSectionNav({ className = "" }: { className?: string }) {
  const pathname = usePathname()

  return (
    <nav className={`flex flex-wrap items-center gap-2 ${className}`} aria-label="Private sections">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              active
                ? "border-slate-500 bg-slate-700/60 text-slate-100"
                : "border-slate-700 bg-slate-900/60 text-slate-300 hover:text-slate-100 hover:bg-slate-800/70"
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
