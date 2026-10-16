-- Shared PIN brute-force state for serverless instances. Only service-role RPCs
-- may touch the table; client identifiers are one-way hashes created server-side.
CREATE TABLE IF NOT EXISTS public.pin_auth_attempts (
  client_hash text PRIMARY KEY CHECK (client_hash ~ '^[0-9a-f]{64}$'),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pin_auth_attempts_updated_at_idx
ON public.pin_auth_attempts (updated_at);

ALTER TABLE public.pin_auth_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pin_auth_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pin_auth_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.check_pin_auth_lockout(
  p_client_hash text,
  p_now timestamptz DEFAULT now()
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_lock timestamptz;
BEGIN
  IF p_client_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid client hash';
  END IF;

  SELECT locked_until INTO current_lock
  FROM public.pin_auth_attempts
  WHERE client_hash = p_client_hash;

  IF current_lock IS NULL OR current_lock <= p_now THEN
    RETURN 0;
  END IF;

  RETURN GREATEST(1, ceil(extract(epoch FROM (current_lock - p_now)))::integer);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_pin_auth_failure(
  p_client_hash text,
  p_now timestamptz,
  p_window_seconds integer,
  p_max_attempts integer,
  p_lockout_seconds integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_row public.pin_auth_attempts%ROWTYPE;
BEGIN
  IF p_client_hash !~ '^[0-9a-f]{64}$' OR p_window_seconds <= 0 OR p_max_attempts <= 0 OR p_lockout_seconds <= 0 THEN
    RAISE EXCEPTION 'invalid rate-limit arguments';
  END IF;

  INSERT INTO public.pin_auth_attempts (client_hash, attempt_count, window_started_at, updated_at)
  VALUES (p_client_hash, 0, p_now, p_now)
  ON CONFLICT (client_hash) DO NOTHING;

  SELECT * INTO current_row
  FROM public.pin_auth_attempts
  WHERE client_hash = p_client_hash
  FOR UPDATE;

  IF current_row.locked_until IS NOT NULL AND current_row.locked_until > p_now THEN
    RETURN GREATEST(1, ceil(extract(epoch FROM (current_row.locked_until - p_now)))::integer);
  END IF;

  IF current_row.window_started_at + make_interval(secs => p_window_seconds) <= p_now THEN
    current_row.attempt_count := 0;
    current_row.window_started_at := p_now;
  END IF;

  current_row.attempt_count := current_row.attempt_count + 1;
  IF current_row.attempt_count >= p_max_attempts THEN
    current_row.attempt_count := 0;
    current_row.window_started_at := p_now;
    current_row.locked_until := p_now + make_interval(secs => p_lockout_seconds);
  ELSE
    current_row.locked_until := NULL;
  END IF;

  UPDATE public.pin_auth_attempts
  SET attempt_count = current_row.attempt_count,
      window_started_at = current_row.window_started_at,
      locked_until = current_row.locked_until,
      updated_at = p_now
  WHERE client_hash = p_client_hash;

  RETURN CASE
    WHEN current_row.locked_until IS NULL THEN 0
    ELSE GREATEST(1, ceil(extract(epoch FROM (current_row.locked_until - p_now)))::integer)
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_pin_auth_failures(p_client_hash text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  DELETE FROM public.pin_auth_attempts WHERE client_hash = p_client_hash;
$$;

REVOKE ALL ON FUNCTION public.check_pin_auth_lockout(text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_pin_auth_failure(text, timestamptz, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_pin_auth_failures(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_pin_auth_lockout(text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_pin_auth_failure(text, timestamptz, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_pin_auth_failures(text) TO service_role;

COMMENT ON TABLE public.pin_auth_attempts IS 'Server-only shared PIN brute-force counters keyed by one-way client hashes.';
