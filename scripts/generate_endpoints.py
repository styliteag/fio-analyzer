#!/usr/bin/env python3
"""
Generate a machine-readable list of API endpoints by scanning FastAPI routers.

Outputs: docs/api/endpoints.json

Heuristics:
- Reads backend/main.py to capture include_router prefixes per router module.
- Reads each file in backend/routers/ to find @router.<METHOD>("/path", ...)
- Combines include prefix + router prefix (if any) + route path.
- Captures basic auth hints by scanning for Depends(require_admin|require_auth|require_uploader)
- Adds the app-level health endpoint from main.py.

Usage:
  python3 scripts/generate_endpoints.py
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Tuple, Optional

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
ROUTERS_DIR = BACKEND / "routers"
MAIN = BACKEND / "main.py"
OUT = ROOT / "docs" / "api" / "endpoints.json"


@dataclass(frozen=True)
class Endpoint:
    method: str
    path: str
    auth: str
    summary: str = ""


def read_text(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def parse_include_prefixes(main_text: str) -> Dict[str, str]:
    prefixes: Dict[str, str] = {}
    # from routers import test_runs, imports, time_series, utils_router, users
    # app.include_router(test_runs.router, prefix="/api/test-runs", ...)
    pat = re.compile(
        r"app\.include_router\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\.router\s*,[^)]*?prefix\s*=\s*\"([^\"]*)\"",
        re.DOTALL,
    )
    for m in pat.finditer(main_text):
        module, prefix = m.group(1), m.group(2)
        prefixes[module] = prefix or ""
    # Routers included without explicit prefix (e.g., users) → empty prefix
    noprefix_pat = re.compile(r"app\.include_router\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\.router\s*[,)]")
    for m in noprefix_pat.finditer(main_text):
        module = m.group(1)
        prefixes.setdefault(module, "")
    return prefixes


def parse_router_prefix(router_text: str) -> str:
    m = re.search(r"APIRouter\s*\(\s*[^)]*prefix\s*=\s*\"([^\"]*)\"", router_text)
    return m.group(1) if m else ""


def iter_router_routes_ast(router_text: str) -> List[Tuple[str, str, str, str]]:
    """Yield (method, route_path, summary, auth) for each @router.<method>(path, ...).

    Uses AST for robustness against formatting and multiple decorators.
    """
    import ast

    out: List[Tuple[str, str, str, str]] = []
    tree = ast.parse(router_text)

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            # Detect auth by scanning function args and defaults
            auth: str = "none"
            code_segment = router_text[node.lineno - 1 : node.end_lineno] if hasattr(node, "end_lineno") else ""

            def set_auth(val: str):
                nonlocal auth
                priority = {"admin": 3, "uploader": 2, "auth": 1, "none": 0}
                if priority[val] > priority.get(auth, 0):
                    auth = val

            for dec in node.decorator_list:
                if isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute):
                    base = dec.func.value
                    method = dec.func.attr.lower()
                    if (
                        isinstance(base, ast.Name)
                        and base.id == "router"
                        and method in {"get", "post", "put", "delete", "patch"}
                    ):
                        # First positional arg is path
                        path_val: Optional[str] = None
                        if dec.args and isinstance(dec.args[0], ast.Constant) and isinstance(dec.args[0].value, str):
                            path_val = dec.args[0].value
                        # summary kwarg
                        summary_val = ""
                        for kw in dec.keywords or []:
                            if kw.arg == "summary" and isinstance(kw.value, ast.Constant) and isinstance(kw.value.value, str):
                                summary_val = kw.value.value

                        # Auth by scanning function args defaults for Depends(x)
                        for arg in node.args.args + node.args.kwonlyargs:
                            if arg.annotation is not None:
                                pass  # ignore
                        for default in node.args.defaults + node.args.kw_defaults:
                            name = None
                            if isinstance(default, ast.Call) and isinstance(default.func, ast.Name) and default.func.id == "Depends":
                                if default.args and isinstance(default.args[0], ast.Name):
                                    name = default.args[0].id
                            if name == "require_admin":
                                set_auth("admin")
                            elif name == "require_uploader":
                                set_auth("uploader")
                            elif name == "require_auth":
                                set_auth("auth")

                        if path_val is not None:
                            out.append((method.upper(), path_val, summary_val, auth))

    return out


def auth_from_block(block: str) -> str:
    if "Depends(require_admin)" in block:
        return "admin"
    if "Depends(require_uploader)" in block:
        return "uploader"
    if "Depends(require_auth)" in block:
        return "auth"
    return "none"


def summary_from_block(block: str) -> str:
    m = re.search(r"summary\s*=\s*\"([^\"]+)\"", block)
    return m.group(1) if m else ""


def normalize_path(*parts: str) -> str:
    segs: List[str] = []
    for p in parts:
        if not p:
            continue
        segs.append(p)
    raw = "/" + "/".join(s.strip("/") for s in segs)
    # Keep root as '/'
    if raw != "/" and raw.endswith("/"):
        raw = raw[:-1]
    return raw


def collect_endpoints() -> List[Endpoint]:
    endpoints: Dict[Tuple[str, str], Endpoint] = {}
    main_text = read_text(MAIN)
    include_prefixes = parse_include_prefixes(main_text)

    # Routers directory
    for router_file in sorted(ROUTERS_DIR.glob("*.py")):
        if router_file.name == "__init__.py":
            continue
        mod_name = router_file.stem
        text = read_text(router_file)
        r_prefix = parse_router_prefix(text)
        i_prefix = include_prefixes.get(mod_name, "")
        base = normalize_path(i_prefix, r_prefix)
        for method, route, summary, auth in iter_router_routes_ast(text):
            # Skip empty or duplicate shadow routes where path == ""
            # Represent root with '/'
            path = "/" if route == "" else route
            full = normalize_path(base, path)
            key = (method, full)
            incoming = Endpoint(method=method, path=full, auth=auth, summary=summary)
            if key in endpoints:
                existing = endpoints[key]
                # Prefer stronger auth and non-empty summary
                priority = {"admin": 3, "uploader": 2, "auth": 1, "none": 0}
                choose_auth = existing.auth
                if priority.get(incoming.auth, 0) > priority.get(existing.auth, 0):
                    choose_auth = incoming.auth
                choose_summary = existing.summary or incoming.summary
                endpoints[key] = Endpoint(method=method, path=full, auth=choose_auth, summary=choose_summary)
            else:
                endpoints[key] = incoming

    # Add app-level endpoints from main.py (health)
    for m in re.finditer(r"@app\.(get|post|put|delete|patch)\(\s*\"([^\"]+)\"", main_text):
        method = m.group(1).upper()
        path = m.group(2)
        ep = Endpoint(method=method, path=normalize_path(path), auth="none", summary="")
        endpoints.setdefault((ep.method, ep.path), ep)

    # Sort by path then method
    return [endpoints[k] for k in sorted(endpoints.keys(), key=lambda x: (x[1], x[0]))]


def main() -> int:
    eps = collect_endpoints()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "name": "FIO Analyzer API",
        "version": "1.0.0",
        "base_urls": {"backend": "http://localhost:8000", "nginx_api_base": "http://localhost/api"},
        "endpoints": [asdict(e) for e in eps],
    }
    OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {OUT} with {len(eps)} endpoints")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
