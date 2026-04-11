"""Alembic environment configuration for both offline and online migrations."""

from __future__ import annotations

# pylint: disable=import-error,no-member,wrong-import-position

import sys
from logging.config import fileConfig
from pathlib import Path
from typing import Any

# Load .env BEFORE importing app config
from dotenv import load_dotenv
backend_dir = Path(__file__).resolve().parent.parent
env_path = backend_dir / ".env"
if env_path.exists():
    # Keep explicit environment variables (e.g., Docker env_file) as source of truth.
    load_dotenv(str(env_path), override=False)

from alembic import context
from sqlalchemy import engine_from_config, pool

# Ensure project package is on sys.path for imports during migration runs.
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

from app.core.config import settings
from app.db.base import Base, import_models

# Alias Alembic context as Any to avoid attr-defined lint noise.
alembic_context: Any = context

# Alembic Config object
config = alembic_context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override DB URL from runtime settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    import_models()
    url = config.get_main_option("sqlalchemy.url")
    alembic_context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
    )

    with alembic_context.begin_transaction():
        alembic_context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    import_models()
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        alembic_context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with alembic_context.begin_transaction():
            alembic_context.run_migrations()


if alembic_context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
