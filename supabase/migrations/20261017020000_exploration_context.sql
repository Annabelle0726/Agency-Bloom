-- Additive only: preserve existing issues, cards, accounts and budget ledger
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS exploration JSON NOT NULL DEFAULT '{}';
