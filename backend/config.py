"""Production configuration for FastAPI backend."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings from environment variables."""

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 4  # For production, use separate process count

    # Request handling
    REQUEST_TIMEOUT: int = 30  # Hard timeout for requests (seconds)
    UPLOAD_TIMEOUT: int = 60  # Soft timeout for /upload (seconds)
    DATA_TIMEOUT: int = 120  # Timeout for /data computation (seconds)
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024  # 50 MB max file size

    # File storage
    CACHE_DIR: str = "/tmp/mps_uploads"  # Railway ephemeral storage
    CLEANUP_INTERVAL: int = 3600  # Cleanup old uploads every hour (seconds)
    KEEP_LATEST: int = 5  # Keep only 5 latest uploads

    # Logging
    LOG_LEVEL: str = "info"

    # Environment
    DEBUG: bool = False
    ENVIRONMENT: str = "production"

    class Config:
        """Pydantic config."""

        env_file = ".env"
        case_sensitive = True


settings = Settings()
