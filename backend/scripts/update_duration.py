#!/usr/bin/env python3
"""
Script to update all test runs with duration = 0 to duration = 60 seconds
"""

import argparse
import sqlite3
import sys
from pathlib import Path

# Add parent directory to path to import modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from config.settings import settings


def update_duration_zero_to_sixty(dry_run: bool = False):
    """Update all test runs with duration = 0 to duration = 60"""
    db_path = settings.db_path
    
    if not db_path.exists():
        print(f"Error: Database not found at {db_path}")
        sys.exit(1)
    
    print(f"Connecting to database: {db_path}")
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    try:
        # Count records to update
        cursor.execute("SELECT COUNT(*) FROM test_runs WHERE duration = 0")
        count_test_runs = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM test_runs_all WHERE duration = 0")
        count_test_runs_all = cursor.fetchone()[0]
        
        print(f"\nFound {count_test_runs} records in test_runs with duration = 0")
        print(f"Found {count_test_runs_all} records in test_runs_all with duration = 0")
        
        if count_test_runs == 0 and count_test_runs_all == 0:
            print("No records to update.")
            return
        
        if dry_run:
            print("\n[DRY RUN] Would update the following:")
            print(f"  - test_runs: {count_test_runs} records")
            print(f"  - test_runs_all: {count_test_runs_all} records")
            print("\nRun without --dry-run to apply changes.")
            return
        
        # Update test_runs table
        cursor.execute("UPDATE test_runs SET duration = 60 WHERE duration = 0")
        updated_test_runs = cursor.rowcount
        
        # Update test_runs_all table
        cursor.execute("UPDATE test_runs_all SET duration = 60 WHERE duration = 0")
        updated_test_runs_all = cursor.rowcount
        
        # Commit changes
        conn.commit()
        
        print(f"\n✓ Successfully updated {updated_test_runs} records in test_runs")
        print(f"✓ Successfully updated {updated_test_runs_all} records in test_runs_all")
        print(f"\nTotal records updated: {updated_test_runs + updated_test_runs_all}")
        
    except Exception as e:
        conn.rollback()
        print(f"\nError updating records: {e}")
        sys.exit(1)
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Update all test runs with duration = 0 to duration = 60 seconds"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be updated without making changes"
    )
    
    args = parser.parse_args()
    update_duration_zero_to_sixty(dry_run=args.dry_run)


if __name__ == "__main__":
    main()

