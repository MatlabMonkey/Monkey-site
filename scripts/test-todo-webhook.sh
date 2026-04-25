#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
WEBHOOK_KEY="${TODO_WEBHOOK_SECRET:-${CAPTURE_API_KEY:-${WEBHOOK_SECRET:-}}}"
TODO_TEXT="${1:-Webhook test $(date '+%Y-%m-%d %H:%M:%S')}"
PIN_GATE_PIN="${PIN_GATE_PIN:-}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/monkey-site-pin-cookie.txt}"

if [[ -z "${WEBHOOK_KEY}" ]]; then
  echo "Missing webhook key."
  echo "Set one of: TODO_WEBHOOK_SECRET, CAPTURE_API_KEY, WEBHOOK_SECRET"
  exit 1
fi

echo "POST ${BASE_URL}/api/webhook/todos"
curl --silent --show-error --fail \
  -X POST "${BASE_URL}/api/webhook/todos" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${WEBHOOK_KEY}" \
  -d "{\"content\":\"${TODO_TEXT}\",\"folder\":\"inbox\"}"

echo
echo
if [[ -n "${PIN_GATE_PIN}" ]]; then
  echo "Authenticating PIN session for protected GET /api/todos"
  curl --silent --show-error --fail \
    -X POST "${BASE_URL}/api/auth/pin" \
    -H "Content-Type: application/json" \
    -c "${COOKIE_JAR}" \
    -d "{\"pin\":\"${PIN_GATE_PIN}\"}" > /dev/null

  echo
  echo "GET ${BASE_URL}/api/todos (requires PIN session cookie)"
  curl --silent --show-error --fail \
    -b "${COOKIE_JAR}" \
    "${BASE_URL}/api/todos"
  echo
else
  echo "Skipping GET ${BASE_URL}/api/todos because PIN_GATE_PIN is not set."
  echo "(This route is now protected by PIN session auth.)"
fi
