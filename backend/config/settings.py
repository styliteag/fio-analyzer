"""
Application settings and configuration
"""

import os
from pathlib import Path


class Settings:
    """Application settings"""

    def __init__(self):
        # Base paths
        self.base_dir = Path(__file__).parent.parent

        # Database configuration
        self.db_path = self.base_dir / "db" / "storage_performance.db"

        # Authentication configuration
        self.htpasswd_path = self.base_dir / ".htpasswd"
        self.htuploaders_path = self.base_dir / ".htuploaders"
        self.htviewers_path = self.base_dir / ".htviewers"  # read-only users
        # Browser sessions (HttpOnly cookie after one password check at login)
        self.session_lifetime_hours = int(os.getenv("SESSION_LIFETIME_HOURS", "48"))
        # auto = Secure when the request arrived over HTTPS (also via X-Forwarded-Proto)
        self.cookie_secure = os.getenv("COOKIE_SECURE", "auto").lower()
        # Browser origins allowed to call the API with the session cookie (comma-separated).
        # Production serves frontend and API from one origin and needs none; the defaults cover
        # the Vite dev server when VITE_API_URL points straight at the backend.
        self.cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]

        # Server configuration
        self.port = int(os.getenv("PORT", "8000"))
        self.host = os.getenv("HOST", "0.0.0.0")

        # Upload configuration
        self.upload_dir = self.base_dir / "uploads"
        self.max_upload_size = 50 * 1024 * 1024  # 50MB

        # Ensure directories exist
        self.db_path.parent.mkdir(exist_ok=True)
        self.upload_dir.mkdir(exist_ok=True)

        # Version configuration - check multiple locations
        # In development: ../VERSION (relative to backend/)
        # In Docker: /app/VERSION (same directory as backend files)
        self.version_file = self.base_dir.parent / "VERSION"
        if not self.version_file.exists():
            self.version_file = self.base_dir / "VERSION"

    @property
    def database_url(self) -> str:
        """Get database URL"""
        return f"sqlite:///{self.db_path}"

    @property
    def version(self) -> str:
        """Get application version from VERSION file"""
        try:
            if self.version_file.exists():
                return self.version_file.read_text().strip()
            return "unknown"
        except Exception:
            return "unknown"


# Global settings instance
settings = Settings()
