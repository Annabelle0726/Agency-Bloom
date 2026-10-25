-- Unsent text stays separate from messages, AI context, and conversation ordering.
-- Empty rows are version tombstones: stale clients cannot resurrect cleared text.
CREATE TABLE IF NOT EXISTS chat_drafts (
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key VARCHAR(80) NOT NULL,
    conversation_id VARCHAR(36) REFERENCES conversations(id) ON DELETE CASCADE,
    issue_id VARCHAR(36) REFERENCES issues(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '' CHECK (char_length(content) <= 2000),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    updated_at VARCHAR(40) NOT NULL,
    PRIMARY KEY (user_id, key)
);
CREATE INDEX IF NOT EXISTS ix_chat_drafts_conversation_id ON chat_drafts(conversation_id);
ALTER TABLE chat_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE chat_drafts FROM PUBLIC, anon, authenticated, service_role;
