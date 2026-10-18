-- Tracked work is outcome-first. Evidence is metadata-only and append-only in this slice.
CREATE TABLE tracked_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 500),
  outcome TEXT NOT NULL CHECK (char_length(btrim(outcome)) BETWEEN 1 AND 2000),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'blocked', 'completed', 'cancelled')),
  deadline_on DATE,
  deadline_provenance_type TEXT
    CHECK (deadline_provenance_type IN ('user', 'external', 'derived')),
  deadline_provenance_ref TEXT,
  deadline_confidence NUMERIC(4, 3) CHECK (deadline_confidence BETWEEN 0 AND 1),
  automation_state TEXT NOT NULL DEFAULT 'manual'
    CHECK (automation_state IN ('manual', 'monitoring', 'awaiting_approval', 'paused', 'finished')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CHECK (
    (deadline_on IS NULL
      AND deadline_provenance_type IS NULL
      AND deadline_provenance_ref IS NULL
      AND deadline_confidence IS NULL)
    OR
    (deadline_on IS NOT NULL
      AND deadline_provenance_type IS NOT NULL
      AND deadline_provenance_ref IS NOT NULL
      AND char_length(btrim(deadline_provenance_ref)) > 0
      AND deadline_confidence IS NOT NULL)
  )
);

CREATE INDEX tracked_cases_status_deadline_idx ON tracked_cases(status, deadline_on, created_at);
CREATE INDEX tracked_cases_automation_idx ON tracked_cases(automation_state, updated_at);

CREATE OR REPLACE FUNCTION prepare_tracked_case_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.title := btrim(NEW.title);
  NEW.outcome := btrim(NEW.outcome);
  NEW.deadline_provenance_ref := NULLIF(btrim(NEW.deadline_provenance_ref), '');

  IF TG_OP = 'UPDATE' THEN
    NEW.version := OLD.version + 1;
    NEW.updated_at := now();
  END IF;

  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status <> 'completed') THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'completed' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tracked_cases_prepare_change
BEFORE INSERT OR UPDATE ON tracked_cases
FOR EACH ROW EXECUTE FUNCTION prepare_tracked_case_change();

CREATE TABLE tracked_case_tasks (
  case_id UUID NOT NULL REFERENCES tracked_cases(id) ON DELETE RESTRICT,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('next_action', 'milestone')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (case_id, task_id)
);

CREATE TABLE case_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES tracked_cases(id) ON DELETE RESTRICT,
  blocked_task_id UUID NOT NULL,
  blocking_task_id UUID NOT NULL,
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'satisfied', 'waived')),
  rationale TEXT NOT NULL CHECK (char_length(btrim(rationale)) BETWEEN 1 AND 2000),
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (case_id, blocked_task_id)
    REFERENCES tracked_case_tasks(case_id, task_id) ON DELETE RESTRICT,
  FOREIGN KEY (case_id, blocking_task_id)
    REFERENCES tracked_case_tasks(case_id, task_id) ON DELETE RESTRICT,
  CHECK (blocked_task_id <> blocking_task_id),
  CHECK (
    (state = 'open' AND resolved_by IS NULL AND resolved_at IS NULL)
    OR (state <> 'open' AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL)
  ),
  UNIQUE (id, case_id)
);

CREATE INDEX case_dependencies_case_state_idx ON case_dependencies(case_id, state, created_at);
CREATE UNIQUE INDEX case_dependencies_open_edge_unique
  ON case_dependencies(case_id, blocked_task_id, blocking_task_id) WHERE state = 'open';

CREATE TABLE case_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES tracked_cases(id) ON DELETE RESTRICT,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('message', 'document', 'receipt', 'status', 'other')),
  summary TEXT NOT NULL CHECK (char_length(btrim(summary)) BETWEEN 1 AND 2000),
  source TEXT NOT NULL CHECK (source ~ '^[a-z][a-z0-9_-]{0,49}$'),
  source_id TEXT NOT NULL CHECK (char_length(btrim(source_id)) BETWEEN 1 AND 500),
  observed_at TIMESTAMPTZ NOT NULL,
  content_sha256 TEXT CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  recorded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_id),
  UNIQUE (id, case_id)
);

CREATE INDEX case_evidence_case_observed_idx ON case_evidence(case_id, observed_at DESC);

CREATE TABLE case_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES tracked_cases(id) ON DELETE RESTRICT,
  dependency_id UUID,
  evidence_id UUID,
  severity TEXT NOT NULL CHECK (severity IN ('notice', 'warning', 'urgent')),
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'acknowledged', 'resolved')),
  reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 2000),
  opened_by TEXT NOT NULL,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (dependency_id, case_id)
    REFERENCES case_dependencies(id, case_id) ON DELETE RESTRICT,
  FOREIGN KEY (evidence_id, case_id)
    REFERENCES case_evidence(id, case_id) ON DELETE RESTRICT,
  CHECK (num_nonnulls(dependency_id, evidence_id) <= 1),
  CHECK (
    (state = 'open'
      AND acknowledged_by IS NULL AND acknowledged_at IS NULL
      AND resolved_by IS NULL AND resolved_at IS NULL)
    OR (state = 'acknowledged'
      AND acknowledged_by IS NOT NULL AND acknowledged_at IS NOT NULL
      AND resolved_by IS NULL AND resolved_at IS NULL)
    OR (state = 'resolved'
      AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL)
  )
);

