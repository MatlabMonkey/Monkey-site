"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Plus, Check, Trash2, Inbox, Zap, Calendar, ArrowLeft } from "lucide-react"
import Link from "next/link"
import PinGate from "../components/PinGate"

type Todo = {
  id: number
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
      const data = await response.json()
      if (data.todos) {
        setTodos(data.todos)
      }
    } catch (error) {
      console.error("Failed to fetch todos:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTodo.trim() || isAdding) return

    setIsAdding(true)

    // Optimistic update
    const tempTodo: Todo = {
      id: Date.now(),
      content: newTodo.trim(),
      completed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      folder: "inbox",
    }
    setTodos((prev) => [tempTodo, ...prev])
    setNewTodo("")

    try {
      const response = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newTodo.trim() }),
      })

      const data = await response.json()
      if (data.todo) {
        // Replace temp todo with real one
        setTodos((prev) => prev.map((todo) => (todo.id === tempTodo.id ? data.todo : todo)))
      }
    } catch (error) {
      console.error("Failed to add todo:", error)
      // Remove temp todo on error
      setTodos((prev) => prev.filter((todo) => todo.id !== tempTodo.id))
    } finally {
      setIsAdding(false)
    }
  }

  const toggleTodo = async (id: number, completed: boolean) => {
    // Optimistic update
    setTodos((prev) => prev.map((todo) => (todo.id === id ? { ...todo, completed } : todo)))

    try {
      await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      })
    } catch (error) {
      console.error("Failed to update todo:", error)
      // Revert on error
      setTodos((prev) => prev.map((todo) => (todo.id === id ? { ...todo, completed: !completed } : todo)))
    }
  }

  const deleteTodo = async (id: number) => {
    // Optimistic update
    setTodos((prev) => prev.filter((todo) => todo.id !== id))

    try {
      await fetch(`/api/todos/${id}`, {
        method: "DELETE",
      })
    } catch (error) {
      console.error("Failed to delete todo:", error)
      fetchTodos() // Refetch on error
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

  const completedTodos = todos.filter((todo) => todo.completed)
  const pendingTodos = todos.filter((todo) => !todo.completed)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mx-auto"></div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-400 to-purple-400 opacity-20 animate-pulse"></div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-800">Loading Inbox</h2>
            <p className="text-gray-600">Preparing your tasks...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <PinGate>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/" className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </Link>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                    Todo Inbox
                  </h1>
                  <p className="text-gray-600 mt-1">Lightning-fast task management</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full">
                  <span className="text-sm font-medium text-blue-700">{pendingTodos.length} pending</span>
                </div>
                <div className="px-4 py-2 bg-gradient-to-r from-green-100 to-emerald-100 rounded-full">
                  <span className="text-sm font-medium text-green-700">{completedTodos.length} done</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Quick Add Form */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-200/50 p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-xl">
                <Plus className="w-5 h-5 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Quick Add</h2>
              <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 rounded-full">
                <Zap className="w-3 h-3 text-yellow-600" />
                <span className="text-xs font-medium text-yellow-700">Fast</span>
              </div>
            </div>

            <form onSubmit={addTodo} className="flex gap-3">
              <input
                type="text"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                placeholder="What needs to be done?"
                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-800 placeholder-gray-500"
                disabled={isAdding}
              />
              <button
                type="submit"
                disabled={!newTodo.trim() || isAdding}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-semibold hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-2"
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
          <div className="bg-white rounded-3xl shadow-lg border border-gray-200/50 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <Inbox className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800">Inbox</h2>
                <span className="text-sm text-gray-500">
                  {todos.length} {todos.length === 1 ? "item" : "items"}
                </span>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {todos.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Inbox className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Your inbox is empty</h3>
                  <p className="text-gray-600">Add your first task above to get started!</p>
                </div>
              ) : (
                todos.map((todo) => (
                  <div
                    key={todo.id}
                    className={`p-6 hover:bg-gray-50 transition-colors group ${todo.completed ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => toggleTodo(todo.id, !todo.completed)}
                        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          todo.completed
                            ? "bg-green-500 border-green-500 text-white"
                            : "border-gray-300 hover:border-green-400 hover:bg-green-50"
                        }`}
                      >
                        {todo.completed && <Check className="w-4 h-4" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className={`text-gray-800 ${todo.completed ? "line-through" : ""}`}>{todo.content}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">{formatDate(todo.created_at)}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => deleteTodo(todo.id)}
                        className="flex-shrink-0 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Webhook Info */}
          <div className="mt-8 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl p-6 border border-purple-100">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-100 rounded-xl">
                <Zap className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-purple-800 mb-1">Automation Ready</h3>
                <p className="text-purple-700 text-sm mb-2">
                  Send todos via webhook for easy automation from any service.
                </p>
                <code className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded font-mono">
                  POST /api/webhook/todos
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PinGate>
  )
}
