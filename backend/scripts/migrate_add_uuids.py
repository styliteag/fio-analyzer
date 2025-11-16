#!/usr/bin/env python3
"""
Database migration script to add UUID columns and backfill existing data.

This script:
1. Adds config_uuid and run_uuid columns to test_runs and test_runs_all tables
2. Backfills existing records with generated UUIDs:
   - config_uuid: Generated from hostname (fixed per host-config)
   - run_uuid: Generated from hostname + test_date (unique per run)
"""

import sqlite3
import uuid
import hashlib
from pathlib import Path
from typing import Optional


def generate_uuid_from_hash(input_string: str, namespace: Optional[uuid.UUID] = None) -> str:
    """
    Generate a UUID5 from a string using SHA256 hash.

    Args:
        input_string: String to hash
        namespace: Optional UUID namespace (default: DNS namespace)

    Returns:
        UUID string in standard format
    """
    if namespace is None:
        namespace = uuid.NAMESPACE_DNS

    # Create SHA256 hash of the input
    hash_bytes = hashlib.sha256(input_string.encode('utf-8')).digest()

    # Use first 16 bytes to create UUID5
    # UUID5 format: xxxxxxxx-xxxx-5xxx-yxxx-xxxxxxxxxxxx
    uuid_bytes = bytearray(hash_bytes[:16])

    # Set version to 5 (0101)
    uuid_bytes[6] = (uuid_bytes[6] & 0x0F) | 0x50

    # Set variant to RFC 4122 (10xx)
    uuid_bytes[8] = (uuid_bytes[8] & 0x3F) | 0x80

    # Convert to UUID object and return as string
    return str(uuid.UUID(bytes=bytes(uuid_bytes)))


def add_uuid_columns(cursor: sqlite3.Cursor, table_name: str) -> None:
    """Add config_uuid and run_uuid columns to the specified table."""

    # Check if columns already exist
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [row[1] for row in cursor.fetchall()]

    if 'config_uuid' not in columns:
        print(f"Adding config_uuid column to {table_name}...")
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN config_uuid TEXT")
    else:
        print(f"config_uuid column already exists in {table_name}")

    if 'run_uuid' not in columns:
        print(f"Adding run_uuid column to {table_name}...")
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN run_uuid TEXT")
    else:
        print(f"run_uuid column already exists in {table_name}")


def backfill_uuids(cursor: sqlite3.Cursor, table_name: str) -> int:
    """
    Backfill UUID values for existing records.

    Returns:
        Number of records updated
    """
    print(f"\nBackfilling UUIDs in {table_name}...")

    # Get all records that need UUIDs
    cursor.execute(f"""
        SELECT id, hostname, test_date
        FROM {table_name}
        WHERE config_uuid IS NULL OR run_uuid IS NULL
    """)

    records = cursor.fetchall()
    updated_count = 0

    for record_id, hostname, test_date in records:
        # Generate config_uuid from hostname
        config_uuid = generate_uuid_from_hash(hostname)

        # Generate run_uuid from hostname + date (not time)
        # Extract just the date part if timestamp includes time
        date_part = test_date.split('T')[0] if 'T' in test_date else test_date.split(' ')[0]
        run_uuid = generate_uuid_from_hash(f"{hostname}_{date_part}")

        # Update the record
        cursor.execute(f"""
            UPDATE {table_name}
            SET config_uuid = ?,
                run_uuid = ?
            WHERE id = ?
        """, (config_uuid, run_uuid, record_id))

        updated_count += 1

        if updated_count % 100 == 0:
            print(f"  Updated {updated_count} records...")

    return updated_count


def migrate_database(db_path: str) -> None:
    """Run the migration on the specified database."""

    print(f"Starting UUID migration for database: {db_path}")
    print("=" * 60)

    if not Path(db_path).exists():
        print(f"ERROR: Database not found at {db_path}")
        return

    # Connect to database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Add columns to both tables
        for table_name in ['test_runs_all', 'test_runs']:
            print(f"\n--- Processing table: {table_name} ---")
            add_uuid_columns(cursor, table_name)
            conn.commit()

            # Backfill existing records
            updated = backfill_uuids(cursor, table_name)
            conn.commit()
            print(f"✓ Updated {updated} records in {table_name}")

        # Verify the migration
        print("\n" + "=" * 60)
        print("Migration completed successfully!")
        print("\nVerification:")

        for table_name in ['test_runs_all', 'test_runs']:
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            total = cursor.fetchone()[0]

            cursor.execute(f"""
                SELECT COUNT(*) FROM {table_name}
                WHERE config_uuid IS NOT NULL AND run_uuid IS NOT NULL
            """)
            with_uuids = cursor.fetchone()[0]

            print(f"  {table_name}: {with_uuids}/{total} records have UUIDs")

    except Exception as e:
        print(f"\nERROR during migration: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    # Default database path
    db_path = Path(__file__).parent.parent / "db" / "storage_performance.db"

    print("UUID Migration Script")
    print("=" * 60)
    print(f"Database: {db_path}")
    print()

    # Ask for confirmation
    response = input("Do you want to proceed with the migration? (yes/no): ")

    if response.lower() in ['yes', 'y']:
        migrate_database(str(db_path))
    else:
        print("Migration cancelled.")
