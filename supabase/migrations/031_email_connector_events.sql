-- Email connector ingestion stores bounded metadata only; message bodies and addresses are never stored.
CREATE TABLE connector_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector TEXT NOT NULL CHECK (connector = 'email'),
  provider TEXT NOT NULL CHECK (provider ~ '^[a-z][a-z0-9_-]{0,39}$'),
  source_event_id TEXT NOT NULL CHECK (char_length(btrim(source_event_id)) BETWEEN 1 AND 500),
  source_message_id TEXT NOT NULL CHECK (char_length(btrim(source_message_id)) BETWEEN 1 AND 500),
  source_thread_id TEXT CHECK (char_length(btrim(source_thread_id)) BETWEEN 1 AND 500),
  case_id UUID NOT NULL REFERENCES tracked_cases(id) ON DELETE RESTRICT,
  evidence_id UUID NOT NULL REFERENCES case_evidence(id) ON DELETE RESTRICT,
  dependency_id UUID,
  escalation_id UUID REFERENCES case_escalations(id) ON DELETE RESTRICT,
  signal TEXT NOT NULL CHECK (signal IN ('advance', 'block', 'complete')),
  rule TEXT NOT NULL CHECK (
    char_length(rule) BETWEEN 1 AND 100
    AND rule ~ '^[a-z][a-z0-9_.-]*$'
  ),
  summary TEXT NOT NULL CHECK (char_length(btrim(summary)) BETWEEN 1 AND 2000),
  observed_at TIMESTAMPTZ NOT NULL,
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  recorded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (dependency_id, case_id)
    REFERENCES case_dependencies(id, case_id) ON DELETE RESTRICT,
  FOREIGN KEY (evidence_id, case_id)
    REFERENCES case_evidence(id, case_id) ON DELETE RESTRICT,
  CHECK (
    (signal = 'advance' AND dependency_id IS NOT NULL AND escalation_id IS NULL)
    OR (signal = 'block' AND dependency_id IS NULL AND escalation_id IS NOT NULL)
    OR (signal = 'complete' AND dependency_id IS NULL AND escalation_id IS NULL)
  ),
  UNIQUE (connector, provider, source_event_id),
  UNIQUE (evidence_id)
);

CREATE INDEX connector_events_case_observed_idx
  ON connector_events(case_id, observed_at DESC, created_at DESC);

CREATE OR REPLACE FUNCTION reject_connector_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'connector_events is append-only';
END;
$$;

CREATE TRIGGER connector_events_immutable
BEFORE UPDATE OR DELETE ON connector_events
FOR EACH ROW EXECUTE FUNCTION reject_connector_event_mutation();

