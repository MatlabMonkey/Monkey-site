"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import PinGate from "../../components/PinGate";
import { ArrowLeft, Loader2, Calendar, List, Filter, BarChart3, Users, Search, Activity, Dumbbell, CheckSquare, FileText, CalendarDays, TrendingUp, X } from "lucide-react";
import { JOURNAL_QUESTION_SET } from "../../../lib/journalSchema";
import type { SearchResultItem } from "../../../lib/journalDb";

type QueryType =
  | "numeric"
  | "people"
  | "people_count"
  | "activity"
  | "workout"
  | "habit"
  | "text_search"
  | "rbt"
  | "date_pattern"
  | "combination"
  | "streak";

type QueryTypeDef = {
  id: QueryType;
  label: string;
  icon: React.ReactNode;
  description: string;
};

const QUERY_TYPES: QueryTypeDef[] = [
  { id: "numeric", label: "Numeric Filters", icon: <BarChart3 className="w-5 h-5" />, description: "Filter by ratings and numbers" },
  { id: "people", label: "People Search", icon: <Users className="w-5 h-5" />, description: "Find days with specific people" },
  { id: "people_count", label: "People Count", icon: <Users className="w-5 h-5" />, description: "Count days by person" },
  { id: "activity", label: "Activity Search", icon: <Activity className="w-5 h-5" />, description: "Find days by activity keywords" },
  { id: "workout", label: "Workout Filters", icon: <Dumbbell className="w-5 h-5" />, description: "Filter by workout types" },
  { id: "habit", label: "Habit Filters", icon: <CheckSquare className="w-5 h-5" />, description: "Filter by daily habits" },
  { id: "text_search", label: "Text Search", icon: <Search className="w-5 h-5" />, description: "Advanced text search" },
  { id: "rbt", label: "Rose/Bud/Thorn", icon: <FileText className="w-5 h-5" />, description: "Search highlights and lowlights" },
  { id: "date_pattern", label: "Date Patterns", icon: <CalendarDays className="w-5 h-5" />, description: "Find by day of week, month, year" },
  { id: "combination", label: "Combination", icon: <Filter className="w-5 h-5" />, description: "Multiple conditions (AND/OR)" },
  { id: "streak", label: "Streaks", icon: <TrendingUp className="w-5 h-5" />, description: "Find consecutive days" },
];

