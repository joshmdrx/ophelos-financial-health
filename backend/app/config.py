from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Default points at backend/financial_health.db regardless of where the
    # process is launched from — relative SQLite paths are otherwise resolved
    # against cwd, which causes the dev DB to vanish when run from repo root.
    database_url: str = f"sqlite:///{BACKEND_ROOT / 'financial_health.db'}"
    cors_origins: str = "http://localhost:5173"
    api_host: str = "127.0.0.1"
    api_port: int = 8000
    log_level: str = "info"
    app_env: str = "dev"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
