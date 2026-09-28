"""
Raw data API router: download the fio JSON files stored at upload time.

Stored paths may come from another machine or container (e.g. /app/uploads/...),
so they are re-rooted onto the local uploads directory. Anything that does not
resolve to a file inside the uploads directory is never served.
"""

import json
import re
import sqlite3
import tempfile
import zipfile
from pathlib import Path
from typing import Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse

from auth.middleware import User, require_viewer
from config.settings import settings
from database.connection import get_db

router = APIRouter()

# Limits for one ZIP (run_uuid values come from uploads, so a run can be arbitrarily large)
MAX_ZIP_FILES = 5000
MAX_ZIP_BYTES = 2 * 1024**3
INDEX_NAME = "index.json"

Source = Literal["latest", "history", "saturation"]
SOURCE_TABLES: Dict[str, str] = {"latest": "test_runs", "history": "test_runs_all", "saturation": "saturation_runs"}


def resolve_upload_path(stored: Optional[str]) -> Optional[Path]:
    """Map a stored upload path onto the local uploads directory; None if unsafe or missing."""
    if not stored:
        return None
    parts = Path(stored).parts
    if "uploads" not in parts:
        return None
    relative = parts[len(parts) - 1 - parts[::-1].index("uploads") + 1 :]
    root = settings.upload_dir.resolve()
    candidate = root.joinpath(*relative).resolve()
    if not candidate.is_relative_to(root) or not candidate.is_file():
        return None
    return candidate


def download_name(path: Path) -> str:
    """Stored files are '<uuid hex>_<original name>'; offer the original name."""
    prefix, _, rest = path.name.partition("_")
    return rest if len(prefix) == 32 and rest else path.name


@router.get(
    "/test-runs/{test_run_id}",
    summary="Download Raw FIO JSON",
    description="Download the fio JSON file that was uploaded for one test run. "
    "`source` selects the table the id belongs to: latest (test_runs, default; the id returned by uploads), "
    "history (test_runs_all) or saturation (saturation_runs).",
    responses={404: {"description": "Unknown id or file no longer available"}},
)
async def download_test_run_json(
    test_run_id: int,
    source: Source = Query("latest", description="Table the id belongs to"),
    user: User = Depends(require_viewer),
    db: sqlite3.Connection = Depends(get_db),
) -> FileResponse:
    row = db.execute(f"SELECT uploaded_file_path FROM {SOURCE_TABLES[source]} WHERE id = ?", (test_run_id,)).fetchone()
    path = resolve_upload_path(row[0]) if row else None
    if path is None:
        raise HTTPException(status_code=404, detail="Raw JSON not available for this test run")
    return FileResponse(path, media_type="application/json", filename=download_name(path))


def _run_rows(db: sqlite3.Connection, run_uuid: str) -> List[dict]:
    rows = []
    for source in ("history", "saturation"):
        cursor = db.execute(
            f"SELECT id, hostname, read_write_pattern, block_size, queue_depth, uploaded_file_path "
            f"FROM {SOURCE_TABLES[source]} WHERE run_uuid = ? ORDER BY id",
            (run_uuid,),
        )
        rows.extend({"source": source, **dict(zip([c[0] for c in cursor.description], values))} for values in cursor.fetchall())
    return rows


@router.get(
    "/runs/{run_uuid}",
    summary="Download Run as ZIP",
    description="Download all raw fio JSON files of one script run (run_uuid) as a ZIP archive, "
    "including saturation steps. index.json maps every file to its test run and lists files that are no longer available.",
    responses={200: {"content": {"application/zip": {}}}, 404: {"description": "Unknown run_uuid"}},
)
def download_run_zip(
    run_uuid: str,
    user: User = Depends(require_viewer),
    db: sqlite3.Connection = Depends(get_db),
) -> StreamingResponse:
    # Plain def: file reads and compression run in the threadpool, not on the event loop
    return _zip_response(_run_rows(db, run_uuid), "run_uuid", run_uuid, "run")


def _ramp_rows(db: sqlite3.Connection, ramp_uuid: str) -> List[dict]:
    cursor = db.execute(
        "SELECT id, hostname, read_write_pattern, block_size, queue_depth, clients, uploaded_file_path "
        "FROM test_runs_all WHERE ramp_uuid = ? ORDER BY clients, id",
        (ramp_uuid,),
    )
    return [{"source": "history", **dict(zip([c[0] for c in cursor.description], values))} for values in cursor.fetchall()]


@router.get(
    "/ramps/{ramp_uuid}",
    summary="Download Client Ramp as ZIP",
    description="Download the raw fio client-mode JSON files of all steps of one multi-client ramp (ramp_uuid) as a ZIP "
    "archive. index.json maps every file to its test run (test_runs_all id) and client count.",
    responses={200: {"content": {"application/zip": {}}}, 404: {"description": "Unknown ramp_uuid"}},
)
def download_ramp_zip(
    ramp_uuid: str,
    user: User = Depends(require_viewer),
    db: sqlite3.Connection = Depends(get_db),
) -> StreamingResponse:
    return _zip_response(_ramp_rows(db, ramp_uuid), "ramp_uuid", ramp_uuid, "ramp")


def _zip_response(rows: List[dict], key: str, value: str, prefix: str) -> StreamingResponse:
    if not rows:
        raise HTTPException(status_code=404, detail=f"Unknown {key}")
    if len(rows) > MAX_ZIP_FILES:
        raise HTTPException(status_code=413, detail=f"Run has {len(rows)} files, more than {MAX_ZIP_FILES} per ZIP")

    spool = tempfile.SpooledTemporaryFile(max_size=64 * 1024**2)
    _write_run_zip(spool, {key: value}, rows)
    spool.seek(0)
    filename = f"{prefix}_" + re.sub(r"[^A-Za-z0-9-]", "", value)[:40] + ".zip"
    return StreamingResponse(
        iter(lambda: spool.read(1024**2), b""),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _write_run_zip(target, group: Dict[str, str], rows: List[dict]) -> None:
    index = {**group, "files": [], "missing": []}
    written = {INDEX_NAME}  # reserved for the index
    total = 0
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for row in rows:
            path = resolve_upload_path(row.pop("uploaded_file_path"))
            if path is None:
                index["missing"].append({"source": row["source"], "id": row["id"]})
                continue
            name = download_name(path)
            if name in written:
                name = path.name  # keep the unique stored name on collisions
            if name not in written:
                total += path.stat().st_size
                if total > MAX_ZIP_BYTES:
                    raise HTTPException(status_code=413, detail="Run is too large to download as one ZIP")
                archive.write(path, arcname=name)
                written.add(name)
            index["files"].append({"file": name, **row})
        archive.writestr(INDEX_NAME, json.dumps(index, indent=2))