export default function JournalExplorerPage() {
  const [selectedQueryType, setSelectedQueryType] = useState<QueryType>("numeric");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Filter state (will be managed by FilterForm component)
  const [filterParams, setFilterParams] = useState<Record<string, any>>({});

  const runQuery = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      params.set("type", selectedQueryType);
      Object.entries(filterParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          if (Array.isArray(value)) {
            params.set(key, value.join(","));
          } else if (typeof value === "object") {
            params.set(key, JSON.stringify(value));
          } else {
            params.set(key, String(value));
          }
        }
      });

      const res = await fetch("/api/journal/explore?" + params.toString());
      const data = await res.json();
      setResults(data.entries || []);
    } catch (e) {
      console.error("Query failed:", e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [selectedQueryType, filterParams]);

  const numericQuestions = JOURNAL_QUESTION_SET.filter((q) => q.question_type === "number" || q.question_type === "rating");

  return (
    <PinGate>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <div
            className={`${
              sidebarOpen ? "w-64" : "w-0"
            } transition-all duration-300 border-r border-slate-800 bg-slate-900/50 overflow-y-auto flex-shrink-0`}
          >
            {sidebarOpen && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-100">Query Types</h2>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-1 hover:bg-slate-800 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  {QUERY_TYPES.map((qt) => (
                    <button
                      key={qt.id}
                      onClick={() => {
                        setSelectedQueryType(qt.id);
                        setFilterParams({});
                        setSearched(false);
                      }}
                      className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all ${
                        selectedQueryType === qt.id
                          ? "bg-purple-600/30 border border-purple-500/50"
                          : "hover:bg-slate-800/50 border border-transparent"
                      }`}
                    >
                      <div className="mt-0.5 text-slate-400">{qt.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-100">{qt.label}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{qt.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="border-b border-slate-800 bg-slate-900/50 p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {!sidebarOpen && (
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 hover:bg-slate-800 rounded"
                  >
                    <Filter className="w-5 h-5" />
                  </button>
                )}
                <Link
                  href="/journal"
                  className="flex items-center gap-2 text-slate-300 hover:text-slate-50"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span className="font-medium">Journal</span>
                </Link>
                <h1 className="text-xl font-bold text-slate-50">Explorer</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded ${viewMode === "list" ? "bg-purple-600/30 text-purple-300" : "text-slate-400 hover:bg-slate-800"}`}
                >
                  <List className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode("calendar")}
                  className={`p-2 rounded ${viewMode === "calendar" ? "bg-purple-600/30 text-purple-300" : "text-slate-400 hover:bg-slate-800"}`}
                >
                  <Calendar className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter Form */}
            <div className="border-b border-slate-800 bg-slate-900/30 p-6 overflow-y-auto">
              <FilterForm
                queryType={selectedQueryType}
                numericQuestions={numericQuestions}
                onParamsChange={setFilterParams}
                onRunQuery={runQuery}
                loading={loading}
              />
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                </div>
              )}

              {!loading && searched && (
                <>
                  {results.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-slate-400">No entries match your filters.</p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 text-sm text-slate-400">
                        Found {results.length} {results.length === 1 ? "entry" : "entries"}
                      </div>
                      {viewMode === "list" ? (
                        <ResultsList results={results} />
                      ) : (
                        <ResultsCalendar results={results} />
                      )}
                    </>
                  )}
                </>
              )}

              {!loading && !searched && (
                <div className="text-center py-12">
                  <p className="text-slate-400">Select a query type and set filters to explore your journal entries.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PinGate>
  );
}

