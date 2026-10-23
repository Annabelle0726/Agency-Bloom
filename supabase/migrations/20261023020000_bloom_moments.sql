-- On-demand experiences, separate from conversations, memories and usage receipts.
CREATE TABLE IF NOT EXISTS public.bloom_moments (
  id varchar(36) PRIMARY KEY,
  user_id varchar(36) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  request_key varchar(64) NOT NULL UNIQUE REFERENCES public.ai_requests(id),
  day varchar(10) NOT NULL,
  ordinal integer NOT NULL,
  kind varchar(20) NOT NULL,
  content json,
  fingerprint varchar(64) NOT NULL DEFAULT '',
  dismissed boolean NOT NULL DEFAULT false,
  created_at varchar(40) NOT NULL,
  UNIQUE (user_id, day, ordinal)
);
CREATE INDEX IF NOT EXISTS ix_bloom_moments_user_id ON public.bloom_moments(user_id);
ALTER TABLE public.bloom_moments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bloom_moments FROM anon, authenticated, service_role;
