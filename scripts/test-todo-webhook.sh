#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
WEBHOOK_KEY="${TODO_WEBHOOK_SECRET:-${CAPTURE_API_KEY:-${WEBHOOK_SECRET:-}}}"
TODO_TEXT="${1:-Webhook test $(date '+%Y-%m-%d %H:%M:%S')}"

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
echo "GET ${BASE_URL}/api/todos (latest 1-3 shown in response)"
curl --silent --show-error --fail "${BASE_URL}/api/todos"
echo
