-- Extend the existing owned memory store; no inferred profiles or new grants.
ALTER TABLE public.memories
    ADD COLUMN IF NOT EXISTS horizon varchar(20) NOT NULL DEFAULT 'long_term',
    ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS source varchar(30) NOT NULL DEFAULT 'user_confirmed',
    ADD COLUMN IF NOT EXISTS confirmed_at varchar(40),
    ADD COLUMN IF NOT EXISTS last_verified_at varchar(40);
-- Legacy verification timestamps remain unknown, rather than inventing consent.
ALTER TABLE public.conversations
    ADD COLUMN IF NOT EXISTS dismissed_change_ids json NOT NULL DEFAULT '[]';
