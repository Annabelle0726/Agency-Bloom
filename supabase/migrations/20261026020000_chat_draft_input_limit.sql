-- Keep retained composer text consistent with the chat request and native input.
ALTER TABLE chat_drafts DROP CONSTRAINT IF EXISTS chat_drafts_content_check;
ALTER TABLE chat_drafts ADD CONSTRAINT chat_drafts_content_check CHECK (char_length(content) <= 4000);
-- Retain provenance so restored generated excerpts can be revalidated before use.
ALTER TABLE chat_drafts ADD COLUMN IF NOT EXISTS source_refs JSON NOT NULL DEFAULT '[]';
