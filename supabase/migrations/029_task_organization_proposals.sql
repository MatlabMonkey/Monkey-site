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

CREATE OR REPLACE FUNCTION validate_task_organization_proposal_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_task_version INTEGER;
BEGIN
  SELECT version
  INTO current_task_version
  FROM tasks
  WHERE id = NEW.task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'task_not_found';
  END IF;
  IF current_task_version <> NEW.task_version THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'task_version_conflict';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER task_organization_proposals_validate_version
BEFORE INSERT ON task_organization_proposals
FOR EACH ROW EXECUTE FUNCTION validate_task_organization_proposal_version();

-- Attribute task history to the authenticated reviewer or assistant rule executor.
CREATE OR REPLACE FUNCTION record_task_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    event_name := 'captured';
  ELSIF NEW.status = 'done' AND OLD.status <> 'done' THEN
    event_name := 'completed';
  ELSIF NEW.status = 'archived' AND OLD.status <> 'archived' THEN
    event_name := 'archived';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    event_name := 'status_changed';
  ELSE
    event_name := 'updated';
  END IF;

  INSERT INTO task_events(task_id, event_type, actor, before_state, after_state, reason)
  VALUES (
    NEW.id,
    event_name,
    COALESCE(NULLIF(current_setting('app.task_actor', true), ''), 'user'),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) - 'change_reason' END,
    to_jsonb(NEW) - 'change_reason',
    NEW.change_reason
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION review_task_organization_proposal(
  p_proposal_id UUID,
  p_target_state TEXT,
  p_reviewer TEXT,
  p_review_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proposal task_organization_proposals%ROWTYPE;
  reviewed_proposal task_organization_proposals%ROWTYPE;
  current_task_version INTEGER;
  current_task_status TEXT;
  stale_reason TEXT;
BEGIN
  IF p_target_state NOT IN ('applied', 'rejected', 'superseded') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_organization_review_state';
  END IF;
  IF p_reviewer IS NULL OR p_reviewer !~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,99}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_organization_reviewer';
  END IF;
  IF p_review_reason IS NULL OR char_length(btrim(p_review_reason)) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_organization_review_reason';
  END IF;

  SELECT *
  INTO proposal
  FROM task_organization_proposals
  WHERE id = p_proposal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'task_organization_proposal_not_found';
  END IF;
  IF proposal.state <> 'pending' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'task_organization_proposal_not_pending';
  END IF;

  IF p_target_state = 'applied' THEN
    SELECT version, status
    INTO current_task_version, current_task_status
    FROM tasks
    WHERE id = proposal.task_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'task_not_found';
    END IF;

    IF current_task_version <> proposal.task_version THEN
      stale_reason := format(
        'Stale task version: expected %s, found %s. Review request: %s',
        proposal.task_version,
        current_task_version,
        btrim(p_review_reason)
      );
    ELSIF proposal.boundary = 'auto_apply' AND current_task_status <> 'inbox' THEN
      stale_reason := format(
        'Safe auto-apply requires an Inbox task; found %s. Review request: %s',
        current_task_status,
        btrim(p_review_reason)
      );
    END IF;

    IF stale_reason IS NOT NULL THEN
      UPDATE task_organization_proposals
      SET state = 'superseded', reviewer = p_reviewer, review_reason = stale_reason
      WHERE id = proposal.id
      RETURNING * INTO reviewed_proposal;

      RETURN jsonb_build_object('outcome', 'stale', 'proposal', to_jsonb(reviewed_proposal));
    END IF;

    PERFORM set_config('app.task_actor', p_reviewer, true);
    UPDATE tasks
    SET
      title = CASE WHEN proposal.changes ? 'title' THEN proposal.changes->>'title' ELSE title END,
      notes = CASE WHEN proposal.changes ? 'notes' THEN proposal.changes->>'notes' ELSE notes END,
      status = CASE WHEN proposal.changes ? 'status' THEN proposal.changes->>'status' ELSE status END,
      due_on = CASE
        WHEN proposal.changes ? 'due_on' THEN (proposal.changes->>'due_on')::DATE
        ELSE due_on
      END,
      waiting_on = CASE
        WHEN proposal.changes ? 'waiting_on' THEN proposal.changes->>'waiting_on'
        ELSE waiting_on
      END,
      change_reason = format('Organization proposal %s applied: %s', proposal.id, btrim(p_review_reason))
    WHERE id = proposal.task_id;
  END IF;

  UPDATE task_organization_proposals
  SET
    state = p_target_state,
    reviewer = p_reviewer,
    review_reason = btrim(p_review_reason)
  WHERE id = proposal.id
  RETURNING * INTO reviewed_proposal;

  RETURN jsonb_build_object('outcome', p_target_state, 'proposal', to_jsonb(reviewed_proposal));
END;
$$;

ALTER TABLE task_organization_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_organization_events ENABLE ROW LEVEL SECURITY;

-- Only trusted server code may create or review organization proposals.
REVOKE ALL ON task_organization_proposals FROM anon, authenticated;
REVOKE ALL ON task_organization_events FROM anon, authenticated;
REVOKE ALL ON FUNCTION review_task_organization_proposal(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION review_task_organization_proposal(UUID, TEXT, TEXT, TEXT) TO service_role;
