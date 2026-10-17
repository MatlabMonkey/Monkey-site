# Todo v2 assistant organization contract

Assistant organization is proposal-first and deterministic at the trust boundary:

- Every proposal records the task version, normalized structured changes, confidence, rule identifier, and rationale used to make the suggestion.
- Only a high-confidence (`>= 0.90`) route from Inbox to Today or Later is eligible for automatic application.
- Dates, text changes, Waiting metadata, completion, and archival always require review regardless of confidence.
- Proposal inputs and rationale cannot be edited after creation. A pending proposal can move once to Applied, Rejected, or Superseded, and every transition creates an append-only event.
- Browser roles have no direct table access. A later server/API slice will create and review proposals through authenticated server-only operations and will reject stale task versions before applying changes.

This slice defines and tests the contract and persistence boundary. It does not invoke an LLM, apply proposals, add a review UI, or migrate legacy todo data.
