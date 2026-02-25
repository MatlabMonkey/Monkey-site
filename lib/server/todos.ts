import { createClient } from "@supabase/supabase-js"

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
}

export async function listInboxTodos() {
  const supabase = getSupabaseAdmin()
  const { data: todos, error } = await supabase
    .from("todos")
    .select("*")
    .eq("folder", "inbox")
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return todos || []
}

export async function createTodo(content: string, folder = "inbox") {
  const supabase = getSupabaseAdmin()
  const { data: todo, error } = await supabase
    .from("todos")
    .insert([{ content, folder, completed: false }])
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  if (!todo) {
    throw new Error("Todo created but not returned")
  }

  return todo
}

export async function updateTodoCompleted(id: string, completed: boolean) {
  const supabase = getSupabaseAdmin()
  const { data: todo, error } = await supabase
    .from("todos")
    .update({
      completed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return todo
}

export async function deleteTodoById(id: string) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from("todos").delete().eq("id", id)

  if (error) {
    throw new Error(error.message)
  }
}
