import { NextRequest, NextResponse } from "next/server"
import { supabase } from "../../../../lib/supabaseClient"
import {
  OpsProjectValidationError,
  getProjects,
  normalizeProjectCreateInput,
  normalizeProjectStatus,
} from "../../../../lib/server/opsProjects"

export async function GET(request: NextRequest) {
  try {
    const statusParam = request.nextUrl.searchParams.get("status")
    const statusFilter = statusParam && statusParam !== "all" ? normalizeProjectStatus(statusParam) : null

    const projects = await getProjects()
    const filteredProjects = statusFilter
      ? projects.filter((project) => project.status === statusFilter)
      : projects

    return NextResponse.json({
      projects: filteredProjects,
      active: filteredProjects.filter((project) => project.status === "active"),
      archived: filteredProjects.filter((project) => project.status === "archived"),
    })
  } catch (error) {
    if (error instanceof OpsProjectValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: "Failed to load projects", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const payload = normalizeProjectCreateInput(body)

    const { data, error } = await supabase.from("ops_projects").insert(payload).select("*").single()

    if (error) {
      if ((error as { code?: string }).code === "23505") {
        return NextResponse.json(
          { error: `Project key '${payload.project_key}' already exists` },
          { status: 409 },
        )
      }
      throw error
    }

    return NextResponse.json({ project: data }, { status: 201 })
  } catch (error) {
    if (error instanceof OpsProjectValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: "Failed to create project", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
