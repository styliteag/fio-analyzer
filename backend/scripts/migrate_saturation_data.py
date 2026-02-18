#!/usr/bin/env python3
"""
Database migration script to move saturation test data to a dedicated table.

This script:
1. Creates the saturation_runs table if it doesn't exist
2. Copies saturation rows from test_runs_all into saturation_runs
3. Deletes saturation rows from test_runs_all and test_runs

Saturation rows are identified by: description LIKE 'saturation-test%'
"""

import sqlite3
from pathlib import Path


def create_saturation_table(cursor: sqlite3.Cursor) -> bool:
    """Create the saturation_runs table if it doesn't exist.

    Returns:
        True if the table was created, False if it already existed.
    """
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='saturation_runs'
    """)
    if cursor.fetchone():
        print("saturation_runs table already exists")
        return False

    print("Creating saturation_runs table...")
    cursor.execute("""
        CREATE TABLE saturation_runs (
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
            output_file TEXT,
            num_jobs INTEGER,
            direct INTEGER,
            test_size TEXT,
            sync INTEGER,
            iodepth INTEGER,
            avg_latency REAL,
            bandwidth REAL,
            iops REAL,
            p1_latency REAL,
            p5_latency REAL,
            p10_latency REAL,
            p20_latency REAL,
            p30_latency REAL,
            p40_latency REAL,
            p50_latency REAL,
            p60_latency REAL,
            p70_latency REAL,
            p80_latency REAL,
            p90_latency REAL,
            p95_latency REAL,
            p99_latency REAL,
            p99_5_latency REAL,
            p99_9_latency REAL,
            p99_95_latency REAL,
            p99_99_latency REAL,
            config_uuid TEXT,
            run_uuid TEXT
        )
    """)
    cursor.execute(
        "CREATE INDEX idx_saturation_runs_run_uuid ON saturation_runs(run_uuid)"
    )
    cursor.execute(
        "CREATE INDEX idx_saturation_runs_hostname ON saturation_runs(hostname)"
    )
    cursor.execute(
        "CREATE INDEX idx_saturation_runs_timestamp ON saturation_runs(timestamp DESC)"
    )
    print("saturation_runs table created with indexes")
    return True


def migrate_data(cursor: sqlite3.Cursor) -> dict:
    """Move saturation data from test_runs_all/test_runs to saturation_runs.

    Returns:
        Dictionary with migration counts.
    """
    # Count existing saturation rows
    cursor.execute(
        "SELECT COUNT(*) FROM test_runs_all WHERE description LIKE 'saturation-test%'"
    )
    all_count = cursor.fetchone()[0]

    cursor.execute(
        "SELECT COUNT(*) FROM test_runs WHERE description LIKE 'saturation-test%'"
    )
    latest_count = cursor.fetchone()[0]

    print(f"\nFound {all_count} saturation rows in test_runs_all")
    print(f"Found {latest_count} saturation rows in test_runs")

    if all_count == 0:
        print("No saturation data to migrate.")
        return {"copied": 0, "deleted_all": 0, "deleted_latest": 0}

    # Copy from test_runs_all to saturation_runs (all columns except id and is_latest)
    columns = """
        timestamp, test_date, drive_model, drive_type, test_name,
        block_size, read_write_pattern, queue_depth, duration,
        fio_version, job_runtime, rwmixread, total_ios_read,
        total_ios_write, usr_cpu, sys_cpu, hostname, protocol,
        description, uploaded_file_path, output_file, num_jobs,
        direct, test_size, sync, iodepth,
        avg_latency, bandwidth, iops,
        p1_latency, p5_latency, p10_latency, p20_latency,
        p30_latency, p40_latency, p50_latency, p60_latency,
        p70_latency, p80_latency, p90_latency, p95_latency,
        p99_latency, p99_5_latency, p99_9_latency,
        p99_95_latency, p99_99_latency,
        config_uuid, run_uuid
    """

    print("\nCopying saturation rows to saturation_runs...")
    cursor.execute(f"""
        INSERT INTO saturation_runs ({columns})
        SELECT {columns}
        FROM test_runs_all
        WHERE description LIKE 'saturation-test%'
    """)
    copied = cursor.rowcount
    print(f"Copied {copied} rows")

    # Delete from test_runs_all
    print("Deleting saturation rows from test_runs_all...")
    cursor.execute(
        "DELETE FROM test_runs_all WHERE description LIKE 'saturation-test%'"
    )
    deleted_all = cursor.rowcount
    print(f"Deleted {deleted_all} rows from test_runs_all")

    # Delete from test_runs
    print("Deleting saturation rows from test_runs...")
    cursor.execute(
        "DELETE FROM test_runs WHERE description LIKE 'saturation-test%'"
    )
    deleted_latest = cursor.rowcount
    print(f"Deleted {deleted_latest} rows from test_runs")

    return {"copied": copied, "deleted_all": deleted_all, "deleted_latest": deleted_latest}


def verify_migration(cursor: sqlite3.Cursor) -> None:
    """Verify the migration was successful."""
    print("\n" + "=" * 60)
    print("Verification:")

    cursor.execute("SELECT COUNT(*) FROM saturation_runs")
    sat_count = cursor.fetchone()[0]
    print(f"  saturation_runs: {sat_count} rows")

    cursor.execute(
        "SELECT COUNT(*) FROM test_runs_all WHERE description LIKE 'saturation-test%'"
    )
    remaining_all = cursor.fetchone()[0]
    print(f"  test_runs_all remaining saturation rows: {remaining_all}")

    cursor.execute(
        "SELECT COUNT(*) FROM test_runs WHERE description LIKE 'saturation-test%'"
    )
    remaining_latest = cursor.fetchone()[0]
    print(f"  test_runs remaining saturation rows: {remaining_latest}")

    if remaining_all == 0 and remaining_latest == 0:
        print("\nMigration verified successfully!")
    else:
        print("\nWARNING: Some saturation rows remain in original tables!")


def migrate_database(db_path: str) -> None:
    """Run the migration on the specified database."""
    print(f"Starting saturation data migration for database: {db_path}")
    print("=" * 60)

    if not Path(db_path).exists():
        print(f"ERROR: Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        create_saturation_table(cursor)
        conn.commit()

        counts = migrate_data(cursor)
        conn.commit()

        verify_migration(cursor)

        print("\n" + "=" * 60)
        print("Migration completed successfully!")
        print(f"  Rows copied to saturation_runs: {counts['copied']}")
        print(f"  Rows deleted from test_runs_all: {counts['deleted_all']}")
        print(f"  Rows deleted from test_runs: {counts['deleted_latest']}")

    except Exception as e:
        print(f"\nERROR during migration: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    db_path = Path(__file__).parent.parent / "db" / "storage_performance.db"

    print("Saturation Data Migration Script")
    print("=" * 60)
    print(f"Database: {db_path}")
    print()
    print("This will:")
    print("  1. Create saturation_runs table (if needed)")
    print("  2. Copy saturation rows from test_runs_all to saturation_runs")
    print("  3. Delete saturation rows from test_runs_all and test_runs")
    print()

    response = input("Do you want to proceed with the migration? (yes/no): ")

    if response.lower() in ['yes', 'y']:
        migrate_database(str(db_path))
    else:
        print("Migration cancelled.")
