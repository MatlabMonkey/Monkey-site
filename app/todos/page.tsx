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
      <div className="min-h-screen bg-[rgb(var(--bg))] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[rgb(var(--border))] border-t-[rgb(var(--brand))] mx-auto"></div>
          <p className="text-[rgb(var(--text-muted))]">Loading todos...</p>
        </div>
      </div>
    )
  }

  return (
    <PinGate>
      <div className="min-h-screen bg-[rgb(var(--bg))]">
        {/* Header */}
        <div className="bg-[rgb(var(--surface-2)_/_0.80)] backdrop-blur-sm border-b border-[rgb(var(--border))] sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/" className="p-2 hover:bg-[rgb(var(--surface-2))] rounded-xl transition-colors">
                  <ArrowLeft className="w-5 h-5 text-[rgb(var(--text-muted))]" />
                </Link>
                <div>
                  <h1 className="text-4xl font-bold text-[rgb(var(--text))]">
                    Todo Inbox
                  </h1>
                  <p className="text-[rgb(var(--text-muted))] mt-1">Lightning-fast task management</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-[rgb(var(--brand-weak)_/_0.7)] rounded-full border border-[rgb(var(--border))]">
                  <span className="text-sm font-medium text-[rgb(var(--brand))]">{pendingTodos.length} pending</span>
                </div>
                <div className="px-4 py-2 bg-[rgb(var(--surface-2)_/_0.9)] rounded-full border border-[rgb(var(--border))]">
                  <span className="text-sm font-medium text-[rgb(var(--brand))]">{completedTodos.length} done</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Quick Add Form */}
          <div className="bg-[rgb(var(--surface-2)_/_0.50)] rounded-3xl  border border-[rgb(var(--border))] p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-[rgb(var(--brand-weak)_/_0.8)] rounded-xl border border-[rgb(var(--brand)_/_0.45)]">
                <Plus className="w-5 h-5 text-[rgb(var(--brand))]" />
              </div>
              <h2 className="text-xl font-bold text-[rgb(var(--text))]">Quick Add</h2>
            </div>

            <form onSubmit={addTodo} className="flex gap-3">
              <input
                type="text"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                placeholder="What needs to be done?"
                className="flex-1 px-4 py-3 bg-[rgb(var(--surface)_/_0.50)] border border-[rgb(var(--border))] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand))] focus:border-transparent transition-all text-[rgb(var(--text))] placeholder:text-[rgb(var(--text-muted))]"
                disabled={isAdding}
              />
              <button
                type="submit"
                disabled={!newTodo.trim() || isAdding}
                className="px-6 py-3 bg-[rgb(var(--brand))] text-[rgb(var(--text))] rounded-2xl font-semibold hover:bg-[rgb(var(--brand-strong))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand))] focus:ring-offset-2 focus:ring-offset-[rgb(var(--surface))] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-2"
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
          <div className="bg-[rgb(var(--surface-2)_/_0.50)] rounded-3xl  border border-[rgb(var(--border))] overflow-hidden">
            <div className="p-6 border-b border-[rgb(var(--border))]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[rgb(var(--brand-weak)_/_0.8)] rounded-xl border border-[rgb(var(--brand)_/_0.45)]">
                  <Inbox className="w-5 h-5 text-[rgb(var(--brand))]" />
                </div>
                <h2 className="text-xl font-bold text-[rgb(var(--text))]">Inbox</h2>
                <span className="text-sm text-[rgb(var(--text-muted))]">
                  {todos.length} {todos.length === 1 ? "item" : "items"}
                </span>
              </div>
            </div>

            <div className="divide-y divide-[rgb(var(--border))]">
              {todos.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-[rgb(var(--surface-2))] rounded-full flex items-center justify-center mx-auto mb-4 border border-[rgb(var(--border))]">
                    <Inbox className="w-8 h-8 text-[rgb(var(--text-muted))]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[rgb(var(--text))] mb-2">Your inbox is empty</h3>
                  <p className="text-[rgb(var(--text-muted))]">Add your first task above to get started!</p>
                </div>
              ) : (
                todos.map((todo) => (
                  <div
                    key={todo.id}
                    className={`p-6 hover:bg-[rgb(var(--surface-2)_/_0.30)] transition-colors group ${todo.completed ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => toggleTodo(todo.id, !todo.completed)}
                        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          todo.completed
                            ? "bg-[rgb(var(--brand))] border-[rgb(var(--brand))] text-[rgb(var(--text))]"
                            : "border-[rgb(var(--border))] hover:border-[rgb(var(--brand))] hover:bg-[rgb(var(--brand-weak)_/_0.7)]"
                        }`}
                      >
                        {todo.completed && <Check className="w-4 h-4" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className={`text-[rgb(var(--text))] ${todo.completed ? "line-through" : ""}`}>{todo.content}</p>
                        <span className="text-xs text-[rgb(var(--text-muted))] mt-1 block">{formatDate(todo.created_at)}</span>
                      </div>

                      <button
                        onClick={() => deleteTodo(todo.id)}
                        className="flex-shrink-0 p-2 text-[rgb(var(--text-muted))] hover:text-[rgb(239_68_68)] hover:bg-[rgb(127_29_29_/_0.25)] rounded-xl transition-all opacity-0 group-hover:opacity-100"
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
