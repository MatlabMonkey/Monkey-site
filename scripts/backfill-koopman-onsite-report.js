#!/usr/bin/env node

const path = require("path")
const dotenv = require("dotenv")
const { createClient } = require("@supabase/supabase-js")

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const apiKey = process.env.NEXT_PUBLIC_API_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")
  process.exit(1)
}

const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  apiKey && apiKey !== "your-secret-api-key-here"
    ? {
        global: {
          headers: {
            "x-api-key": apiKey,
          },
        },
      }
    : {},
)

function buildKoopmanHtml({ title, summary, publishedAt }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
        line-height: 1.6;
        background: #0f172a;
        color: #e2e8f0;
      }
      main {
        max-width: 980px;
        margin: 0 auto;
        padding: 40px 24px 56px;
      }
      .hero {
        border: 1px solid #334155;
        border-radius: 20px;
        padding: 24px;
        background: linear-gradient(145deg, rgba(30,41,59,0.85), rgba(15,23,42,0.92));
      }
      h1, h2 { line-height: 1.2; }
      h1 { margin: 0 0 10px; font-size: 2rem; }
      h2 { margin-top: 28px; font-size: 1.25rem; }
      p { margin: 0 0 12px; }
      .meta {
        color: #94a3b8;
        font-size: 0.9rem;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
        margin-top: 16px;
      }
      .card {
        border: 1px solid #334155;
        border-radius: 14px;
        background: rgba(15, 23, 42, 0.65);
        padding: 14px;
      }
      ul { padding-left: 20px; }
      code {
        background: rgba(15, 23, 42, 0.85);
        border: 1px solid #334155;
        padding: 2px 6px;
        border-radius: 6px;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <h1>${title}</h1>
        <p>${summary}</p>
        <p class="meta">Published ${new Date(publishedAt).toLocaleString()}</p>
      </section>

      <h2>What this report includes</h2>
      <div class="grid">
        <article class="card">
          <strong>Modeling progress</strong>
          <p>State lifting design, actuator constraints, and prediction-horizon tuning.</p>
        </article>
        <article class="card">
          <strong>Controller implementation</strong>
          <p>MPC objective shaping and stabilization behavior under practical constraints.</p>
        </article>
        <article class="card">
          <strong>Verification signals</strong>
          <p>Tracking quality, robustness checks, and key follow-up actions.</p>
        </article>
      </div>

      <h2>On-site publication note</h2>
      <p>
        This HTML has been backfilled into the Ops Dashboard database for direct rendering on
        <code>/reports/koopman-mpc-progress-report</code>.
      </p>
      <ul>
        <li>Scripts are intentionally omitted for safe in-site rendering.</li>
        <li>Styling is self-contained, so the page renders consistently in an iframe sandbox.</li>
        <li>The canonical report link in <code>work_reports.report_url</code> now points to this on-site route.</li>
      </ul>
    </main>
  </body>
</html>`
}

async function ensureUniqueSlug(baseSlug, ignoreId) {
  for (let index = 0; index < 50; index += 1) {
    const candidate = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`
    const { data, error } = await supabase.from("work_reports").select("id").eq("slug", candidate).maybeSingle()
    if (error) throw error
    if (!data || data.id === ignoreId) return candidate
  }
  throw new Error("Unable to allocate unique slug")
}

async function run() {
  const { data: report, error } = await supabase
    .from("work_reports")
    .select("id, title, summary, published_at")
    .eq("project_key", "koopman-mpc")
    .eq("report_type", "html")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!report) {
    throw new Error("No Koopman HTML report row found in work_reports")
  }

  const slug = await ensureUniqueSlug("koopman-mpc-progress-report", report.id)

  const htmlContent = buildKoopmanHtml({
    title: report.title,
    summary: report.summary,
    publishedAt: report.published_at,
  })

  const { error: updateError } = await supabase
    .from("work_reports")
    .update({
      slug,
      report_url: `/reports/${slug}`,
      html_content: htmlContent,
      asset_base_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", report.id)

  if (updateError) throw updateError

  console.log(`Updated Koopman report ${report.id} -> /reports/${slug}`)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
