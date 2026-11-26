#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import atexit
import json
import os
import signal
import sqlite3
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, Optional, Tuple
from urllib import error as urllib_error
from urllib import request as urllib_request
from urllib.parse import quote, urlparse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

DATA_DIR = os.path.join(BASE_DIR, "data")

from sites.roblox_site import RobloxSite, open_connection, insert_raw_ingest, wal_checkpoint

HOST = "127.0.0.1"
PORT = 8181
APP_VERSION = "v18_boundary_finish_mode"
ROBLOX_DB_PATH = os.getenv("OMNI_ROBLOX_DB_PATH") or os.path.join(DATA_DIR, "roblox", "Roblox.db")


def _json_response(handler: BaseHTTPRequestHandler, status: int, obj: Any) -> None:
    body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type, Access-Control-Request-Private-Network")
    handler.send_header("Access-Control-Allow-Private-Network", "true")
    handler.end_headers()
    handler.wfile.write(body)


def _clip_text(value: Any, limit: int = 16384) -> str:
    try:
        s = str(value or "")
    except Exception:
        s = ""
    return s[:limit]


def _normalize_proxy_value(raw: Any) -> Optional[str]:
    try:
        s = str(raw or "").strip()
    except Exception:
        s = ""
    if not s:
        return None
    if "://" in s:
        return s
    if "@" in s:
        return "http://" + s
    parts = s.split(":")
    if len(parts) == 4:
        host, port, user, password = [part.strip() for part in parts]
        if host and port and user:
            return f"http://{quote(user, safe='')}:{quote(password, safe='')}@{host}:{port}"
    if len(parts) == 2:
        host, port = [part.strip() for part in parts]
        if host and port:
            return f"http://{host}:{port}"
    return "http://" + s


