from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Stock Dashboard API"
    DEBUG: bool = True
    ALPHA_VANTAGE_API_KEY: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