CREATE OR REPLACE FUNCTION ingest_email_connector_event(
  p_case_id UUID,
  p_provider TEXT,
  p_event_id TEXT,
  p_message_id TEXT,
  p_thread_id TEXT,
  p_observed_at TIMESTAMPTZ,
  p_content_sha256 TEXT,
  p_signal TEXT,
  p_rule TEXT,
  p_summary TEXT,
  p_dependency_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_provider TEXT := lower(btrim(p_provider));
  normalized_event_id TEXT := btrim(p_event_id);
  normalized_message_id TEXT := btrim(p_message_id);
  normalized_thread_id TEXT := NULLIF(btrim(p_thread_id), '');
  normalized_rule TEXT := lower(btrim(p_rule));
  normalized_summary TEXT := btrim(p_summary);
  connector_actor TEXT;
  evidence_source TEXT;
  existing_event connector_events%ROWTYPE;
  created_event connector_events%ROWTYPE;
  current_case tracked_cases%ROWTYPE;
  evidence_row case_evidence%ROWTYPE;
  dependency_row case_dependencies%ROWTYPE;
  escalation_row case_escalations%ROWTYPE;
  reconciliation_result JSONB;
BEGIN
  IF normalized_provider IS NULL
    OR normalized_provider !~ '^[a-z][a-z0-9_-]{0,39}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_email_connector_provider';
  END IF;
  IF normalized_event_id IS NULL OR char_length(normalized_event_id) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_email_connector_event_id';
  END IF;
  IF normalized_message_id IS NULL OR char_length(normalized_message_id) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_email_connector_message_id';
  END IF;
  IF normalized_thread_id IS NOT NULL AND char_length(normalized_thread_id) > 500 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_email_connector_thread_id';
  END IF;
  IF p_observed_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_email_connector_observed_at';
  END IF;
  IF p_content_sha256 IS NULL OR lower(p_content_sha256) !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_email_connector_content_hash';
  END IF;
  IF p_signal NOT IN ('advance', 'block', 'complete') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_email_connector_signal';
  END IF;
  IF normalized_rule IS NULL
    OR char_length(normalized_rule) NOT BETWEEN 1 AND 100
    OR normalized_rule !~ '^[a-z][a-z0-9_.-]*$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_email_connector_rule';
  END IF;
  IF normalized_summary IS NULL OR char_length(normalized_summary) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_email_connector_summary';
  END IF;
  IF p_signal = 'advance' AND p_dependency_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'email_connector_dependency_required';
  END IF;
  IF p_signal <> 'advance' AND p_dependency_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'email_connector_dependency_not_allowed';
  END IF;

  connector_actor := 'connector:email:' || normalized_provider;
  evidence_source := 'email_' || normalized_provider;

  -- Serialize one external identity before checking or applying any side effect.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('email' || E'\\x1f' || normalized_provider || E'\\x1f' || normalized_event_id, 0)
  );
  SELECT * INTO existing_event
  FROM connector_events
  WHERE connector = 'email'
    AND provider = normalized_provider
    AND source_event_id = normalized_event_id
  FOR UPDATE;

  IF FOUND THEN
    IF existing_event.case_id <> p_case_id
      OR existing_event.source_message_id <> normalized_message_id
      OR existing_event.source_thread_id IS DISTINCT FROM normalized_thread_id
      OR existing_event.observed_at <> p_observed_at
      OR existing_event.content_sha256 <> lower(p_content_sha256)
      OR existing_event.signal <> p_signal
      OR existing_event.rule <> normalized_rule
      OR existing_event.summary <> normalized_summary
      OR existing_event.dependency_id IS DISTINCT FROM p_dependency_id THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'email_connector_event_idempotency_conflict';
    END IF;

    SELECT * INTO current_case FROM tracked_cases WHERE id = existing_event.case_id;
    SELECT * INTO evidence_row FROM case_evidence WHERE id = existing_event.evidence_id;
    IF existing_event.dependency_id IS NOT NULL THEN
      SELECT * INTO dependency_row FROM case_dependencies WHERE id = existing_event.dependency_id;
    END IF;
    IF existing_event.escalation_id IS NOT NULL THEN
      SELECT * INTO escalation_row FROM case_escalations WHERE id = existing_event.escalation_id;
    END IF;

    RETURN jsonb_build_object(
      'event', to_jsonb(existing_event),
      'case', to_jsonb(current_case),
      'evidence', to_jsonb(evidence_row),
      'dependency', CASE WHEN dependency_row.id IS NULL THEN NULL ELSE to_jsonb(dependency_row) END,
      'escalation', CASE WHEN escalation_row.id IS NULL THEN NULL ELSE to_jsonb(escalation_row) END,
      'replayed', true
    );
  END IF;

  SELECT * INTO current_case
  FROM tracked_cases
  WHERE id = p_case_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'tracked_case_not_found';
  END IF;
  IF current_case.status = 'cancelled'
    OR (current_case.status = 'completed' AND p_signal <> 'complete') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'email_connector_terminal_case_conflict';
  END IF;

  reconciliation_result := reconcile_case_evidence(
    p_case_id,
    'message',
    normalized_summary,
    evidence_source,
    normalized_event_id,
    p_observed_at,
    lower(p_content_sha256),
    CASE
      WHEN p_signal = 'advance' THEN 'satisfy_dependency'
      WHEN p_signal = 'block' THEN 'raise_exception'
      ELSE 'record_only'
    END,
    normalized_rule,
    CASE WHEN p_signal = 'advance' THEN p_dependency_id ELSE NULL END,
    CASE WHEN p_signal = 'block' THEN 'warning' ELSE NULL END,
    CASE WHEN p_signal = 'block' THEN normalized_summary ELSE NULL END,
    connector_actor
  );

  evidence_row := jsonb_populate_record(NULL::case_evidence, reconciliation_result->'evidence');
  IF p_signal = 'advance' THEN
    dependency_row := jsonb_populate_record(NULL::case_dependencies, reconciliation_result->'dependency');
  ELSIF p_signal = 'block' THEN
    escalation_row := jsonb_populate_record(NULL::case_escalations, reconciliation_result->'escalation');
  END IF;

  IF p_signal = 'block'
    AND (current_case.status <> 'blocked' OR current_case.automation_state <> 'awaiting_approval') THEN
    PERFORM set_config('app.case_actor', connector_actor, true);
    PERFORM set_config(
      'app.case_reason',
      'Email connector event ' || normalized_provider || ':' || normalized_event_id
        || ' matched ' || normalized_rule,
      true
    );
    UPDATE tracked_cases
    SET
      status = 'blocked',
      automation_state = 'awaiting_approval',
      change_reason = 'Email connector reported a blocking event'
    WHERE id = p_case_id
    RETURNING * INTO current_case;
  ELSIF p_signal = 'complete'
    AND (current_case.status <> 'completed' OR current_case.automation_state <> 'finished') THEN
    PERFORM set_config('app.case_actor', connector_actor, true);
    PERFORM set_config(
      'app.case_reason',
      'Email connector event ' || normalized_provider || ':' || normalized_event_id
        || ' matched ' || normalized_rule,
      true
    );
    UPDATE tracked_cases
    SET
      status = 'completed',
      automation_state = 'finished',
      change_reason = 'Email connector reported completion'
    WHERE id = p_case_id
    RETURNING * INTO current_case;
  END IF;

  INSERT INTO connector_events(
    connector,
    provider,
    source_event_id,
    source_message_id,
    source_thread_id,
    case_id,
    evidence_id,
    dependency_id,
    escalation_id,
    signal,
    rule,
    summary,
    observed_at,
    content_sha256,
    recorded_by
  ) VALUES (
    'email',
    normalized_provider,
    normalized_event_id,
    normalized_message_id,
    normalized_thread_id,
    p_case_id,
    evidence_row.id,
    CASE WHEN p_signal = 'advance' THEN dependency_row.id ELSE NULL END,
    CASE WHEN p_signal = 'block' THEN escalation_row.id ELSE NULL END,
    p_signal,
    normalized_rule,
    normalized_summary,
    p_observed_at,
    lower(p_content_sha256),
    connector_actor
  ) RETURNING * INTO created_event;

  RETURN jsonb_build_object(
    'event', to_jsonb(created_event),
    'case', to_jsonb(current_case),
    'evidence', to_jsonb(evidence_row),
    'dependency', CASE WHEN dependency_row.id IS NULL THEN NULL ELSE to_jsonb(dependency_row) END,
    'escalation', CASE WHEN escalation_row.id IS NULL THEN NULL ELSE to_jsonb(escalation_row) END,
    'replayed', false
  );
END;
$$;

ALTER TABLE connector_events ENABLE ROW LEVEL SECURITY;

-- Only the authenticated server boundary may ingest or inspect connector events.
REVOKE ALL ON connector_events FROM anon, authenticated;
REVOKE ALL ON FUNCTION ingest_email_connector_event(
  UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, UUID
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ingest_email_connector_event(
  UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, UUID
) TO service_role;
