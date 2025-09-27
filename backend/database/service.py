"""
Database service layer for FIO Analyzer

Provides a clean abstraction over raw SQLite operations with proper
error handling, type safety, and query building utilities.
"""

import logging
import sqlite3
from contextlib import contextmanager
from typing import Any, Dict, List, Optional, Tuple, Union

from utils.logging import log_error, log_info

from .connection import get_db
from .models import TestRun, dataclass_to_dict

logger = logging.getLogger(__name__)


class DatabaseError(Exception):
    """Custom exception for database operations"""

    pass


class QueryBuilder:
    """Utility class for building SQL queries safely"""

    def __init__(self, table: str):
        self.table = table
        self.conditions = []
        self.parameters = []
        self.order_by = []
        self.limit_value = None
        self.offset_value = None

    def where(self, column: str, value: Any, operator: str = "=") -> "QueryBuilder":
        """Add WHERE condition"""
        if value is not None:
            if operator == "IN" and isinstance(value, (list, tuple)):
                placeholders = ",".join("?" * len(value))
                self.conditions.append(f"{column} IN ({placeholders})")
                self.parameters.extend(value)
            else:
                self.conditions.append(f"{column} {operator} ?")
                self.parameters.append(value)
        return self

    def where_in(self, column: str, values: List[Any]) -> "QueryBuilder":
        """Add WHERE IN condition"""
        if values:
            return self.where(column, values, "IN")
        return self

    def order(self, column: str, direction: str = "ASC") -> "QueryBuilder":
        """Add ORDER BY clause"""
        self.order_by.append(f"{column} {direction.upper()}")
        return self

    def limit(self, count: int) -> "QueryBuilder":
        """Add LIMIT clause"""
        self.limit_value = count
        return self

    def offset(self, count: int) -> "QueryBuilder":
        """Add OFFSET clause"""
        self.offset_value = count
        return self

    def build_select(self, columns: str = "*") -> Tuple[str, List[Any]]:
        """Build SELECT query"""
        query = f"SELECT {columns} FROM {self.table}"

        if self.conditions:
            query += " WHERE " + " AND ".join(self.conditions)

        if self.order_by:
            query += " ORDER BY " + ", ".join(self.order_by)

        if self.limit_value is not None:
            query += f" LIMIT {self.limit_value}"

        if self.offset_value is not None:
            query += f" OFFSET {self.offset_value}"

        return query, self.parameters

    def build_count(self) -> Tuple[str, List[Any]]:
        """Build COUNT query"""
        query = f"SELECT COUNT(*) FROM {self.table}"

        if self.conditions:
            query += " WHERE " + " AND ".join(self.conditions)

        return query, self.parameters


class DatabaseService:
    """Main database service class"""

    @contextmanager
    def get_connection(self):
        """Get database connection with proper error handling"""
        conn = None
        try:
            conn = get_db()
            yield conn
        except sqlite3.Error as e:
            log_error("Database connection error", e)
            raise DatabaseError(f"Database connection failed: {e}")
        finally:
            if conn:
                conn.close()

    def execute_query(
        self,
        query: str,
        parameters: List[Any] = None,
        fetch_one: bool = False,
        fetch_all: bool = True,
    ) -> Union[List[Dict[str, Any]], Dict[str, Any], None]:
        """Execute a SELECT query with proper error handling"""
        if parameters is None:
            parameters = []

        with self.get_connection() as conn:
            try:
                cursor = conn.cursor()
                cursor.execute(query, parameters)

                if fetch_one:
                    row = cursor.fetchone()
                    if row:
                        columns = [desc[0] for desc in cursor.description]
                        return dict(zip(columns, row))
                    return None

                if fetch_all:
                    rows = cursor.fetchall()
                    columns = [desc[0] for desc in cursor.description]
                    return [dict(zip(columns, row)) for row in rows]

                return None

            except sqlite3.Error as e:
                log_error(
                    "Query execution error",
                    e,
                    {"query": query, "parameters": parameters},
                )
                raise DatabaseError(f"Query execution failed: {e}")

    def execute_write(self, query: str, parameters: List[Any] = None) -> int:
        """Execute INSERT, UPDATE, or DELETE query"""
        if parameters is None:
            parameters = []

        with self.get_connection() as conn:
            try:
                cursor = conn.cursor()
                cursor.execute(query, parameters)
                conn.commit()
                return cursor.rowcount

            except sqlite3.Error as e:
                conn.rollback()
                log_error(
                    "Write operation error",
                    e,
                    {"query": query, "parameters": parameters},
                )
                raise DatabaseError(f"Write operation failed: {e}")

    def execute_many(self, query: str, parameters_list: List[List[Any]]) -> int:
        """Execute multiple queries in a batch"""
        with self.get_connection() as conn:
            try:
                cursor = conn.cursor()
                cursor.executemany(query, parameters_list)
                conn.commit()
                return cursor.rowcount

            except sqlite3.Error as e:
                conn.rollback()
                log_error(
                    "Batch operation error",
                    e,
                    {"query": query, "batch_size": len(parameters_list)},
                )
                raise DatabaseError(f"Batch operation failed: {e}")