// Combination filters UI only (no hooks – keeps FilterForm hook order stable)
function CombinationFiltersForm({
  combinationConditions,
  setCombinationConditions,
  localParams,
  updateParam,
  handleRun,
  loading,
}: {
  combinationConditions: Array<{ question_key: string; operator: string; value: string; question_type: string }>;
  setCombinationConditions: React.Dispatch<React.SetStateAction<Array<{ question_key: string; operator: string; value: string; question_type: string }>>>;
  localParams: Record<string, any>;
  updateParam: (key: string, value: any) => void;
  handleRun: () => void;
  loading: boolean;
}) {
  const addCondition = () => {
    setCombinationConditions([...combinationConditions, { question_key: "", operator: "", value: "", question_type: "text" }]);
  };
  const removeCondition = (idx: number) => {
    setCombinationConditions(combinationConditions.filter((_, i) => i !== idx));
  };
  const updateCondition = (idx: number, field: string, value: string) => {
    const updated = [...combinationConditions];
    updated[idx] = { ...updated[idx], [field]: value };
    setCombinationConditions(updated);
  };
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-100">Combination Filters</h3>
      <div className="space-y-4">
        {combinationConditions.map((cond, idx) => {
          const selectedQ = JOURNAL_QUESTION_SET.find((q) => q.key === cond.question_key);
          const isNumeric = selectedQ?.question_type === "number" || selectedQ?.question_type === "rating";
          const isMultiselect = selectedQ?.question_type === "multiselect";
          return (
            <div key={idx} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex items-start justify-between mb-3">
                <span className="text-sm font-medium text-slate-300">Condition {idx + 1}</span>
                <button onClick={() => removeCondition(idx)} className="text-slate-400 hover:text-red-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-slate-400">Question</span>
                  <select
                    value={cond.question_key}
                    onChange={(e) => {
                      const q = JOURNAL_QUESTION_SET.find((q) => q.key === e.target.value);
                      updateCondition(idx, "question_key", e.target.value);
                      updateCondition(idx, "question_type", q?.question_type || "text");
                    }}
                    className="px-2 py-1.5 text-sm border border-slate-700 bg-slate-950 text-slate-100 rounded focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select...</option>
                    {JOURNAL_QUESTION_SET.map((q) => (
                      <option key={q.key} value={q.key}>
                        {q.wording}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-slate-400">Operator</span>
                  <select
                    value={cond.operator}
                    onChange={(e) => updateCondition(idx, "operator", e.target.value)}
                    className="px-2 py-1.5 text-sm border border-slate-700 bg-slate-950 text-slate-100 rounded focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select...</option>
                    {isNumeric && (
                      <>
                        <option value=">=">≥</option>
                        <option value="<=">≤</option>
                        <option value="=">=</option>
                      </>
                    )}
                    {isMultiselect && <option value="contains">Contains</option>}
                    {!isNumeric && !isMultiselect && (
                      <>
                        <option value="contains">Contains</option>
                        <option value="=">Equals</option>
                      </>
                    )}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-slate-400">Value</span>
                  {isMultiselect ? (
                    <select
                      value={cond.value}
                      onChange={(e) => updateCondition(idx, "value", e.target.value)}
                      className="px-2 py-1.5 text-sm border border-slate-700 bg-slate-950 text-slate-100 rounded focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select...</option>
                      {((selectedQ?.metadata?.options as string[]) || []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={isNumeric ? "number" : "text"}
                      value={cond.value}
                      onChange={(e) => updateCondition(idx, "value", e.target.value)}
                      placeholder="Enter value..."
                      className="px-2 py-1.5 text-sm border border-slate-700 bg-slate-950 text-slate-100 rounded focus:ring-2 focus:ring-purple-500"
                    />
                  )}
                </label>
              </div>
            </div>
          );
        })}
        <button
          onClick={addCondition}
          className="px-4 py-2 text-sm border border-slate-700 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700"
        >
          + Add Condition
        </button>
      </div>
      {combinationConditions.length > 0 && (
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <span className="text-sm text-slate-300">Logic:</span>
            <select
              value={localParams.logic || "AND"}
              onChange={(e) => updateParam("logic", e.target.value)}
              className="px-3 py-1.5 border border-slate-700 bg-slate-950 text-slate-100 rounded focus:ring-2 focus:ring-purple-500"
            >
              <option value="AND">AND (all conditions)</option>
              <option value="OR">OR (any condition)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">From Date (optional)</span>
            <input
              type="date"
              value={localParams.from || ""}
              onChange={(e) => updateParam("from", e.target.value)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">To Date (optional)</span>
            <input
              type="date"
              value={localParams.to || ""}
              onChange={(e) => updateParam("to", e.target.value)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </label>
        </div>
      )}
      <button
        onClick={handleRun}
        disabled={loading || combinationConditions.length === 0 || combinationConditions.some((c) => !c.question_key || !c.operator || !c.value)}
        className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-medium hover:from-purple-400 hover:to-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Run Query"}
      </button>
    </div>
  );
}

// Filter Form Component
function FilterForm({
  queryType,
  numericQuestions,
  onParamsChange,
  onRunQuery,
  loading,
}: {
  queryType: QueryType;
  numericQuestions: typeof JOURNAL_QUESTION_SET;
  onParamsChange: (params: Record<string, any>) => void;
  onRunQuery: () => void;
  loading: boolean;
}) {
  const [localParams, setLocalParams] = useState<Record<string, any>>({});
  const [combinationConditions, setCombinationConditions] = useState<Array<{
    question_key: string;
    operator: string;
    value: string;
    question_type: string;
  }>>([]);
  const [streakCondition, setStreakCondition] = useState<{
    question_key: string;
    operator: string;
    value: string;
    question_type: string;
  }>({ question_key: "", operator: "", value: "", question_type: "text" });

  // Single useEffect: reset on queryType change, and sync combination conditions when in combination mode
  useEffect(() => {
    setLocalParams({});
    setCombinationConditions([]);
    setStreakCondition({ question_key: "", operator: "", value: "", question_type: "text" });
    onParamsChange({});
  }, [queryType, onParamsChange]);

  useEffect(() => {
    if (queryType !== "combination") return;
    if (combinationConditions.length > 0) {
      const validConditions = combinationConditions
        .filter((c) => c.question_key && c.operator && c.value !== "")
        .map((c) => {
          const q = JOURNAL_QUESTION_SET.find((q) => q.key === c.question_key);
          return {
            question_key: c.question_key,
            operator: c.operator,
            value: q?.question_type === "number" || q?.question_type === "rating" ? Number(c.value) : c.value,
            question_type: q?.question_type || "text",
          };
        });
      onParamsChange((prev: Record<string, any>) => ({ ...prev, conditions: validConditions }));
    } else {
      onParamsChange((prev: Record<string, any>) => ({ ...prev, conditions: [] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryType, combinationConditions]);

  const updateParam = (key: string, value: any) => {
    const newParams = { ...localParams, [key]: value };
    setLocalParams(newParams);
    onParamsChange(newParams);
  };

  const handleRun = () => {
    onRunQuery();
  };

  if (queryType === "numeric") {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Numeric Filter</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">Question</span>
            <select
              value={localParams.question_key || ""}
              onChange={(e) => updateParam("question_key", e.target.value)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select question...</option>
              {numericQuestions.map((q) => (
                <option key={q.key} value={q.key}>
                  {q.wording}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">Operator</span>
            <select
              value={localParams.operator || ""}
              onChange={(e) => updateParam("operator", e.target.value)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select operator...</option>
              <option value=">=">Greater than or equal (≥)</option>
              <option value="<=">Less than or equal (≤)</option>
              <option value="=">Equal (=)</option>
              <option value="between">Between</option>
            </select>
          </label>
          {localParams.operator === "between" ? (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-200">Min Value</span>
                <input
                  type="number"
                  value={localParams.value || ""}
                  onChange={(e) => updateParam("value", e.target.value ? Number(e.target.value) : undefined)}
                  className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-200">Max Value</span>
                <input
                  type="number"
                  value={localParams.value2 || ""}
                  onChange={(e) => updateParam("value2", e.target.value ? Number(e.target.value) : undefined)}
                  className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </label>
            </>
          ) : (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-200">Value</span>
              <input
                type="number"
                value={localParams.value || ""}
                onChange={(e) => updateParam("value", e.target.value ? Number(e.target.value) : undefined)}
                className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">From Date (optional)</span>
            <input
              type="date"
              value={localParams.from || ""}
              onChange={(e) => updateParam("from", e.target.value)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">To Date (optional)</span>
            <input
              type="date"
              value={localParams.to || ""}
              onChange={(e) => updateParam("to", e.target.value)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </label>
        </div>
        <button
          onClick={handleRun}
          disabled={loading || !localParams.question_key || !localParams.operator || localParams.value === undefined}
          className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-medium hover:from-purple-400 hover:to-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Run Query"}
        </button>
      </div>
    );
  }

  if (queryType === "people" || queryType === "people_count") {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">{queryType === "people_count" ? "People Count" : "People Search"}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">Person Name</span>
            <input
              type="text"
              value={localParams.person_name || ""}
              onChange={(e) => updateParam("person_name", e.target.value)}
              placeholder="Enter person name..."
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">From Date (optional)</span>
            <input
              type="date"
              value={localParams.from || ""}
              onChange={(e) => updateParam("from", e.target.value)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">To Date (optional)</span>
            <input
              type="date"
              value={localParams.to || ""}
              onChange={(e) => updateParam("to", e.target.value)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </label>
        </div>
        <button
          onClick={handleRun}
          disabled={loading || !localParams.person_name?.trim()}
          className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-medium hover:from-purple-400 hover:to-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : queryType === "people_count" ? "Count Days" : "Search"}
        </button>
      </div>
    );
  }

  if (queryType === "activity") {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Activity Search</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">Search Text</span>
            <input
              type="text"
              value={localParams.search_text || ""}
              onChange={(e) => updateParam("search_text", e.target.value)}
              placeholder="e.g., surfing, beach, meeting..."
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">From Date (optional)</span>
            <input
              type="date"
              value={localParams.from || ""}
              onChange={(e) => updateParam("from", e.target.value)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">To Date (optional)</span>
            <input
              type="date"
              value={localParams.to || ""}
              onChange={(e) => updateParam("to", e.target.value)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </label>
        </div>
        <button
          onClick={handleRun}
          disabled={loading || !localParams.search_text?.trim()}
          className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-medium hover:from-purple-400 hover:to-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Search"}
        </button>
      </div>
    );
  }

  if (queryType === "workout") {
    const workoutOptions = (JOURNAL_QUESTION_SET.find((q) => q.key === "workouts")?.metadata?.options as string[] | undefined) || [];
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Workout Filter</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-sm font-medium text-slate-200">Workout Types</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {workoutOptions.map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(localParams.workout_types || []).includes(opt)}
                    onChange={(e) => {
                      const current = localParams.workout_types || [];
                      const updated = e.target.checked ? [...current, opt] : current.filter((w: string) => w !== opt);
                      updateParam("workout_types", updated);
                    }}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-sm text-slate-300">{opt}</span>
                </label>
              ))}
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">From Date (optional)</span>
            <input
              type="date"
              value={localParams.from || ""}
              onChange={(e) => updateParam("from", e.target.value)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">To Date (optional)</span>
            <input
              type="date"
              value={localParams.to || ""}
              onChange={(e) => updateParam("to", e.target.value)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </label>
        </div>
        <button
          onClick={handleRun}
          disabled={loading || !localParams.workout_types || localParams.workout_types.length === 0}
          className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-medium hover:from-purple-400 hover:to-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Filter"}
        </button>
      </div>
    );
  }

  if (queryType === "habit") {
    const habitOptions = (JOURNAL_QUESTION_SET.find((q) => q.key === "daily_habits")?.metadata?.options as string[] | undefined) || [];
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Habit Filter</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-sm font-medium text-slate-200">Daily Habits</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {habitOptions.map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(localParams.habit_types || []).includes(opt)}
                    onChange={(e) => {
                      const current = localParams.habit_types || [];
                      const updated = e.target.checked ? [...current, opt] : current.filter((h: string) => h !== opt);
                      updateParam("habit_types", updated);
                    }}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-sm text-slate-300">{opt}</span>
                </label>
              ))}
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">From Date (optional)</span>
            <input
              type="date"
              value={localParams.from || ""}
              onChange={(e) => updateParam("from", e.target.value)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">To Date (optional)</span>
            <input
              type="date"
              value={localParams.to || ""}
              onChange={(e) => updateParam("to", e.target.value)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </label>
        </div>
        <button
          onClick={handleRun}
          disabled={loading || !localParams.habit_types || localParams.habit_types.length === 0}
          className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-medium hover:from-purple-400 hover:to-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Filter"}
        </button>
      </div>
    );
  }

  if (queryType === "text_search") {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Advanced Text Search</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">Search Text</span>
            <input
              type="text"
              value={localParams.search_text || ""}
              onChange={(e) => updateParam("search_text", e.target.value)}
              placeholder="Enter search term..."
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">From Date (optional)</span>
            <input
              type="date"
              value={localParams.from || ""}
              onChange={(e) => updateParam("from", e.target.value)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">To Date (optional)</span>
            <input
              type="date"
              value={localParams.to || ""}
              onChange={(e) => updateParam("to", e.target.value)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </label>
        </div>
        <button
          onClick={handleRun}
          disabled={loading || !localParams.search_text?.trim()}
          className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-medium hover:from-purple-400 hover:to-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Search"}
        </button>
      </div>
    );
  }

  if (queryType === "rbt") {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Rose / Bud / Thorn</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">Field</span>
            <select
              value={localParams.rbt_field || ""}
              onChange={(e) => updateParam("rbt_field", e.target.value)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select field...</option>
              <option value="rose">Rose (highlight)</option>
              <option value="bud">Bud (looking forward)</option>
              <option value="thorn">Thorn (lowlight)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">Search Text (optional)</span>
            <input
              type="text"
              value={localParams.rbt_search || ""}
              onChange={(e) => updateParam("rbt_search", e.target.value)}
              placeholder="Filter by text..."
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">From Date (optional)</span>
            <input
              type="date"
              value={localParams.from || ""}
              onChange={(e) => updateParam("from", e.target.value)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">To Date (optional)</span>
            <input
              type="date"
              value={localParams.to || ""}
              onChange={(e) => updateParam("to", e.target.value)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </label>
        </div>
        <button
          onClick={handleRun}
          disabled={loading || !localParams.rbt_field}
          className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-medium hover:from-purple-400 hover:to-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Search"}
        </button>
      </div>
    );
  }

  if (queryType === "date_pattern") {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Date Pattern</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">Day of Week (optional)</span>
            <select
              value={localParams.day_of_week ?? ""}
              onChange={(e) => updateParam("day_of_week", e.target.value ? Number(e.target.value) : undefined)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Any day</option>
              <option value="0">Sunday</option>
              <option value="1">Monday</option>
              <option value="2">Tuesday</option>
              <option value="3">Wednesday</option>
              <option value="4">Thursday</option>
              <option value="5">Friday</option>
              <option value="6">Saturday</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">Month (optional)</span>
            <select
              value={localParams.month ?? ""}
              onChange={(e) => updateParam("month", e.target.value ? Number(e.target.value) : undefined)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Any month</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2024, m - 1, 1).toLocaleDateString("en-US", { month: "long" })}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">Year (optional)</span>
            <input
              type="number"
              value={localParams.year || ""}
              onChange={(e) => updateParam("year", e.target.value ? Number(e.target.value) : undefined)}
              placeholder="e.g., 2024"
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">From Date (optional)</span>
            <input
              type="date"
              value={localParams.from || ""}
              onChange={(e) => updateParam("from", e.target.value)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">To Date (optional)</span>
            <input
              type="date"
              value={localParams.to || ""}
              onChange={(e) => updateParam("to", e.target.value)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </label>
        </div>
        <button
          onClick={handleRun}
          disabled={loading}
          className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-medium hover:from-purple-400 hover:to-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Find Entries"}
        </button>
      </div>
    );
  }

  if (queryType === "combination") {
    return (
      <CombinationFiltersForm
        combinationConditions={combinationConditions}
        setCombinationConditions={setCombinationConditions}
        localParams={localParams}
        updateParam={updateParam}
        handleRun={handleRun}
        loading={loading}
      />
    );
  }

  if (queryType === "streak") {
    const updateStreakField = (field: string, value: string) => {
      const updated = { ...streakCondition, [field]: value };
      if (field === "question_key") {
        const q = JOURNAL_QUESTION_SET.find((q) => q.key === value);
        updated.question_type = q?.question_type || "text";
      }
      setStreakCondition(updated);

      if (updated.question_key && updated.operator && updated.value !== "") {
        const q = JOURNAL_QUESTION_SET.find((q) => q.key === updated.question_key);
        const condition = {
          question_key: updated.question_key,
          operator: updated.operator,
          value: q?.question_type === "number" || q?.question_type === "rating" ? Number(updated.value) : updated.value,
          question_type: q?.question_type || "text",
        };
        updateParam("streak_condition", condition);
      } else {
        updateParam("streak_condition", undefined);
      }
    };

    const selectedQ = JOURNAL_QUESTION_SET.find((q) => q.key === streakCondition.question_key);
    const isNumeric = selectedQ?.question_type === "number" || selectedQ?.question_type === "rating";
    const isMultiselect = selectedQ?.question_type === "multiselect";

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Streak Detection</h3>
        <p className="text-sm text-slate-400">Find consecutive days matching a condition</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">Question</span>
            <select
              value={streakCondition.question_key}
              onChange={(e) => updateStreakField("question_key", e.target.value)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select question...</option>
              {JOURNAL_QUESTION_SET.map((q) => (
                <option key={q.key} value={q.key}>
                  {q.wording}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">Operator</span>
            <select
              value={streakCondition.operator}
              onChange={(e) => updateStreakField("operator", e.target.value)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select operator...</option>
              {isNumeric && (
                <>
                  <option value=">=">Greater than or equal (≥)</option>
                  <option value="<=">Less than or equal (≤)</option>
                  <option value="=">Equal (=)</option>
                </>
              )}
              {isMultiselect && <option value="contains">Contains</option>}
              {!isNumeric && !isMultiselect && (
                <>
                  <option value="contains">Contains</option>
                  <option value="=">Equals</option>
                </>
              )}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">Value</span>
            {isMultiselect ? (
              <select
                value={streakCondition.value}
                onChange={(e) => updateStreakField("value", e.target.value)}
                className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select...</option>
                {((selectedQ?.metadata?.options as string[]) || []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={isNumeric ? "number" : "text"}
                value={streakCondition.value}
                onChange={(e) => updateStreakField("value", e.target.value)}
                placeholder="Enter value..."
                className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            )}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">From Date (optional)</span>
            <input
              type="date"
              value={localParams.from || ""}
              onChange={(e) => updateParam("from", e.target.value)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-200">To Date (optional)</span>
            <input
              type="date"
              value={localParams.to || ""}
              onChange={(e) => updateParam("to", e.target.value)}
              className="px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </label>
        </div>
        <button
          onClick={handleRun}
          disabled={loading || !streakCondition.question_key || !streakCondition.operator || !streakCondition.value}
          className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-medium hover:from-purple-400 hover:to-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Find Streaks"}
        </button>
      </div>
    );
  }

  return null;
}

// Results List Component
function ResultsList({ results }: { results: SearchResultItem[] }) {
  function snippet(answers: SearchResultItem["answers"], maxLen = 120): string {
    const parts: string[] = [];
    for (const a of answers) {
      if (a.answer_value == null || a.answer_value === "") continue;
      const s = Array.isArray(a.answer_value) ? (a.answer_value as string[]).join(", ") : String(a.answer_value);
      if (s.length > 0) parts.push(s);
    }
    const t = parts.join(" · ");
    return t.length > maxLen ? t.slice(0, maxLen) + "…" : t;
  }

  return (
    <div className="space-y-3">
      {results.map((e) => (
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
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-900 text-amber-200">Draft</span>
            )}
          </div>
          <p className="text-slate-300 text-sm line-clamp-2">{snippet(e.answers) || "—"}</p>
        </Link>
      ))}
    </div>
  );
}

// Results Calendar Component
function ResultsCalendar({ results }: { results: SearchResultItem[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const resultDates = new Set(results.map((r) => r.date));

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday

  const days: Date[] = [];
  const current = new Date(startDate);
  for (let i = 0; i < 42; i++) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
          className="p-2 hover:bg-slate-800 rounded"
        >
          ←
        </button>
        <h3 className="text-lg font-semibold text-slate-100">
          {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h3>
        <button
          onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
          className="p-2 hover:bg-slate-800 rounded"
        >
          →
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="text-center text-sm font-medium text-slate-400 py-2">
            {day}
          </div>
        ))}
        {days.map((day, idx) => {
          const dateStr = formatDate(day);
          const isCurrentMonth = day.getMonth() === month;
          const isResult = resultDates.has(dateStr);
          const isToday = dateStr === new Date().toISOString().split("T")[0];

          return (
            <Link
              key={idx}
              href={"/journal?date=" + dateStr}
              className={`p-2 text-center rounded transition-all ${
                !isCurrentMonth
                  ? "text-slate-600"
                  : isResult
                    ? "bg-purple-600/30 border border-purple-500/50 text-purple-200 hover:bg-purple-600/50"
                    : isToday
                      ? "bg-slate-800 text-slate-100 border border-slate-700"
                      : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {day.getDate()}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
