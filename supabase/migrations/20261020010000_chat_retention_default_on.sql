-- Product decision 2026-10-19: full chat retention is on by default.
-- New accounts start with save_chat = true; existing accounts are switched
-- on once so no transcript is lost behind the old default. Turning the
-- preference off still purges messages and summaries immediately.
ALTER TABLE public.users ALTER COLUMN save_chat SET DEFAULT true;
UPDATE public.users SET save_chat = true;
