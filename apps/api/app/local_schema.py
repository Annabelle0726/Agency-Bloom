"""Additive development-only upgrade for the first local alpha database."""

from sqlalchemy import inspect

from .models import now


def upgrade_local(engine):
    additions = {
        "conversations": {
            "dismissed_change_ids": "JSON NOT NULL DEFAULT '[]'",
            "pinned_at": "VARCHAR(40)",
        },
        "memories": {
            "horizon": "VARCHAR(20) NOT NULL DEFAULT 'long_term'",
            "status": "VARCHAR(20) NOT NULL DEFAULT 'active'",
            "source": "VARCHAR(30) NOT NULL DEFAULT 'user_confirmed'",
            "confirmed_at": "VARCHAR(40)",
            "last_verified_at": "VARCHAR(40)",
        },
        "users": {
            "support_style": "VARCHAR(20) NOT NULL DEFAULT 'clarify'",
            "use_memory": "BOOLEAN NOT NULL DEFAULT 0",
        },
        "issues": {
            "life_contexts": "JSON NOT NULL DEFAULT '[]'",
            "exploration": "JSON NOT NULL DEFAULT '{}'",
        },
        "ai_requests": {
            "usage": "JSON",
            "kind": "VARCHAR(16) NOT NULL DEFAULT 'chat'",
            "conversation_id": "VARCHAR(36) REFERENCES conversations(id) ON DELETE SET NULL",
        },
        "messages": {
            "conversation_id": "VARCHAR(36) REFERENCES conversations(id) ON DELETE CASCADE",
            "payload": "JSON",
        },
    }
    with engine.begin() as connection:
        inspector = inspect(connection)
        legacy_messages = "conversation_id" not in {
            column["name"] for column in inspector.get_columns("messages")
        }
        for table, columns in additions.items():
            existing = {column["name"] for column in inspector.get_columns(table)}
            for name, definition in columns.items():
                if name not in existing:
                    connection.exec_driver_sql(
                        f"ALTER TABLE {table} ADD COLUMN {name} {definition}"
                    )
        connection.exec_driver_sql("DROP INDEX IF EXISTS one_active_issue_per_user")
        # Product decision 2026-10-19: retention defaults on. The one-time
        # backfill must not undo a deliberate opt-out made after this upgrade,
        # and must tolerate pre-alpha schemas without the column.
        user_columns = {column["name"] for column in inspector.get_columns("users")}
        if "save_chat" in user_columns:
            connection.exec_driver_sql("""
            CREATE TABLE IF NOT EXISTS default_flags (
                key VARCHAR(40) PRIMARY KEY,
                applied_at VARCHAR(40) NOT NULL
            )
            """)
            marker = connection.exec_driver_sql(
                "SELECT 1 FROM default_flags WHERE key = 'chat_retention_on'"
            ).fetchone()
            if marker is None:
                connection.exec_driver_sql("UPDATE users SET save_chat = 1")
                connection.exec_driver_sql(
                    "INSERT INTO default_flags (key, applied_at) VALUES ('chat_retention_on', '"
                    + now() + "')"
                )
        # Backfill only while upgrading the legacy schema. Later startups must
        # never resurrect a conversation that the user explicitly deleted.
        if legacy_messages:
            connection.exec_driver_sql("""
            INSERT INTO conversations (id, user_id, issue_id, title, support_style, version, dismissed_change_ids,
                                       created_at, updated_at, archived_at)
            SELECT i.id, i.user_id, i.id, '之前的会话', u.support_style, 1, '[]',
                   i.created_at, i.updated_at, i.ended_at
            FROM issues i JOIN users u ON u.id = i.user_id
            WHERE NOT EXISTS (SELECT 1 FROM conversations c WHERE c.id = i.id)
            """)
            connection.exec_driver_sql(
                "UPDATE messages SET conversation_id = issue_id WHERE conversation_id IS NULL"
            )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_messages_conversation_id ON messages(conversation_id)"
        )
