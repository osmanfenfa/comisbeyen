import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

# Absolute path to beyen/.env so it is reliably loaded regardless of cwd
ENV_FILE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.env"))


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str = "change-me-in-production"
    STANDARD_MOISTURE_PERCENT: float = 7.0
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720  # 12-hour shift session
    STATION_NAME: str = "COMIS Buying Station"
    APP_ENV: str = "development"
    CORS_ORIGINS: List[str] = ["http://localhost:5173"]

    model_config = SettingsConfigDict(
        env_file=ENV_FILE_PATH,
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
