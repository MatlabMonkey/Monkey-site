-- Assistant organization is proposal-first. Suggested content and rationale are immutable.
CREATE TABLE task_organization_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
  task_version INTEGER NOT NULL CHECK (task_version > 0),
  changes JSONB NOT NULL CHECK (
    jsonb_typeof(changes) = 'object'
    AND changes <> '{}'::jsonb
    AND changes - ARRAY['title', 'notes', 'status', 'due_on', 'waiting_on'] = '{}'::jsonb
  ),
  confidence NUMERIC(4, 3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  boundary TEXT NOT NULL CHECK (boundary IN ('auto_apply', 'needs_review')),
  rationale TEXT NOT NULL CHECK (char_length(btrim(rationale)) BETWEEN 1 AND 2000),
  rule_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'applied', 'rejected', 'superseded')),
  created_by TEXT NOT NULL DEFAULT 'assistant',
  reviewer TEXT,
  review_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    boundary <> 'auto_apply'
    OR (
      confidence >= 0.900
      AND changes - 'status' = '{}'::jsonb
      AND changes->>'status' IN ('today', 'later')
    )
  ),
  CHECK (
    (state = 'pending' AND reviewer IS NULL AND reviewed_at IS NULL)
    OR (state <> 'pending' AND reviewer IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

CREATE INDEX task_organization_proposals_pending_idx
  ON task_organization_proposals(created_at) WHERE state = 'pending';
CREATE INDEX task_organization_proposals_task_idx
  ON task_organization_proposals(task_id, created_at DESC);

CREATE TABLE task_organization_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES task_organization_proposals(id) ON DELETE RESTRICT,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('proposed', 'applied', 'rejected', 'superseded')),
  actor TEXT NOT NULL,
  rationale TEXT,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX task_organization_events_proposal_idx
  ON task_organization_events(proposal_id, created_at DESC);
CREATE INDEX task_organization_events_task_idx
  ON task_organization_events(task_id, created_at DESC);

CREATE OR REPLACE FUNCTION protect_task_organization_proposal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'task organization proposals cannot be deleted';
  END IF;

  IF NEW.task_id IS DISTINCT FROM OLD.task_id
    OR NEW.task_version IS DISTINCT FROM OLD.task_version
    OR NEW.changes IS DISTINCT FROM OLD.changes
    OR NEW.confidence IS DISTINCT FROM OLD.confidence
    OR NEW.boundary IS DISTINCT FROM OLD.boundary
    OR NEW.rationale IS DISTINCT FROM OLD.rationale
    OR NEW.rule_id IS DISTINCT FROM OLD.rule_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'task organization proposal inputs and rationale are immutable';
  END IF;

  IF OLD.state <> 'pending' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'reviewed task organization proposals are immutable';
  END IF;

  IF OLD.state = 'pending' AND NEW.state <> 'pending' THEN
    NEW.reviewed_at := now();
    NEW.updated_at := now();
  ELSIF NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'only a pending proposal review may be recorded';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER task_organization_proposals_immutable
BEFORE UPDATE OR DELETE ON task_organization_proposals
FOR EACH ROW EXECUTE FUNCTION protect_task_organization_proposal();

CREATE OR REPLACE FUNCTION record_task_organization_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO task_organization_events(
    proposal_id,
    task_id,
    event_type,
    actor,
    rationale,
    snapshot
  ) VALUES (
    NEW.id,
    NEW.task_id,
    CASE WHEN TG_OP = 'INSERT' THEN 'proposed' ELSE NEW.state END,
    CASE WHEN TG_OP = 'INSERT' THEN NEW.created_by ELSE NEW.reviewer END,
    CASE WHEN TG_OP = 'INSERT' THEN NEW.rationale ELSE NEW.review_reason END,
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER task_organization_proposals_record_insert
AFTER INSERT ON task_organization_proposals
FOR EACH ROW
EXECUTE FUNCTION record_task_organization_event();

CREATE TRIGGER task_organization_proposals_record_review
AFTER UPDATE OF state ON task_organization_proposals
FOR EACH ROW
WHEN (OLD.state IS DISTINCT FROM NEW.state)
EXECUTE FUNCTION record_task_organization_event();

CREATE OR REPLACE FUNCTION reject_task_organization_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'task_organization_events is append-only';
END;
$$;

CREATE TRIGGER task_organization_events_immutable
BEFORE UPDATE OR DELETE ON task_organization_events
FOR EACH ROW EXECUTE FUNCTION reject_task_organization_event_mutation();

ALTER TABLE task_organization_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_organization_events ENABLE ROW LEVEL SECURITY;

-- Only trusted server code may create or review organization proposals.
REVOKE ALL ON task_organization_proposals FROM anon, authenticated;
REVOKE ALL ON task_organization_events FROM anon, authenticated;
