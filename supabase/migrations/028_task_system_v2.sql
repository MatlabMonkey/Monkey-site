-- Clean-slate task system. Legacy `todos` data is intentionally not migrated.
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 500),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'inbox'
    CHECK (status IN ('inbox', 'today', 'waiting', 'later', 'done', 'archived')),
  due_on DATE,
  waiting_on TEXT,
  source TEXT NOT NULL DEFAULT 'web',
  source_id TEXT,
  idempotency_key TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX tasks_source_id_unique
  ON tasks(source, source_id) WHERE source_id IS NOT NULL;
CREATE UNIQUE INDEX tasks_idempotency_key_unique
  ON tasks(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX tasks_status_due_created_idx ON tasks(status, due_on, created_at);

CREATE TABLE task_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('captured', 'updated', 'status_changed', 'completed', 'archived')),
  actor TEXT NOT NULL DEFAULT 'user',
  before_state JSONB,
  after_state JSONB NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX task_events_task_created_idx ON task_events(task_id, created_at DESC);
CREATE INDEX task_events_created_idx ON task_events(created_at DESC);

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

  INSERT INTO task_events(task_id, event_type, before_state, after_state, reason)
  VALUES (
    NEW.id,
    event_name,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) - 'change_reason' END,
    to_jsonb(NEW) - 'change_reason',
    NEW.change_reason
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION prepare_task_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.title := btrim(NEW.title);
  NEW.notes := NULLIF(btrim(NEW.notes), '');
  NEW.waiting_on := NULLIF(btrim(NEW.waiting_on), '');

  IF TG_OP = 'UPDATE' THEN
    NEW.version := OLD.version + 1;
    NEW.updated_at := now();
  END IF;

  IF NEW.status = 'done' AND (TG_OP = 'INSERT' OR OLD.status <> 'done') THEN
    NEW.completed_at := now();
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'done' AND NEW.status <> 'done' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_prepare_change
BEFORE INSERT OR UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION prepare_task_change();

CREATE TRIGGER tasks_record_event
AFTER INSERT OR UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION record_task_event();

CREATE OR REPLACE FUNCTION reject_task_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'task_events is append-only';
END;
$$;

CREATE TRIGGER task_events_immutable
BEFORE UPDATE OR DELETE ON task_events
FOR EACH ROW EXECUTE FUNCTION reject_task_event_mutation();

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_events ENABLE ROW LEVEL SECURITY;

-- The app uses its server-only service role. Browser clients receive no table policy.
REVOKE ALL ON tasks FROM anon, authenticated;
REVOKE ALL ON task_events FROM anon, authenticated;
