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
        
        # Server configuration
        self.port = int(os.getenv("PORT", "8000"))
        self.host = os.getenv("HOST", "0.0.0.0")
        
        # Upload configuration
        self.upload_dir = self.base_dir / "uploads"
        self.max_upload_size = 50 * 1024 * 1024  # 50MB
        
        # Ensure directories exist
        self.db_path.parent.mkdir(exist_ok=True)
        self.upload_dir.mkdir(exist_ok=True)
    
    @property
    def database_url(self) -> str:
        """Get database URL"""
        return f"sqlite:///{self.db_path}"


# Global settings instance
settings = Settings()