-- Allow INSERT and UPDATE on question_catalog for import scripts and future question management
-- SELECT is already allowed (read-only for all)

CREATE POLICY "Allow insert on question_catalog" ON question_catalog FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on question_catalog" ON question_catalog FOR UPDATE USING (true);
