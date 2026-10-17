"""Additive development-only upgrade for the first local alpha database."""

from sqlalchemy import inspect


def upgrade_local(engine):
    additions = {
        "users": {"support_style": "VARCHAR(20) NOT NULL DEFAULT 'clarify'"},
        "issues": {
            "life_contexts": "JSON NOT NULL DEFAULT '[]'",
            "exploration": "JSON NOT NULL DEFAULT '{}'",
        },
        "ai_requests": {"usage": "JSON"},
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