class TestRunService(DatabaseService):
    """Service for test run operations"""

    def __init__(self):
        super().__init__()
        self.table = "test_runs"

    def get_test_runs(
        self,
        hostnames: Optional[List[str]] = None,
        drive_types: Optional[List[str]] = None,
        drive_models: Optional[List[str]] = None,
        protocols: Optional[List[str]] = None,
        patterns: Optional[List[str]] = None,
        block_sizes: Optional[List[str]] = None,
        syncs: Optional[List[str]] = None,
        queue_depths: Optional[List[str]] = None,
        directs: Optional[List[str]] = None,
        num_jobs: Optional[List[str]] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        order_by: str = "timestamp",
        order_direction: str = "DESC",
    ) -> List[Dict[str, Any]]:
        """Get test runs with filtering"""

        builder = QueryBuilder(self.table)

        builder.where_in("hostname", hostnames or [])
        builder.where_in("drive_type", drive_types or [])
        builder.where_in("drive_model", drive_models or [])
        builder.where_in("protocol", protocols or [])
        builder.where_in("read_write_pattern", patterns or [])
        builder.where_in("block_size", [int(bs) for bs in block_sizes] if block_sizes else [])
        builder.where_in("sync", [int(s) for s in syncs] if syncs else [])
        builder.where_in("queue_depth", [int(qd) for qd in queue_depths] if queue_depths else [])
        builder.where_in("direct", [int(d) for d in directs] if directs else [])
        builder.where_in("num_jobs", [int(nj) for nj in num_jobs] if num_jobs else [])

        builder.order(order_by, order_direction)

        if limit:
            builder.limit(limit)
        if offset:
            builder.offset(offset)

        query, parameters = builder.build_select()

        log_info(
            "Executing test runs query",
            {
                "filters": {
                    "hostnames": len(hostnames) if hostnames else 0,
                    "drive_types": len(drive_types) if drive_types else 0,
                    "drive_models": len(drive_models) if drive_models else 0,
                },
                "limit": limit,
                "offset": offset,
            },
        )

        return self.execute_query(query, parameters)

    def get_test_run_count(self, **filters) -> int:
        """Get count of test runs matching filters"""
        builder = QueryBuilder(self.table)

        # Apply same filters as get_test_runs
        for key, value in filters.items():
            if value:
                builder.where_in(key, value)

        query, parameters = builder.build_count()
        result = self.execute_query(query, parameters, fetch_one=True)

        return result["COUNT(*)"] if result else 0

    def get_test_run_by_id(self, test_run_id: str) -> Optional[Dict[str, Any]]:
        """Get a single test run by ID"""
        query = f"SELECT * FROM {self.table} WHERE id = ?"
        return self.execute_query(query, [test_run_id], fetch_one=True)

    def create_test_run(self, test_run: TestRun) -> str:
        """Create a new test run"""
        data = dataclass_to_dict(test_run)

        # Build INSERT query dynamically
        columns = list(data.keys())
        placeholders = ["?" for _ in columns]

        query = f"""
            INSERT INTO {self.table} ({', '.join(columns)})
            VALUES ({', '.join(placeholders)})
        """

        self.execute_write(query, list(data.values()))

        log_info("Created test run", {"id": test_run.id, "hostname": test_run.hostname})
        return test_run.id

    def update_test_run(self, test_run_id: str, updates: Dict[str, Any]) -> int:
        """Update a test run"""
        if not updates:
            return 0

        # Build UPDATE query dynamically
        set_clauses = [f"{key} = ?" for key in updates.keys()]
        query = f"UPDATE {self.table} SET {', '.join(set_clauses)} WHERE id = ?"

        parameters = list(updates.values()) + [test_run_id]
        rows_affected = self.execute_write(query, parameters)

        log_info("Updated test run", {"id": test_run_id, "fields": list(updates.keys())})
        return rows_affected

    def delete_test_run(self, test_run_id: str) -> int:
        """Delete a test run"""
        query = f"DELETE FROM {self.table} WHERE id = ?"
        rows_affected = self.execute_write(query, [test_run_id])

        log_info("Deleted test run", {"id": test_run_id})
        return rows_affected

    def get_filter_options(self) -> Dict[str, List[str]]:
        """Get available filter options"""
        filters = {}

        filter_columns = [
            "hostname",
            "drive_type",
            "drive_model",
            "protocol",
            "read_write_pattern",
            "block_size",
            "sync",
            "queue_depth",
            "direct",
            "num_jobs",
        ]

        for column in filter_columns:
            query = f"SELECT DISTINCT {column} FROM {self.table} WHERE {column} IS NOT NULL ORDER BY {column}"
            results = self.execute_query(query)
            filters[column] = [str(row[column]) for row in results if row[column] is not None]

        return filters


# Create service instances
db_service = DatabaseService()
test_run_service = TestRunService()
