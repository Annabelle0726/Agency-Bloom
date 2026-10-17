-- Keep self-described context separate from confirmed decision-card facts.
BEGIN;

ALTER TABLE public.users ADD COLUMN support_style VARCHAR(20) NOT NULL DEFAULT 'clarify';
ALTER TABLE public.issues ADD COLUMN life_contexts JSON NOT NULL DEFAULT '[]';

CREATE TABLE public.consents (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    kind VARCHAR(20) NOT NULL,
    accepted BOOLEAN NOT NULL,
    policy_version VARCHAR(20) NOT NULL,
    created_at VARCHAR(40) NOT NULL
);
CREATE INDEX ix_consents_user_id ON public.consents(user_id);
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.consents FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
