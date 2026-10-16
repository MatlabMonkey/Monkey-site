-- Keep capture provenance and audit history on the canonical todos model.
-- V1 intentionally does not introduce capture queues, jobs, source registries,
-- or routing-rule tables.

ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS source_id TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'todos_source_id_unique'
  ) THEN
    ALTER TABLE todos
      ADD CONSTRAINT todos_source_id_unique UNIQUE (context, source, source_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'todos_idempotency_key_unique'
  ) THEN
    ALTER TABLE todos
      ADD CONSTRAINT todos_idempotency_key_unique UNIQUE (context, source, idempotency_key);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS todo_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT todo_events_type_check
    CHECK (event_type IN ('todo.created', 'todo.updated', 'todo.deleted'))
);

CREATE INDEX IF NOT EXISTS idx_todo_events_todo_created
  ON todo_events(todo_id, created_at DESC);

ALTER TABLE todo_events ENABLE ROW LEVEL SECURITY;

-- Event writes happen through the todos trigger. Direct public access remains
-- closed; trusted server code can read the history with the service role.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'todo_events'
      AND policyname = 'No public todo event access'
  ) THEN
    CREATE POLICY "No public todo event access"
      ON todo_events FOR ALL USING (false) WITH CHECK (false);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION record_todo_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO todo_events (todo_id, event_type, source, after_state)
    VALUES (NEW.id, 'todo.created', NEW.source, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO todo_events (todo_id, event_type, source, before_state, after_state)
    VALUES (NEW.id, 'todo.updated', NEW.source, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  END IF;

  INSERT INTO todo_events (todo_id, event_type, source, before_state)
  VALUES (OLD.id, 'todo.deleted', OLD.source, to_jsonb(OLD));
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS todos_record_event ON todos;
CREATE TRIGGER todos_record_event
AFTER INSERT OR UPDATE OR DELETE ON todos
FOR EACH ROW EXECUTE FUNCTION record_todo_event();

CREATE OR REPLACE FUNCTION reject_todo_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'todo_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS todo_events_append_only ON todo_events;
CREATE TRIGGER todo_events_append_only
BEFORE UPDATE OR DELETE ON todo_events
FOR EACH ROW EXECUTE FUNCTION reject_todo_event_mutation();