CREATE INDEX case_escalations_case_state_idx ON case_escalations(case_id, state, severity, created_at);

CREATE TABLE case_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES tracked_cases(id) ON DELETE RESTRICT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('case', 'task_link', 'dependency', 'evidence', 'escalation')),
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX case_events_case_created_idx ON case_events(case_id, created_at DESC);

CREATE OR REPLACE FUNCTION record_case_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_data JSONB;
  event_case_id UUID;
  event_entity_type TEXT;
  event_entity_id UUID;
  event_reason TEXT;
BEGIN
  row_data := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;

  CASE TG_TABLE_NAME
    WHEN 'tracked_cases' THEN
      event_case_id := (row_data->>'id')::UUID;
      event_entity_type := 'case';
      event_entity_id := event_case_id;
      event_reason := row_data->>'change_reason';
    WHEN 'tracked_case_tasks' THEN
      event_case_id := (row_data->>'case_id')::UUID;
      event_entity_type := 'task_link';
      event_entity_id := (row_data->>'task_id')::UUID;
      event_reason := row_data->>'role';
    WHEN 'case_dependencies' THEN
      event_case_id := (row_data->>'case_id')::UUID;
      event_entity_type := 'dependency';
      event_entity_id := (row_data->>'id')::UUID;
      event_reason := row_data->>'rationale';
    WHEN 'case_evidence' THEN
      event_case_id := (row_data->>'case_id')::UUID;
      event_entity_type := 'evidence';
      event_entity_id := (row_data->>'id')::UUID;
      event_reason := row_data->>'summary';
    WHEN 'case_escalations' THEN
      event_case_id := (row_data->>'case_id')::UUID;
      event_entity_type := 'escalation';
      event_entity_id := (row_data->>'id')::UUID;
      event_reason := row_data->>'reason';
    ELSE
      RAISE EXCEPTION 'unsupported case event table: %', TG_TABLE_NAME;
  END CASE;

  INSERT INTO case_events(case_id, entity_type, entity_id, event_type, actor, reason, snapshot)
  VALUES (
    event_case_id,
    event_entity_type,
    event_entity_id,
    event_entity_type || '_' || lower(TG_OP),
    COALESCE(
      NULLIF(current_setting('app.case_actor', true), ''),
      row_data->>'recorded_by',
      row_data->>'opened_by',
      'system'
    ),
    event_reason,
    row_data - 'change_reason'
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tracked_cases_record_event
AFTER INSERT OR UPDATE ON tracked_cases
FOR EACH ROW EXECUTE FUNCTION record_case_event();

CREATE TRIGGER tracked_case_tasks_record_event
AFTER INSERT OR UPDATE OR DELETE ON tracked_case_tasks
FOR EACH ROW EXECUTE FUNCTION record_case_event();

CREATE TRIGGER case_dependencies_record_event
AFTER INSERT OR UPDATE ON case_dependencies
FOR EACH ROW EXECUTE FUNCTION record_case_event();

CREATE TRIGGER case_evidence_record_event
AFTER INSERT ON case_evidence
FOR EACH ROW EXECUTE FUNCTION record_case_event();

CREATE TRIGGER case_escalations_record_event
AFTER INSERT OR UPDATE ON case_escalations
FOR EACH ROW EXECUTE FUNCTION record_case_event();

CREATE OR REPLACE FUNCTION reject_case_evidence_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'case_evidence is append-only';
END;
$$;

CREATE TRIGGER case_evidence_immutable
BEFORE UPDATE OR DELETE ON case_evidence
FOR EACH ROW EXECUTE FUNCTION reject_case_evidence_mutation();

CREATE OR REPLACE FUNCTION reject_case_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'case_events is append-only';
END;
$$;

CREATE TRIGGER case_events_immutable
BEFORE UPDATE OR DELETE ON case_events
FOR EACH ROW EXECUTE FUNCTION reject_case_event_mutation();

ALTER TABLE tracked_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_case_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_events ENABLE ROW LEVEL SECURITY;

-- Browser roles have no direct access; later authenticated server operations own lifecycle changes.
REVOKE ALL ON tracked_cases FROM anon, authenticated;
REVOKE ALL ON tracked_case_tasks FROM anon, authenticated;
REVOKE ALL ON case_dependencies FROM anon, authenticated;
REVOKE ALL ON case_evidence FROM anon, authenticated;
REVOKE ALL ON case_escalations FROM anon, authenticated;
REVOKE ALL ON case_events FROM anon, authenticated;
