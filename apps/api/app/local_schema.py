"""Additive development-only upgrade for the first local alpha database."""

from sqlalchemy import inspect


def upgrade_local(engine):
    additions = {
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
        for table, columns in additions.items():
            existing = {column["name"] for column in inspector.get_columns(table)}
            for name, definition in columns.items():
                if name not in existing:
                    connection.exec_driver_sql(
                        f"ALTER TABLE {table} ADD COLUMN {name} {definition}"
                    )
        connection.exec_driver_sql("DROP INDEX IF EXISTS one_active_issue_per_user")
        # Stable IDs make legacy conversion idempotent. No transcript inference or deletion.
        connection.exec_driver_sql("""
            INSERT INTO conversations (id, user_id, issue_id, title, support_style, version,
                                       created_at, updated_at, archived_at)
            SELECT i.id, i.user_id, i.id, '之前的会话', u.support_style, 1,
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
