import { redirect } from "next/navigation"

export default async function UsageProjectRedirectPage({
  params,
}: {
  params: Promise<{ projectKey: string }>
}) {
  const { projectKey } = await params
  redirect(`/ops/projects/${encodeURIComponent(projectKey)}`)
}
