from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    APP_NAME: str
    APP_VERSION: str
    ENVIRONMENT: str

    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Optional full DB URL (recommended for Supabase/shared cloud DB)
    DATABASE_URL_OVERRIDE: str = Field(default="", validation_alias="DATABASE_URL")

    # Fallback PostgreSQL parts (used when DATABASE_URL is not provided)
    POSTGRES_DB: str = "invisithreat_db"
    POSTGRES_USER: str = "invisithreat"
    POSTGRES_PASSWORD: str = "invisithreat_password"
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432
    POSTGRES_SSLMODE: str = ""

    FRONTEND_URL: str
    BACKEND_URL: str = "http://localhost:8000"

    # Email — Brevo
    BREVO_API_KEY: str = ""
    ADMIN_EMAIL: str = ""
    PRIMARY_ADMIN_EMAIL: str = "invisithreat@gmail.com"

    # Email — SMTP fallback (Gmail/Outlook/custom SMTP)
    EMAIL_FROM: str = ""
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True

    # GitHub integrations
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_OAUTH_REDIRECT_URI: str = ""
    GITHUB_APP_SLUG: str = ""
    GITHUB_WEBHOOK_SECRET: str = ""
    GITHUB_DEFAULT_TOKEN: str = ""

    @property
    def DATABASE_URL(self) -> str:
        """Return DB URL from DATABASE_URL when set, otherwise build from POSTGRES_* values."""
        db_url = str(self.DATABASE_URL_OVERRIDE or "").strip()
        if not db_url:
            db_url = (
                f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
                f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            )

        # Supabase and many managed Postgres providers require SSL.
        sslmode = self.POSTGRES_SSLMODE.strip()
        if sslmode and "sslmode=" not in db_url:
            separator = "&" if "?" in db_url else "?"
            db_url = f"{db_url}{separator}sslmode={sslmode}"

        return db_url

    @property
    def ADMIN_NOTIFICATION_EMAIL(self) -> str:
        """Central admin inbox for platform approval/access emails."""
        return (self.PRIMARY_ADMIN_EMAIL or self.ADMIN_EMAIL or "").strip()

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
