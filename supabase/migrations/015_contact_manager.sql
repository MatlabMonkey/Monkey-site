CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE OR REPLACE FUNCTION public.set_row_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL CHECK (char_length(btrim(user_id)) > 0),
  name TEXT,
  job_title TEXT,
  company TEXT,
  industry TEXT,
  location TEXT,
  where_met TEXT,
  interests TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  past_companies TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  notes TEXT,
  raw_transcript TEXT NOT NULL CHECK (char_length(btrim(raw_transcript)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_user_email_unique
  ON contacts(user_id, lower(email))
  WHERE email IS NOT NULL AND btrim(email) <> '';

CREATE INDEX IF NOT EXISTS idx_contacts_user_updated
  ON contacts(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_contacts_user_name_company
  ON contacts(user_id, name, company);

CREATE INDEX IF NOT EXISTS idx_contacts_tags
  ON contacts USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_contacts_interests
  ON contacts USING GIN(interests);

CREATE INDEX IF NOT EXISTS idx_contacts_text_search
  ON contacts
  USING GIN (
    to_tsvector(
      'simple',
      coalesce(name, '') || ' ' ||
      coalesce(job_title, '') || ' ' ||
      coalesce(company, '') || ' ' ||
      coalesce(industry, '') || ' ' ||
      coalesce(location, '') || ' ' ||
      coalesce(where_met, '') || ' ' ||
      coalesce(notes, '') || ' ' ||
      coalesce(raw_transcript, '') || ' ' ||
      array_to_string(coalesce(tags, ARRAY[]::TEXT[]), ' ') || ' ' ||
      array_to_string(coalesce(interests, ARRAY[]::TEXT[]), ' ')
    )
  );

DROP TRIGGER IF EXISTS contacts_set_updated_at ON contacts;
CREATE TRIGGER contacts_set_updated_at
BEFORE UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION public.set_row_updated_at();

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contacts'
      AND policyname = 'contacts_select_own'
  ) THEN
    CREATE POLICY "contacts_select_own"
      ON contacts FOR SELECT
      USING (auth.uid()::TEXT = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contacts'
      AND policyname = 'contacts_insert_own'
  ) THEN
    CREATE POLICY "contacts_insert_own"
      ON contacts FOR INSERT
      WITH CHECK (auth.uid()::TEXT = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contacts'
      AND policyname = 'contacts_update_own'
  ) THEN
    CREATE POLICY "contacts_update_own"
      ON contacts FOR UPDATE
      USING (auth.uid()::TEXT = user_id)
      WITH CHECK (auth.uid()::TEXT = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contacts'
      AND policyname = 'contacts_delete_own'
  ) THEN
    CREATE POLICY "contacts_delete_own"
      ON contacts FOR DELETE
      USING (auth.uid()::TEXT = user_id);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS contact_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL CHECK (char_length(btrim(user_id)) > 0),
  embedding VECTOR(1536) NOT NULL,
  content_text TEXT NOT NULL,
  content_hash TEXT NOT NULL CHECK (char_length(content_hash) = 64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_embeddings_user_id
  ON contact_embeddings(user_id);

CREATE INDEX IF NOT EXISTS idx_contact_embeddings_vector
  ON contact_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

DROP TRIGGER IF EXISTS contact_embeddings_set_updated_at ON contact_embeddings;
CREATE TRIGGER contact_embeddings_set_updated_at
BEFORE UPDATE ON contact_embeddings
FOR EACH ROW
EXECUTE FUNCTION public.set_row_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_contact_embedding_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM contacts c
    WHERE c.id = NEW.contact_id
      AND c.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'contact_embeddings.user_id must match contacts.user_id for contact_id %', NEW.contact_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contact_embeddings_user_id_guard ON contact_embeddings;
CREATE TRIGGER contact_embeddings_user_id_guard
BEFORE INSERT OR UPDATE ON contact_embeddings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_contact_embedding_user_id();

ALTER TABLE contact_embeddings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contact_embeddings'
      AND policyname = 'contact_embeddings_select_own'
  ) THEN
    CREATE POLICY "contact_embeddings_select_own"
      ON contact_embeddings FOR SELECT
      USING (auth.uid()::TEXT = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contact_embeddings'
      AND policyname = 'contact_embeddings_insert_own'
  ) THEN
    CREATE POLICY "contact_embeddings_insert_own"
      ON contact_embeddings FOR INSERT
      WITH CHECK (auth.uid()::TEXT = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contact_embeddings'
      AND policyname = 'contact_embeddings_update_own'
  ) THEN
    CREATE POLICY "contact_embeddings_update_own"
      ON contact_embeddings FOR UPDATE
      USING (auth.uid()::TEXT = user_id)
      WITH CHECK (auth.uid()::TEXT = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contact_embeddings'
      AND policyname = 'contact_embeddings_delete_own'
  ) THEN
    CREATE POLICY "contact_embeddings_delete_own"
      ON contact_embeddings FOR DELETE
      USING (auth.uid()::TEXT = user_id);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.match_contact_embeddings(
  query_user_id TEXT,
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.15,
  match_count INT DEFAULT 20
)
RETURNS TABLE (
  contact_id UUID,
  similarity FLOAT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    ce.contact_id,
    1 - (ce.embedding <=> query_embedding) AS similarity
  FROM contact_embeddings ce
  WHERE ce.user_id = query_user_id
    AND (1 - (ce.embedding <=> query_embedding)) >= match_threshold
  ORDER BY ce.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.match_contact_embeddings(TEXT, VECTOR(1536), FLOAT, INT)
TO authenticated, service_role;
