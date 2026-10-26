-- Preserve partial questionnaire answers independently of chat retention.
-- The API validates Q1 on completion; empty/incomplete JSON drafts remain valid.
-- API ownership is derived from the authenticated account, never a supplied user_id.
-- Completed rows are version tombstones; final issue creation completes the row
-- within the same database transaction, preventing stale draft resurrection.
CREATE TABLE IF NOT EXISTS onboarding_progress (
    user_id VARCHAR(36) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    step INTEGER NOT NULL DEFAULT 0 CHECK (step BETWEEN 0 AND 4),
    status VARCHAR(16) NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'paused', 'completed')),
    answers JSONB,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    updated_at VARCHAR(40) NOT NULL,
    CONSTRAINT onboarding_progress_answers_shape CHECK (
        (status = 'completed' AND step = 4 AND answers IS NULL)
        OR
        (status <> 'completed' AND answers IS NOT NULL
         AND jsonb_typeof(answers) = 'object'
         AND octet_length(answers::text) <= 65536)
    )
);

-- The backend uses its database connection and custom account sessions.
-- Supabase client JWTs must not bypass ownership/version checks through PostgREST.
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE onboarding_progress FROM PUBLIC, anon, authenticated, service_role;
