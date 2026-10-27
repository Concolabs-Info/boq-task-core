from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    """App settings, read from the repo root .env file and the environment."""

    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", extra="ignore")

    database_path: Path = Path("storage/app.db")
    storage_root: Path = Path("storage")
    agent_runtime_url: str = "http://127.0.0.1:8090"
    agent_runtime_token: str = ""
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    @field_validator("database_path", "storage_root")
    @classmethod
    def _from_repo_root(cls, value: Path) -> Path:
        return value if value.is_absolute() else REPO_ROOT / value


@lru_cache
def get_settings() -> Settings:
    return Settings()