def _proxy_fetch_json(url: str, proxy_value: Optional[str] = None, headers: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    proxy_url = _normalize_proxy_value(proxy_value)
    req_headers = {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    }
    if isinstance(headers, dict):
        for k, v in headers.items():
            try:
                ks = str(k).strip()
                vs = str(v)
            except Exception:
                continue
            if ks:
                req_headers[ks] = vs

    handlers = []
    if proxy_url:
        handlers.append(urllib_request.ProxyHandler({"http": proxy_url, "https": proxy_url}))
    opener = urllib_request.build_opener(*handlers)
    req = urllib_request.Request(str(url), headers=req_headers, method="GET")

    try:
        with opener.open(req, timeout=45) as res:
            status = int(getattr(res, "status", 0) or res.getcode() or 0)
            raw_body = res.read(4 * 1024 * 1024 + 1)
            text = raw_body.decode("utf-8", errors="replace")
            try:
                parsed = json.loads(text)
            except Exception:
                return {"ok": False, "status": status, "error": "invalid_json", "text": _clip_text(text), "proxy_used": bool(proxy_url)}
            return {"ok": True, "status": status, "json": parsed, "text": "", "proxy_used": bool(proxy_url)}
    except urllib_error.HTTPError as e:
        status = int(getattr(e, "code", 0) or 0)
        try:
            raw_body = e.read(64 * 1024)
            text = raw_body.decode("utf-8", errors="replace")
        except Exception:
            text = ""
        return {"ok": False, "status": status, "error": f"HTTP {status}", "text": _clip_text(text), "proxy_used": bool(proxy_url)}
    except Exception as e:
        return {"ok": False, "status": 0, "error": str(e), "text": "", "proxy_used": bool(proxy_url)}


class OmniState:
    def __init__(self) -> None:
        os.makedirs(DATA_DIR, exist_ok=True)
        self.rb_site = RobloxSite(ROBLOX_DB_PATH)
        self.rb_conn = open_connection(ROBLOX_DB_PATH)
        self._lock = threading.RLock()
        try:
            self._checkpoint_every_s = float(os.getenv("OMNI_SQLITE_CHECKPOINT_EVERY_S", "2.0"))
        except Exception:
            self._checkpoint_every_s = 2.0
        self._checkpoint_mode = str(os.getenv("OMNI_SQLITE_CHECKPOINT_MODE", "PASSIVE")).strip().upper() or "PASSIVE"
        self._last_checkpoint = 0.0
        try:
            wal_checkpoint(self.rb_conn, "PASSIVE")
        except Exception:
            pass
        self.rb_site.start_background_workers()

    def close(self) -> None:
        try:
            self.rb_site.stop_background_workers()
        except Exception:
            pass
        try:
            with self._lock:
                try:
                    self.rb_conn.commit()
                except Exception:
                    pass
                try:
                    wal_checkpoint(self.rb_conn, "TRUNCATE")
                except Exception:
                    try:
                        wal_checkpoint(self.rb_conn, "PASSIVE")
                    except Exception:
                        pass
        except Exception:
            pass
        try:
            self.rb_conn.close()
        except Exception:
            pass

    def _maybe_checkpoint(self, *, force: bool = False, truncate: bool = False) -> Optional[Dict[str, Any]]:
        now = time.monotonic()
        if not force and self._checkpoint_every_s > 0 and (now - self._last_checkpoint) < self._checkpoint_every_s:
            return None
        mode = "TRUNCATE" if truncate else self._checkpoint_mode
        try:
            info = wal_checkpoint(self.rb_conn, mode)
        except Exception as e:
            info = {"error": str(e)}
        self._last_checkpoint = now
        return {"mode": mode, "info": info}

    def checkpoint(self, mode: str = "TRUNCATE") -> Dict[str, Any]:
        m = (mode or "TRUNCATE").strip().upper()
        if m not in ("PASSIVE", "FULL", "RESTART", "TRUNCATE"):
            m = "TRUNCATE"
        with self._lock:
            try:
                self.rb_conn.commit()
            except Exception:
                pass
            try:
                return {"ok": True, "mode": m, "info": wal_checkpoint(self.rb_conn, m)}
            except Exception as e:
                return {"ok": False, "mode": m, "error": str(e)}

    def counts(self) -> Dict[str, Any]:
        with self._lock:
            cur = self.rb_conn.cursor()
            tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()]
            out: Dict[str, Any] = {"ok": True, "version": APP_VERSION, "roblox_db": ROBLOX_DB_PATH, "tables": {}}
            try:
                out["sqlite"] = {
                    "journal_mode": str(cur.execute("PRAGMA journal_mode").fetchone()[0]),
                    "wal_autocheckpoint": int(cur.execute("PRAGMA wal_autocheckpoint").fetchone()[0]),
                }
            except Exception:
                pass
            try:
                wal_p = ROBLOX_DB_PATH + "-wal"
                shm_p = ROBLOX_DB_PATH + "-shm"
                out["files"] = {
                    "db_bytes": int(os.path.getsize(ROBLOX_DB_PATH)) if os.path.exists(ROBLOX_DB_PATH) else 0,
                    "wal_bytes": int(os.path.getsize(wal_p)) if os.path.exists(wal_p) else 0,
                    "shm_bytes": int(os.path.getsize(shm_p)) if os.path.exists(shm_p) else 0,
                }
            except Exception:
                pass
            for t in tables:
                try:
                    out["tables"][t] = int(cur.execute(f"SELECT COUNT(1) FROM {t}").fetchone()[0])
                except Exception:
                    continue
            return out

    def _rollback_quietly(self) -> None:
        try:
            self.rb_conn.rollback()
        except Exception:
            pass

    def _try_insert_raw_ingest(self, payload: Dict[str, Any], kind: Any) -> Optional[str]:
        try:
            insert_raw_ingest(
                self.rb_conn,
                source=payload.get("source"),
                page_url=payload.get("url"),
                kind=kind,
                payload_obj=payload,
            )
            return None
        except sqlite3.DatabaseError as e:
            self._rollback_quietly()
            return f"raw_ingest_skipped: {e}"
        except Exception as e:
            self._rollback_quietly()
            return f"raw_ingest_skipped: {e}"

    def _attach_raw_warning(self, obj: Dict[str, Any], raw_warning: Optional[str]) -> Dict[str, Any]:
        if not raw_warning:
            return obj
        out = dict(obj or {})
        out["raw_ingest_saved"] = False
        out["raw_ingest_warning"] = raw_warning
        return out

    def ingest(self, payload: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
        ptype = payload.get("type")
        raw_warning: Optional[str] = None
        try:
            if ptype == "roblox_records":
                with self._lock:
                    raw_warning = self._try_insert_raw_ingest(payload, ptype)
                    res = self.rb_site.ingest(self.rb_conn, payload)
                    self.rb_conn.commit()
                    self._maybe_checkpoint()
                return 200, self._attach_raw_warning(res if isinstance(res, dict) else {"ok": True, "result": res}, raw_warning)

            # layout capture intentionally disabled
            if ptype == "roblox_layout":
                with self._lock:
                    raw_warning = self._try_insert_raw_ingest(payload, ptype)
                    self.rb_conn.commit()
                    self._maybe_checkpoint()
                return 200, self._attach_raw_warning({"ok": True, "disabled": True}, raw_warning)

            with self._lock:
                raw_warning = self._try_insert_raw_ingest(payload, str(ptype) if ptype else "unknown")
                self.rb_conn.commit()
                self._maybe_checkpoint()
            return 200, self._attach_raw_warning({"ok": True, "note": "unknown_payload_type_saved_raw_only"}, raw_warning)
        except sqlite3.DatabaseError as e:
            self._rollback_quietly()
            return 500, self._attach_raw_warning({"ok": False, "error": f"sqlite_database_error: {e}"}, raw_warning)
        except Exception as e:
            self._rollback_quietly()
            return 500, self._attach_raw_warning({"ok": False, "error": f"ingest_error: {e}"}, raw_warning)

    def discovery_claim(self, payload: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
        with self._lock:
            res = self.rb_site.claim_discovery(
                self.rb_conn,
                minimum_id=int(payload.get("minimum_id") or 1),
                claimed_by=str(payload.get("claimed_by") or "unknown"),
                lease_seconds=int(payload.get("lease_seconds") or 120),
            )
            self._maybe_checkpoint()
            return 200, res

    def climb_claim(self, payload: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
        with self._lock:
            res = self.rb_site.claim_climb(
                self.rb_conn,
                claimed_by=str(payload.get("claimed_by") or "unknown"),
                lease_seconds=int(payload.get("lease_seconds") or 120),
            )
            self._maybe_checkpoint()
            return 200, res

    def finish_claim(self, payload: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
        with self._lock:
            res = self.rb_site.claim_finish(
                self.rb_conn,
                claimed_by=str(payload.get("claimed_by") or "unknown"),
                lease_seconds=int(payload.get("lease_seconds") or 120),
            )
            self._maybe_checkpoint()
            return 200, res

    def claim_renew(self, payload: Dict[str, Any], mode: str) -> Tuple[int, Dict[str, Any]]:
        with self._lock:
            res = self.rb_site.renew_claim(
                self.rb_conn,
                mode=mode,
                group_id=int(payload.get("group_id") or 0),
                claimed_by=str(payload.get("claimed_by") or "unknown"),
                lease_seconds=int(payload.get("lease_seconds") or 120),
            )
            self._maybe_checkpoint()
            return 200, res

    def claim_release(self, payload: Dict[str, Any], mode: str) -> Tuple[int, Dict[str, Any]]:
        with self._lock:
            res = self.rb_site.release_claim(
                self.rb_conn,
                mode=mode,
                group_id=int(payload.get("group_id") or 0),
                claimed_by=payload.get("claimed_by"),
            )
            self._maybe_checkpoint()
            return 200, res

    def discovery_complete(self, payload: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
        with self._lock:
            res = self.rb_site.complete_discovery(
                self.rb_conn,
                group_id=int(payload.get("group_id") or 0),
                claimed_by=payload.get("claimed_by"),
                group_name=payload.get("group_name"),
                member_count=payload.get("member_count"),
                status=str(payload.get("status") or "ERROR"),
                checked=payload.get("checked"),
            )
            self._maybe_checkpoint(force=True)
            return 200, res

    def climb_complete(self, payload: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
        with self._lock:
            res = self.rb_site.complete_climb(
                self.rb_conn,
                group_id=int(payload.get("group_id") or 0),
                claimed_by=payload.get("claimed_by"),
                status=str(payload.get("status") or "CLIMBED"),
                checked=payload.get("checked"),
                boundary_date=payload.get("boundary_date"),
                reached_timestamp=payload.get("reached_timestamp"),
            )
            self._maybe_checkpoint(force=True)
            return 200, res

    def finish_complete(self, payload: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
        with self._lock:
            res = self.rb_site.complete_finish(
                self.rb_conn,
                group_id=int(payload.get("group_id") or 0),
                claimed_by=payload.get("claimed_by"),
                status=str(payload.get("status") or "DONE"),
                checked=payload.get("checked"),
                reached_timestamp=payload.get("reached_timestamp"),
            )
            self._maybe_checkpoint(force=True)
            return 200, res


STATE = OmniState()


def _shutdown_server() -> None:
    try:
        STATE.close()
    except Exception:
        pass


atexit.register(_shutdown_server)


def _signal_handler(signum: int, frame: Any) -> None:
    _shutdown_server()
    raise SystemExit(0)


for _sig in (getattr(signal, "SIGINT", None), getattr(signal, "SIGTERM", None)):
    try:
        if _sig is not None:
            signal.signal(_sig, _signal_handler)
    except Exception:
        pass


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: Any) -> None:
        return

    def do_OPTIONS(self) -> None:
        _json_response(self, 200, {"ok": True})

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/ping":
            _json_response(self, 200, {"ok": True, "version": APP_VERSION, "db_path": ROBLOX_DB_PATH, "python": sys.version.split()[0]})
            return
        if path == "/counts":
            _json_response(self, 200, STATE.counts())
            return
        if path == "/checkpoint":
            q = urlparse(self.path).query
            mode = "TRUNCATE"
            try:
                for part in q.split("&"):
                    if part.lower().startswith("mode="):
                        mode = part.split("=", 1)[1]
                        break
            except Exception:
                pass
            _json_response(self, 200, STATE.checkpoint(mode))
            return
        _json_response(self, 404, {"ok": False, "error": "not_found"})

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except Exception:
            length = 0
        if length <= 0:
            _json_response(self, 400, {"ok": False, "error": "empty_body"})
            return
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode("utf-8", errors="replace"))
        except Exception as e:
            _json_response(self, 400, {"ok": False, "error": f"invalid_json: {e}"})
            return
        if not isinstance(payload, dict):
            _json_response(self, 400, {"ok": False, "error": "payload_not_object"})
            return

        if path == "/proxy_fetch_json":
            url = str(payload.get("url") or "").strip()
            if not url:
                _json_response(self, 400, {"ok": False, "error": "missing_url"})
                return
            headers = payload.get("headers")
            proxy_value = payload.get("proxy") or payload.get("proxyValue")
            _json_response(self, 200, _proxy_fetch_json(url, proxy_value, headers if isinstance(headers, dict) else None))
            return

        route_map = {
            "/ingest": STATE.ingest,
            "/discovery/claim": STATE.discovery_claim,
            "/discovery/renew": lambda p: STATE.claim_renew(p, "discovery"),
            "/discovery/release": lambda p: STATE.claim_release(p, "discovery"),
            "/discovery/complete": STATE.discovery_complete,
            "/climb/claim": STATE.climb_claim,
            "/climb/renew": lambda p: STATE.claim_renew(p, "climb"),
            "/climb/release": lambda p: STATE.claim_release(p, "climb"),
            "/climb/complete": STATE.climb_complete,
            "/finish/claim": STATE.finish_claim,
            "/finish/renew": lambda p: STATE.claim_renew(p, "finish"),
            "/finish/release": lambda p: STATE.claim_release(p, "finish"),
            "/finish/complete": STATE.finish_complete,
        }
        fn = route_map.get(path)
        if fn is None:
            _json_response(self, 404, {"ok": False, "error": "not_found"})
            return
        try:
            status, res = fn(payload)
        except Exception as e:
            _json_response(self, 500, {"ok": False, "error": f"server_exception: {e}"})
            return
        _json_response(self, status, res)


def main() -> None:
    os.makedirs(os.path.join(DATA_DIR, "roblox"), exist_ok=True)
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"[SERVER] Listening on http://{HOST}:{PORT}  |  data_dir={DATA_DIR}")
    print(f"[SERVER] Roblox DB: {ROBLOX_DB_PATH}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        try:
            STATE.close()
        except Exception:
            pass
        try:
            httpd.server_close()
        except Exception:
            pass


if __name__ == "__main__":
    main()
