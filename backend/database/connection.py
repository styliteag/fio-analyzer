"""
Database connection and initialization
"""

import sqlite3
from contextlib import asynccontextmanager
from typing import Any, Dict, Optional

from config.settings import settings
from utils.helpers import (
    calculate_unique_key,
    get_base_bandwidth,
    get_base_iops,
    get_base_latency,
    show_server_ready,
)
from utils.logging import log_error, log_info


class DatabaseManager:
    """Database connection manager"""

    def __init__(self):
        self.db_path = settings.db_path
        self._connection: Optional[sqlite3.Connection] = None

    async def connect(self):
        """Initialize database connection"""
        log_info("Initializing database connection", {"db_path": str(self.db_path)})

        try:
            self._connection = sqlite3.connect(str(self.db_path), check_same_thread=False)
            self._connection.row_factory = sqlite3.Row  # Enable column access by name

            log_info(
                "Connected to SQLite database successfully",
                {"db_path": str(self.db_path)},
            )
            await self._init_schema()

        except Exception as e:
            log_error("Error opening database", e, {"db_path": str(self.db_path)})
            raise

    async def close(self):
        """Close database connection"""
        if self._connection:
            self._connection.close()
            self._connection = None
            log_info("Database connection closed")

    @property
    def connection(self) -> sqlite3.Connection:
        """Get database connection"""
        if not self._connection:
            raise RuntimeError("Database not connected. Call connect() first.")
        return self._connection

    async def _init_schema(self):
        """Initialize database schema"""
        cursor = self.connection.cursor()

        # Create test_runs_all table for all historical data
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS test_runs_all (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                test_date TEXT,
                drive_model TEXT NOT NULL,
                drive_type TEXT NOT NULL,
                test_name TEXT NOT NULL,
                block_size TEXT NOT NULL,
                read_write_pattern TEXT NOT NULL,
                queue_depth INTEGER NOT NULL,
                duration INTEGER NOT NULL,
                fio_version TEXT,
                job_runtime INTEGER,
                rwmixread INTEGER,
                total_ios_read INTEGER,
                total_ios_write INTEGER,
                usr_cpu REAL,
                sys_cpu REAL,
                hostname TEXT,
                protocol TEXT,
                description TEXT,
                uploaded_file_path TEXT,
                -- Job options fields
                output_file TEXT,
                num_jobs INTEGER,
                direct INTEGER,
                test_size TEXT,
                sync INTEGER,
                iodepth INTEGER,
                -- Performance metrics directly in main table
                avg_latency REAL,
                bandwidth REAL,
                iops REAL,
                p95_latency REAL,
                p99_latency REAL,
                -- UUID fields
                config_uuid TEXT,
                run_uuid TEXT,
                -- Uniqueness tracking
                is_latest INTEGER DEFAULT 1
            )
        """
        )

        # Create test_runs table for latest data only
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS test_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                test_date TEXT,
                drive_model TEXT NOT NULL,
                drive_type TEXT NOT NULL,
                test_name TEXT NOT NULL,
                block_size TEXT NOT NULL,
                read_write_pattern TEXT NOT NULL,
                queue_depth INTEGER NOT NULL,
                duration INTEGER NOT NULL,
                fio_version TEXT,
                job_runtime INTEGER,
                rwmixread INTEGER,
                total_ios_read INTEGER,
                total_ios_write INTEGER,
                usr_cpu REAL,
                sys_cpu REAL,
                hostname TEXT,
                protocol TEXT,
                description TEXT,
                uploaded_file_path TEXT,
                -- Job options fields
                output_file TEXT,
                num_jobs INTEGER,
                direct INTEGER,
                test_size TEXT,
                sync INTEGER,
                iodepth INTEGER,
                -- Performance metrics directly in main table
                avg_latency REAL,
                bandwidth REAL,
                iops REAL,
                p95_latency REAL,
                p99_latency REAL,
                -- UUID fields
                config_uuid TEXT,
                run_uuid TEXT,
                -- Uniqueness tracking
                is_latest INTEGER DEFAULT 1,
                -- Unique constraint
                UNIQUE(hostname, protocol, drive_type, drive_model, block_size, read_write_pattern, queue_depth, num_jobs, direct, test_size, sync, iodepth, duration)
            )
        """
        )

        # Run automatic migrations
        self._run_migrations(cursor)

        # Create indexes
        self._create_indexes(cursor)

        # Create views
        self._create_views(cursor)

        # Check if we need sample data
        cursor.execute("SELECT COUNT(*) as count FROM test_runs")
        latest_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) as count FROM test_runs_all")
        all_count = cursor.fetchone()[0]

        if latest_count == 0 and all_count == 0:
            log_info("Populating sample data...")
            await self._populate_sample_data(cursor)

        self.connection.commit()
        show_server_ready(settings.port)

    def _create_indexes(self, cursor: sqlite3.Cursor):
        """Create database indexes"""
        indexes = [
            ("idx_test_runs_all_timestamp", "test_runs_all", "timestamp DESC"),
            (
                "idx_test_runs_all_host_protocol_time",
                "test_runs_all",
                "hostname, protocol, timestamp DESC",
            ),
            (
                "idx_test_runs_all_config_filter",
                "test_runs_all",
                "hostname, protocol, drive_type, drive_model, block_size, read_write_pattern, queue_depth",
            ),
            (
                "idx_test_runs_config_lookup",
                "test_runs",
                "hostname, protocol, drive_type, drive_model",
            ),
        ]

        for index_name, table_name, columns in indexes:
            cursor.execute(f"CREATE INDEX IF NOT EXISTS {index_name} ON {table_name} ({columns})")

    def _create_views(self, cursor: sqlite3.Cursor):
        """Create database views"""
        cursor.execute(
            """
            CREATE VIEW IF NOT EXISTS latest_test_per_server AS
            WITH ranked_tests AS (
                SELECT
                    *,
                    ROW_NUMBER() OVER (
                        PARTITION BY hostname, protocol, drive_model
                        ORDER BY timestamp DESC
                    ) as rn
                FROM test_runs
                WHERE hostname IS NOT NULL AND protocol IS NOT NULL
            )
            SELECT
                id, hostname, protocol, drive_model, drive_type, test_name,
                block_size, read_write_pattern, queue_depth, timestamp,
                description, test_date
            FROM ranked_tests
            WHERE rn = 1
        """
        )

    def _run_migrations(self, cursor: sqlite3.Cursor):
        """
        Run automatic database migrations.

        This method checks for and applies any necessary schema updates
        to existing databases to maintain compatibility with new versions.
        """
        import hashlib

        def generate_uuid_from_hash(input_string: str) -> str:
            """Generate UUID5 from SHA256 hash"""
            hash_bytes = hashlib.sha256(input_string.encode('utf-8')).digest()
            uuid_bytes = bytearray(hash_bytes[:16])
            uuid_bytes[6] = (uuid_bytes[6] & 0x0F) | 0x50  # Version 5
            uuid_bytes[8] = (uuid_bytes[8] & 0x3F) | 0x80  # RFC 4122 variant

            import uuid as uuid_module
            return str(uuid_module.UUID(bytes=bytes(uuid_bytes)))

        # Migration 1: Add UUID columns
        for table_name in ['test_runs_all', 'test_runs']:
            # Check if uuid columns exist
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = [row[1] for row in cursor.fetchall()]

            needs_migration = False

            if 'config_uuid' not in columns:
                log_info(f"Adding config_uuid column to {table_name}")
                cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN config_uuid TEXT")
                needs_migration = True

            if 'run_uuid' not in columns:
                log_info(f"Adding run_uuid column to {table_name}")
                cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN run_uuid TEXT")
                needs_migration = True

            # Backfill UUIDs for existing records
            if needs_migration:
                log_info(f"Backfilling UUIDs in {table_name}...")

                cursor.execute(f"""
                    SELECT id, hostname, test_date, timestamp
                    FROM {table_name}
                    WHERE config_uuid IS NULL OR run_uuid IS NULL
                """)

                records = cursor.fetchall()
                for record_id, hostname, test_date, timestamp in records:
                    if not hostname:
                        hostname = "unknown"

                    # Generate config_uuid from hostname
                    config_uuid = generate_uuid_from_hash(hostname)

                    # Generate run_uuid from hostname + date
                    date_str = test_date or timestamp or "unknown"
                    date_part = date_str.split('T')[0] if 'T' in date_str else date_str.split(' ')[0]
                    run_uuid = generate_uuid_from_hash(f"{hostname}_{date_part}")

                    cursor.execute(f"""
                        UPDATE {table_name}
                        SET config_uuid = ?, run_uuid = ?
                        WHERE id = ?
                    """, (config_uuid, run_uuid, record_id))

                log_info(f"Backfilled {len(records)} records in {table_name}")

        self.connection.commit()

    async def _populate_sample_data(self, cursor: sqlite3.Cursor):
        """Populate sample data"""
        import random
        from datetime import datetime, timedelta, timezone

        # Define sample servers
        servers = [
            {
                "hostname": "sim-web-01",
                "protocol": "NFS",
                "drives": [("Samsung 980 PRO", "HDD")],
            },
            {
                "hostname": "sim-db-01",
                "protocol": "iSCSI",
                "drives": [("Samsung SN850", "NVMe SSD")],
            },
            {
                "hostname": "sim-app-01",
                "protocol": "Local",
                "drives": [("Samsung 980 PRO", "NVMe SSD")],
            },
            {
                "hostname": "sim-cache-01",
                "protocol": "Local",
                "drives": [("Samsung Optane", "NVMe SSD")],
            },
        ]

        block_sizes = ["4K", "8K", "16K", "64K", "1M"]
        patterns = [
            "sequential_read",
            "sequential_write",
            "random_read",
            "random_write",
        ]
        queue_depths = [1, 4, 8, 16]

        test_runs_data = []

        # Generate test data for each server
        for server in servers:
            for drive_model, drive_type in server["drives"]:
                for day_offset in range(0, 30, 2 + random.randint(0, 3)):
                    timestamp = (datetime.now(timezone.utc) - timedelta(days=day_offset)).isoformat()

                    block_size = random.choice(block_sizes)
                    pattern = random.choice(patterns)
                    queue_depth = random.choice(queue_depths)

                    test_name = f"{server['hostname']}_{pattern}_{block_size}"

                    # Calculate realistic metrics
                    fake_iops = int(get_base_iops(drive_type, pattern, block_size) * (0.8 + random.random() * 0.4))
                    fake_latency = get_base_latency(drive_type, pattern) * (0.8 + random.random() * 0.4)
                    fake_bandwidth = int(get_base_bandwidth(drive_type, pattern, block_size) * (0.8 + random.random() * 0.4))

                    # Generate job options
                    num_jobs = random.choice([1, 2, 4, 8])
                    direct_io = random.choice([0, 1])
                    sync_mode = 1 if random.random() > 0.7 else 0
                    test_size = random.choice(["1M", "10M", "100M", "1G"])
                    iodepth = random.choice([1, 4, 8, 16, 32])

                    test_data = {
                        "timestamp": timestamp,
                        "test_date": timestamp,
                        "drive_model": drive_model,
                        "drive_type": drive_type,
                        "test_name": test_name,
                        "block_size": block_size,
                        "read_write_pattern": pattern,
                        "queue_depth": queue_depth,
                        "duration": 30,
                        "fio_version": "fio-3.28",
                        "job_runtime": 30000,
                        "rwmixread": 100 if "read" in pattern else 0,
                        "total_ios_read": fake_iops * 30 if "read" in pattern else 0,
                        "total_ios_write": fake_iops * 30 if "write" in pattern else 0,
                        "usr_cpu": 5.2 + random.random() * 3,
                        "sys_cpu": 2.1 + random.random() * 2,
                        "hostname": server["hostname"],
                        "protocol": server["protocol"],
                        "description": f"Simulated {pattern} test on {drive_model} drive",
                        "uploaded_file_path": None,
                        "output_file": "testfile.bin",
                        "num_jobs": num_jobs,
                        "direct": direct_io,
                        "test_size": test_size,
                        "sync": sync_mode,
                        "iodepth": iodepth,
                        "avg_latency": fake_latency,
                        "bandwidth": fake_bandwidth,
                        "iops": fake_iops,
                        "p95_latency": fake_latency * 1.25,
                        "p99_latency": fake_latency * 1.5,
                        "is_latest": 1,
                    }

                    test_runs_data.append(test_data)

        # Insert test runs
        columns = list(test_runs_data[0].keys())
        placeholders = ", ".join(["?" for _ in columns])

        # Insert into test_runs_all
        cursor.executemany(
            f"INSERT INTO test_runs_all ({', '.join(columns)}) VALUES ({placeholders})",
            [tuple(test_data[col] for col in columns) for test_data in test_runs_data],
        )

        # Insert into test_runs (with conflict resolution)
        cursor.executemany(
            f"INSERT OR REPLACE INTO test_runs ({', '.join(columns)}) VALUES ({placeholders})",
            [tuple(test_data[col] for col in columns) for test_data in test_runs_data],
        )

        log_info(f"Sample data generation complete: {len(test_runs_data)} test runs")

    async def update_latest_flags(self, test_run_data: Dict[str, Any]):
        """Update latest flags for existing test runs"""
        cursor = self.connection.cursor()
        unique_key = calculate_unique_key(test_run_data)

        log_info(
            "Updating latest flags for test run",
            {
                "unique_key": unique_key,
                "hostname": test_run_data.get("hostname"),
                "drive_model": test_run_data.get("drive_model"),
            },
        )

        # Update existing tests to not be latest
        cursor.execute(
            """
            UPDATE test_runs
            SET is_latest = 0
            WHERE drive_type = ? AND drive_model = ? AND hostname = ? AND protocol = ?
            AND block_size = ? AND read_write_pattern = ? AND output_file = ? AND num_jobs = ?
            AND direct = ? AND test_size = ? AND sync = ? AND iodepth = ?
        """,
            (
                test_run_data.get("drive_type"),
                test_run_data.get("drive_model"),
                test_run_data.get("hostname"),
                test_run_data.get("protocol"),
                test_run_data.get("block_size"),
                test_run_data.get("read_write_pattern"),
                test_run_data.get("output_file"),
                test_run_data.get("num_jobs"),
                test_run_data.get("direct"),
                test_run_data.get("test_size"),
                test_run_data.get("sync"),
                test_run_data.get("iodepth"),
            ),
        )

        self.connection.commit()
        log_info(
            f"Updated {cursor.rowcount} existing tests to is_latest=0",
            {"unique_key": unique_key},
        )


# Global database manager instance
db_manager = DatabaseManager()


async def init_database():
    """Initialize database"""
    await db_manager.connect()


async def close_database():
    """Close database"""
    await db_manager.close()


def get_db() -> sqlite3.Connection:
    """Get database connection (FastAPI dependency)"""
    return db_manager.connection


@asynccontextmanager
async def get_db_cursor():
    """Get database cursor context manager"""
    conn = get_db()
    cursor = conn.cursor()
    try:
        yield cursor
    finally:
        cursor.close()
