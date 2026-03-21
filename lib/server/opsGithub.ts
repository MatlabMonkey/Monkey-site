export type GitHubCommit = {
  sha: string
  html_url: string
  message: string
  author: string
  date: string
}

export type GitHubPr = {
  id: number
  number: number
  title: string
  html_url: string
  user: string
  updated_at: string
}

export type GitHubActivity = {
  configured: boolean
  hint?: string
  error?: string
  details?: string
  repo?: string | null
  commits: GitHubCommit[]
  pullRequests: GitHubPr[]
}

export async function fetchGithubActivity(repo: string | null): Promise<GitHubActivity> {
  const token = process.env.GITHUB_TOKEN
  const normalizedRepo = repo?.trim().toLowerCase() || null

  if (!token) {
    return {
      configured: false,
      hint: "Set GITHUB_TOKEN to enable project GitHub activity.",
      repo: normalizedRepo,
      commits: [],
      pullRequests: [],
    }
  }

  if (!normalizedRepo || !normalizedRepo.includes("/")) {
    return {
      configured: false,
      hint: "No repo configured for this project.",
      repo: normalizedRepo,
      commits: [],
      pullRequests: [],
    }
  }

  const [owner, repoName] = normalizedRepo.split("/")

  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "Monkey-site-ops-dashboard",
  }

  try {
    const [commitsRes, prsRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repoName}/commits?per_page=6`, {
        headers,
        cache: "no-store",
      }),
      fetch(`https://api.github.com/repos/${owner}/${repoName}/pulls?state=open&per_page=6`, {
        headers,
        cache: "no-store",
      }),
    ])

    if (!commitsRes.ok || !prsRes.ok) {
      const commitsErr = commitsRes.ok ? "" : await commitsRes.text()
      const prsErr = prsRes.ok ? "" : await prsRes.text()

      return {
        configured: true,
        repo: normalizedRepo,
        error: "GitHub API request failed",
        details: `${commitsErr} ${prsErr}`.trim(),
        commits: [],
        pullRequests: [],
      }
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

    return {
      configured: true,
      repo: normalizedRepo,
      commits,
      pullRequests,
    }
  } catch (error) {
    return {
      configured: true,
      repo: normalizedRepo,
      error: "Failed to fetch GitHub activity",
      details: error instanceof Error ? error.message : String(error),
      commits: [],
      pullRequests: [],
    }
  }
}
