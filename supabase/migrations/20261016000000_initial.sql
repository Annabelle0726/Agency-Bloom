-- Agency Bloom initial schema. Apply using Supabase CLI migrations.
-- All client access goes through FastAPI; no direct Data API access.
BEGIN;

CREATE TABLE budgets (
	month VARCHAR(7) NOT NULL,
	used_micro INTEGER NOT NULL,
	PRIMARY KEY (month)
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.budgets FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE users (
	id VARCHAR(36) NOT NULL,
	wechat_id VARCHAR(128),
	save_chat BOOLEAN NOT NULL,
	ai_consent BOOLEAN NOT NULL,
	theme VARCHAR(16) NOT NULL,
	created_at VARCHAR(40) NOT NULL,
	PRIMARY KEY (id),
	UNIQUE (wechat_id)
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.users FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE ai_requests (
	id VARCHAR(64) NOT NULL,
	user_id VARCHAR(36),
	month VARCHAR(7) NOT NULL,
	cost_micro INTEGER NOT NULL,
	status VARCHAR(20) NOT NULL,
	created_at VARCHAR(40) NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_ai_requests_user_id ON ai_requests (user_id);

ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_requests FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE auth_sessions (
	token_hash VARCHAR(64) NOT NULL,
	user_id VARCHAR(36) NOT NULL,
	expires_at VARCHAR(40) NOT NULL,
	PRIMARY KEY (token_hash),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_auth_sessions_user_id ON auth_sessions (user_id);

ALTER TABLE public.auth_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.auth_sessions FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE issues (
	id VARCHAR(36) NOT NULL,
	user_id VARCHAR(36) NOT NULL,
	title VARCHAR(120) NOT NULL,
	concerns JSON NOT NULL,
	stage VARCHAR(32) NOT NULL,
	background TEXT NOT NULL,
	card JSON NOT NULL,
	version INTEGER NOT NULL,
	created_at VARCHAR(40) NOT NULL,
	updated_at VARCHAR(40) NOT NULL,
	ended_at VARCHAR(40),
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX one_active_issue_per_user ON issues (user_id) WHERE ended_at IS NULL;

CREATE INDEX ix_issues_user_id ON issues (user_id);

ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.issues FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE feedback (
	id VARCHAR(36) NOT NULL,
	issue_id VARCHAR(36) NOT NULL,
	kind VARCHAR(16) NOT NULL,
	text TEXT NOT NULL,
	created_at VARCHAR(40) NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(issue_id) REFERENCES issues (id) ON DELETE CASCADE
);

CREATE INDEX ix_feedback_issue_id ON feedback (issue_id);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.feedback FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE messages (
	id VARCHAR(36) NOT NULL,
	issue_id VARCHAR(36) NOT NULL,
	role VARCHAR(16) NOT NULL,
	content TEXT NOT NULL,
	created_at VARCHAR(40) NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(issue_id) REFERENCES issues (id) ON DELETE CASCADE
);

CREATE INDEX ix_messages_issue_id ON messages (issue_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.messages FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
