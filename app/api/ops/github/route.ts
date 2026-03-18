import { NextResponse } from "next/server"

type GitHubCommit = { sha: string; html_url: string; message: string; author: string; date: string }
type GitHubPr = { id: number; number: number; title: string; html_url: string; user: string; updated_at: string }

export async function GET() {
  const token = process.env.GITHUB_TOKEN
  const repo = process.env.OPS_GITHUB_REPO || process.env.GITHUB_REPO

  if (!token || !repo || !repo.includes("/")) {
    return NextResponse.json({
      configured: false,
      hint: "Set GITHUB_TOKEN and OPS_GITHUB_REPO (owner/repo) to enable the GitHub widget.",
      commits: [],
      pullRequests: [],
    })
  }

  const [owner, repoName] = repo.split("/")

  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "Monkey-site-ops-dashboard",
  }

  try {
    const [commitsRes, prsRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repoName}/commits?per_page=5`, { headers, cache: "no-store" }),
      fetch(`https://api.github.com/repos/${owner}/${repoName}/pulls?state=open&per_page=5`, { headers, cache: "no-store" }),
    ])

    if (!commitsRes.ok || !prsRes.ok) {
      const commitsErr = commitsRes.ok ? "" : await commitsRes.text()
      const prsErr = prsRes.ok ? "" : await prsRes.text()
      return NextResponse.json(
        {
          configured: true,
          error: "GitHub API request failed",
          details: `${commitsErr} ${prsErr}`.trim(),
          commits: [],
          pullRequests: [],
        },
        { status: 200 },
      )
    }

    const commitsJson = (await commitsRes.json()) as any[]
    const prsJson = (await prsRes.json()) as any[]

    const commits: GitHubCommit[] = commitsJson.map((commit) => ({
      sha: commit.sha,
      html_url: commit.html_url,
      message: commit.commit?.message || "(no message)",
      author: commit.commit?.author?.name || "Unknown",
      date: commit.commit?.author?.date || "",
    }))

    const pullRequests: GitHubPr[] = prsJson.map((pr) => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      html_url: pr.html_url,
      user: pr.user?.login || "Unknown",
      updated_at: pr.updated_at,
    }))

    return NextResponse.json({ configured: true, repo, commits, pullRequests })
  } catch (error) {
    return NextResponse.json({
      configured: true,
      error: "Failed to fetch GitHub activity",
      details: error instanceof Error ? error.message : String(error),
      commits: [],
      pullRequests: [],
    })
  }
}
