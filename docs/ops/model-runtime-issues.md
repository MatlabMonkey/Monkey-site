# Model Runtime Issues Log

## 2026-04-25 19:55 PDT — Codex CLI quota exceeded during GTD audit

- **Task:** Spawn Codex CLI audit for `/todos` GTD UX.
- **Command intent:** `codex exec` with read-only sandbox; write report to `docs/projects/todos-gtd-ux-audit/CODEX_AUDIT_2026-04-25.md`.
- **Result:** failed before analysis due to provider quota.

### Raw stderr excerpt

```text
OpenAI Codex v0.104.0 (research preview)
model: gpt-5.5
provider: openai
approval: never
sandbox: read-only
ERROR: Quota exceeded. Check your plan and billing details.
(Command exited with code 1)
```

### Fallback used
- Continued with manual in-session audit.
- Produced:
  - `docs/projects/todos-gtd-ux-audit/AUDIT_2026-04-25.md`
  - `docs/projects/todos-gtd-ux-audit/WORKLOG.md`

### Notes
- This was a provider billing/quota failure, not a code/runtime crash in Monkey-site.
- Recommended: monitor OpenAI billing/quota and set a fallback routing policy for coding audits.

---

## 2026-04-26 00:06 PDT — Memory embeddings quota exhausted

- **Task:** `memory_search` lookup for prior Codex quota event context.
- **Result:** memory retrieval unavailable due embedding provider quota.

### Raw error excerpt

```text
openai embeddings failed: 429
"type": "insufficient_quota"
"code": "insufficient_quota"
```

### Impact
- Could not retrieve prior memory corpus via semantic search.
- No data loss in project files; only retrieval path temporarily unavailable.

---

## 2026-04-26 00:19 PDT — Codex health-check still quota blocked

- **Task:** verify if Codex recovered by running a minimal `codex exec` smoke test.
- **Prompt:** `Reply with exactly: CODEx_OK`
- **Result:** same provider quota error; command exited before model response.

### Raw stderr excerpt

```text
OpenAI Codex v0.104.0
model: gpt-5.5
provider: openai
ERROR: Quota exceeded. Check your plan and billing details.
(Command exited with code 1)
```

### Notes
- This confirms Codex is currently unavailable for new runs on this host/account until quota/billing is restored.
- Codex CLI help output shows no built-in command to query remaining quota/limits.
