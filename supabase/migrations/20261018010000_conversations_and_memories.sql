-- Explicit conversations, opt-in memory use, and lossless legacy conversion.
ALTER TABLE users ADD COLUMN IF NOT EXISTS use_memory BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE conversations (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issue_id VARCHAR(36) NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    support_style VARCHAR(20) NOT NULL DEFAULT 'discover',
    summary JSON,
    version INTEGER NOT NULL DEFAULT 1,
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL,
    archived_at VARCHAR(40)
);
CREATE INDEX ix_conversations_user_id ON conversations(user_id);
CREATE INDEX ix_conversations_issue_id ON conversations(issue_id);
CREATE TABLE conversation_links (
    conversation_id VARCHAR(36) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    issue_id VARCHAR(36) NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    PRIMARY KEY(conversation_id, issue_id)
);
CREATE TABLE memories (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issue_id VARCHAR(36) REFERENCES issues(id) ON DELETE CASCADE,
    source_conversation_id VARCHAR(36) REFERENCES conversations(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    category VARCHAR(20) NOT NULL DEFAULT 'fact',
    enabled BOOLEAN NOT NULL DEFAULT true,
    version INTEGER NOT NULL DEFAULT 1,
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL
);
CREATE INDEX ix_memories_user_id ON memories(user_id);
INSERT INTO conversations (id, user_id, issue_id, title, support_style, created_at, updated_at, archived_at)
SELECT i.id, i.user_id, i.id, '之前的会话', u.support_style, i.created_at, i.updated_at, i.ended_at
FROM issues i JOIN users u ON u.id = i.user_id;
ALTER TABLE messages ADD COLUMN conversation_id VARCHAR(36) REFERENCES conversations(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN payload JSON;
UPDATE messages SET conversation_id = issue_id WHERE conversation_id IS NULL;
CREATE INDEX ix_messages_conversation_id ON messages(conversation_id);
ALTER TABLE ai_requests ADD COLUMN conversation_id VARCHAR(36) REFERENCES conversations(id) ON DELETE SET NULL;
ALTER TABLE ai_requests ADD COLUMN kind VARCHAR(16) NOT NULL DEFAULT 'chat';
CREATE INDEX ix_ai_requests_conversation_id ON ai_requests(conversation_id);
DROP INDEX IF EXISTS one_active_issue_per_user;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE conversations, conversation_links, memories FROM PUBLIC, anon, authenticated, service_role;
