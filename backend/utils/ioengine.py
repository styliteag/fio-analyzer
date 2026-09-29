"""
fio I/O engine (libaio, io_uring, psync, ...) of a test run.

The fio JSON output is the reliable source: a local run passes the engine on the command line
(`jobs[].job options.ioengine`), a client mode run writes it into the job file (`global options`).
storage_info.ioengine is only what fio-test.sh detected on the host, used as a fallback.
"""

import json
import re
from typing import Any, Dict, Optional

from utils.fio_client_mode import AGGREGATE_JOBNAME
from utils.storage_info import decode_storage_info

MAX_IOENGINE_LENGTH = 64
IOENGINE_PATTERN = re.compile(r"^[a-z0-9_.:+/-]+$")


def normalize_ioengine(value: Any) -> Optional[str]:
    """Lowercase, stripped engine name; None for missing, empty, oversized or odd values."""
    if not isinstance(value, str):
        return None
    engine = value.strip().lower()
    if not engine or len(engine) > MAX_IOENGINE_LENGTH or not IOENGINE_PATTERN.match(engine):
        return None
    return engine


def extract_ioengine(job_opts: Dict[str, Any], global_opts: Dict[str, Any]) -> Optional[str]:
    """Engine from fio's job options first, then the global options."""
    for options in (job_opts, global_opts):
        if isinstance(options, dict):
            engine = normalize_ioengine(options.get("ioengine"))
            if engine:
                return engine
    return None


def ioengine_from_storage_info(stored: Optional[str]) -> Optional[str]:
    """Engine detected by fio-test.sh (encoded storage_info JSON), or None."""
    info = decode_storage_info(stored)
    return normalize_ioengine(info.get("ioengine")) if info else None


def ioengine_from_fio_json(raw: str) -> Optional[str]:
    """Engine of a stored fio JSON document (local or client mode output), or None."""
    try:
        data = json.loads(raw)
    except (ValueError, RecursionError):
        return None
    if not isinstance(data, dict):
        return None
    jobs = data.get("jobs")
    job_opts = jobs[0].get("job options", {}) if isinstance(jobs, list) and jobs and isinstance(jobs[0], dict) else {}
    global_opts = data.get("global options") or {}
    if isinstance(global_opts, list):
        global_opts = global_opts[0] if global_opts else {}
    if not job_opts and isinstance(data.get("client_stats"), list):
        first = next((entry for entry in data["client_stats"] if isinstance(entry, dict) and entry.get("jobname") != AGGREGATE_JOBNAME), {})
        job_opts = first.get("job options", {})
    return extract_ioengine(job_opts, global_opts)
