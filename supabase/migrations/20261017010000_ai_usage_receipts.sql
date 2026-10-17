-- Additive only: preserve historical requests and all existing budget balances.
ALTER TABLE public.ai_requests ADD COLUMN IF NOT EXISTS usage JSON;
