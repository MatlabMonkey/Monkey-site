"use client"

import { useEffect, useState } from "react"
import { Plus, Check, Trash2, Inbox, ArrowLeft } from "lucide-react"
import Link from "next/link"
import PinGate from "../components/PinGate"

type Todo = {
  id: string
  content: string
  completed: boolean
  created_at: string
  updated_at: string
  folder: string
}

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [newTodo, setNewTodo] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    fetchTodos()
  }, [])

  const fetchTodos = async () => {
    try {
      const response = await fetch("/api/todos")
      if (!response.ok) {
        const error = await response.json()
        console.error("Failed to fetch todos:", error)
        alert(`Failed to load todos: ${error.error || "Unknown error"}`)
        return
      }
      const data = await response.json()
      setTodos(data.todos || [])
    } catch (error) {
      console.error("Failed to fetch todos:", error)
      alert(`Failed to load todos: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTodo.trim() || isAdding) return

    setIsAdding(true)
    const content = newTodo.trim()
    setNewTodo("")

    // Optimistic update
    const tempTodo: Todo = {
      id: `temp-${Date.now()}`,
      content,
      completed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      folder: "inbox",
    }
    setTodos((prev) => [tempTodo, ...prev])

    try {
      const response = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create todo")
      }

      const data = await response.json()
      if (data.todo) {
        // Replace temp todo with real one
        setTodos((prev) => prev.map((todo) => (todo.id === tempTodo.id ? data.todo : todo)))
      } else {
        // Remove temp todo if no real todo returned
        setTodos((prev) => prev.filter((todo) => todo.id !== tempTodo.id))
      }
    } catch (error) {
      console.error("Failed to add todo:", error)
      // Remove temp todo on error
      setTodos((prev) => prev.filter((todo) => todo.id !== tempTodo.id))
      alert(`Failed to add todo: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsAdding(false)
    }
  }

  const toggleTodo = async (id: string, completed: boolean) => {
    // Optimistic update
    setTodos((prev) => prev.map((todo) => (todo.id === id ? { ...todo, completed } : todo)))

    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      })

      if (!response.ok) {
        // Revert on error
        setTodos((prev) => prev.map((todo) => (todo.id === id ? { ...todo, completed: !completed } : todo)))
        const error = await response.json()
        console.error("Failed to update todo:", error)
      }
    } catch (error) {
      // Revert on error
      setTodos((prev) => prev.map((todo) => (todo.id === id ? { ...todo, completed: !completed } : todo)))
      console.error("Failed to update todo:", error)
    }
  }

  const deleteTodo = async (id: string) => {
    // Optimistic update
    setTodos((prev) => prev.filter((todo) => todo.id !== id))

    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        // Refetch on error
        fetchTodos()
        const error = await response.json()
        console.error("Failed to delete todo:", error)
      }
    } catch (error) {
      // Refetch on error
      fetchTodos()
      console.error("Failed to delete todo:", error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) return "Just now"
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`
    if (diffInHours < 48) return "Yesterday"
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const pendingTodos = todos.filter((todo) => !todo.completed)
  const completedTodos = todos.filter((todo) => todo.completed)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-700 border-t-indigo-500 mx-auto"></div>
          <p className="text-gray-400">Loading todos...</p>
        </div>
      </div>
    )
  }

  return (
    <PinGate>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        {/* Header */}
        <div className="bg-gray-800/80 backdrop-blur-sm border-b border-gray-700/50 sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/" className="p-2 hover:bg-gray-700 rounded-xl transition-colors">
                  <ArrowLeft className="w-5 h-5 text-gray-400" />
                </Link>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Todo Inbox
                  </h1>
                  <p className="text-gray-400 mt-1">Lightning-fast task management</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-gradient-to-r from-blue-900/50 to-indigo-900/50 rounded-full border border-blue-700/30">
                  <span className="text-sm font-medium text-blue-400">{pendingTodos.length} pending</span>
                </div>
                <div className="px-4 py-2 bg-gradient-to-r from-green-900/50 to-emerald-900/50 rounded-full border border-green-700/30">
                  <span className="text-sm font-medium text-green-400">{completedTodos.length} done</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Quick Add Form */}
          <div className="bg-gray-800/50 rounded-3xl shadow-lg border border-gray-700/50 p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-900/50 rounded-xl border border-green-700/30">
                <Plus className="w-5 h-5 text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-gray-100">Quick Add</h2>
            </div>

            <form onSubmit={addTodo} className="flex gap-3">
              <input
                type="text"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                placeholder="What needs to be done?"
                className="flex-1 px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-100 placeholder-gray-500"
                disabled={isAdding}
              />
              <button
                type="submit"
                disabled={!newTodo.trim() || isAdding}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-semibold hover:from-indigo-500 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-2"
              >
                {isAdding ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Inbox Section */}
          <div className="bg-gray-800/50 rounded-3xl shadow-lg border border-gray-700/50 overflow-hidden">
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-900/50 rounded-xl border border-blue-700/30">
                  <Inbox className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-100">Inbox</h2>
                <span className="text-sm text-gray-400">
                  {todos.length} {todos.length === 1 ? "item" : "items"}
                </span>
              </div>
            </div>

            <div className="divide-y divide-gray-700">
              {todos.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-700">
                    <Inbox className="w-8 h-8 text-gray-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-200 mb-2">Your inbox is empty</h3>
                  <p className="text-gray-400">Add your first task above to get started!</p>
                </div>
              ) : (
                todos.map((todo) => (
                  <div
                    key={todo.id}
                    className={`p-6 hover:bg-gray-800/30 transition-colors group ${todo.completed ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => toggleTodo(todo.id, !todo.completed)}
                        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          todo.completed
                            ? "bg-green-500 border-green-500 text-white"
                            : "border-gray-600 hover:border-green-400 hover:bg-green-900/30"
                        }`}
                      >
                        {todo.completed && <Check className="w-4 h-4" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className={`text-gray-100 ${todo.completed ? "line-through" : ""}`}>{todo.content}</p>
                        <span className="text-xs text-gray-500 mt-1 block">{formatDate(todo.created_at)}</span>
                      </div>

                      <button
                        onClick={() => deleteTodo(todo.id)}
                        className="flex-shrink-0 p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </PinGate>
  )
}
