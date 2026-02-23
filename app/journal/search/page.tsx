"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import PinGate from "../../components/PinGate";
import { ArrowLeft, Search, Loader2, Calendar } from "lucide-react";

type SearchResult = {
  id: string;
  date: string;
  is_draft: boolean;
  completed_at: string | null;
  answers: Array< { question_key: string; answer_value: unknown; answer_type: string }>;
};

function snippet(answers: SearchResult["answers"], maxLen = 120): string {
  const parts: string[] = [];
  for (const a of answers) {
    if (a.answer_value == null || a.answer_value === "") continue;
    const s = Array.isArray(a.answer_value) ? (a.answer_value as string[]).join(", ") : String(a.answer_value);
    if (s.length > 0) parts.push(s);
  }
  const t = parts.join(" · ");
  return t.length > maxLen ? t.slice(0, maxLen) + "…" : t;
}

export default function JournalSearchPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [entries, setEntries] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch("/api/journal/search?" + params.toString());
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (e) {
      console.error("Search failed:", e);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [from, to, q]);


  return (
    <PinGate>
      <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-6">
            <Link
              href="/journal"
              className="flex items-center gap-2 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Journal</span>
            </Link>
            <h1 className="text-xl font-bold text-[rgb(var(--text))]">Search entries</h1>
          </div>

          <div className="bg-[rgb(var(--surface))] rounded-2xl border border-[rgb(var(--border))] p-6  space-y-4 mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[rgb(var(--text))]">From date</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="px-3 py-2 border border-[rgb(var(--border))] bg-[rgb(var(--bg))] text-[rgb(var(--text))] rounded-lg focus:ring-2 focus:ring-[rgb(var(--brand))] focus:border-transparent"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[rgb(var(--text))]">To date</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="px-3 py-2 border border-[rgb(var(--border))] bg-[rgb(var(--bg))] text-[rgb(var(--text))] rounded-lg focus:ring-2 focus:ring-[rgb(var(--brand))] focus:border-transparent"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-[rgb(var(--text))]">Text search</span>
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="Search in answers…"
                className="px-3 py-2 border border-[rgb(var(--border))] bg-[rgb(var(--bg))] text-[rgb(var(--text))] rounded-lg focus:ring-2 focus:ring-[rgb(var(--brand))] focus:border-transparent placeholder:text-[rgb(var(--text-muted))]"
              />
            </label>
            <button
              onClick={runSearch}
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 bg-[rgb(var(--brand))] text-[rgb(var(--text))] rounded-xl font-medium hover:bg-[rgb(var(--brand-strong))] disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </div>

          {searched && (
            <div className="space-y-3">
              {entries.length === 0 && !loading && (
                <p className="text-[rgb(var(--text-muted))] text-center py-8">No entries match your filters.</p>
              )}
              {entries.map((e) => (
                <Link
                  key={e.id}
                  href={"/journal?date=" + e.date}
                  className="block bg-[rgb(var(--surface))] rounded-xl border border-[rgb(var(--border))] p-4  hover:border-[rgb(var(--brand))]  transition-all"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="flex items-center gap-2 text-[rgb(var(--text))] font-medium">
                      <Calendar className="w-4 h-4" />
                      {new Date(e.date + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    {e.is_draft && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium border border-[rgb(var(--brand)_/_0.45)] bg-[rgb(var(--brand-weak)_/_0.7)] text-[rgb(var(--brand))]">
                        Draft
                      </span>
                    )}
                  </div>
                  <p className="text-[rgb(var(--text-muted))] text-sm line-clamp-2">{snippet(e.answers) || "—"}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </PinGate>
  );
}
