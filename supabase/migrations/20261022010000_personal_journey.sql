-- Explicitly saved milestones only. Pending AI insights remain in retained messages.
CREATE TABLE IF NOT EXISTS public.journey_records (
    id varchar(36) PRIMARY KEY,
    user_id varchar(36) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    issue_id varchar(36) NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
    source_message_id varchar(36) UNIQUE REFERENCES public.messages(id) ON DELETE SET NULL,
    status varchar(16) NOT NULL DEFAULT 'confirmed',
    kind varchar(16) NOT NULL DEFAULT 'thought',
    title varchar(120) NOT NULL DEFAULT '',
    text text NOT NULL DEFAULT '',
    version integer NOT NULL DEFAULT 1,
    created_at varchar(40) NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_journey_records_user_id ON public.journey_records(user_id);
CREATE INDEX IF NOT EXISTS ix_journey_records_issue_id ON public.journey_records(issue_id);
ALTER TABLE public.journey_records ENABLE ROW LEVEL SECURITY;
-- Access is through the authenticated backend only; no public client grants.
REVOKE ALL ON public.journey_records FROM anon, authenticated, service_role;
