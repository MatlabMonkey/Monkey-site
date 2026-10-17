# Todo v2 assistant organization contract

Assistant organization is proposal-first and deterministic at the trust boundary:

- Every proposal records the task version, normalized structured changes, confidence, rule identifier, and rationale used to make the suggestion.
- Only a high-confidence (`>= 0.90`) route from Inbox to Today or Later is eligible for automatic application.
- Dates, text changes, Waiting metadata, completion, and archival always require review regardless of confidence.
- Proposal inputs and rationale cannot be edited after creation. A pending proposal can move once to Applied, Rejected, or Superseded, and every transition creates an append-only event.
- Browser roles have no direct table access. Authenticated server-only endpoints create, list, apply, reject, or supersede proposals.
- Proposal creation locks and verifies the referenced task version. Application locks both records and either applies the normalized changes atomically or records the proposal as Superseded and returns a conflict when the task version is stale.
- High-confidence safe-route proposals auto-apply through the same atomic application path. All other proposals remain Pending for explicit review, and every outcome preserves its actor and rationale in append-only history.

This slice defines and tests the contract, persistence boundary, and authenticated server operations. It does not invoke an LLM, add a review UI, or migrate legacy todo data.
