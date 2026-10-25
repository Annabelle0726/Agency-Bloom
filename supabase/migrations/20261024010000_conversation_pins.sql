-- Account-owned presentation metadata, independent of transcript retention.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pinned_at VARCHAR(40);
CREATE INDEX IF NOT EXISTS ix_conversations_pinned_order
    ON conversations(user_id, pinned_at DESC NULLS LAST, updated_at DESC);
