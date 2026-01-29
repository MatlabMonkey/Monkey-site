"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import PinGate from "../components/PinGate";
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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-6">
            <Link
              href="/journal"
              className="flex items-center gap-2 text-slate-300 hover:text-slate-50"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Journal</span>
            </Link>
            <h1 className="text-xl font-bold text-slate-50">Search entries</h1>
          </div>

          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-lg shadow-black/30 space-y-4 mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-200">From date</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-200">To date</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-200">Text search</span>
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="Search in answers…"
                className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder:text-slate-500"
              />
            </label>
            <button
              onClick={runSearch}
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-medium hover:from-purple-400 hover:to-indigo-400 disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </div>

          {searched && (
            <div className="space-y-3">
              {entries.length === 0 && !loading && (
                <p className="text-slate-400 text-center py-8">No entries match your filters.</p>
              )}
              {entries.map((e) => (
                <Link
                  key={e.id}
                  href={"/journal?date=" + e.date}
                  className="block bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-sm hover:border-purple-400/60 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="flex items-center gap-2 text-slate-100 font-medium">
                      <Calendar className="w-4 h-4" />
                      {new Date(e.date + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    {e.is_draft && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-900 text-amber-200">
                        Draft
                      </span>
                    )}
                  </div>
                  <p className="text-slate-300 text-sm line-clamp-2">{snippet(e.answers) || "—"}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </PinGate>
  );
}
