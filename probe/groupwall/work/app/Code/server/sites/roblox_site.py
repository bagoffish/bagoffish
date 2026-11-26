#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

SITE_KEY = "roblox"


def now_iso_z() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _json_dumps(v: Any) -> str:
    return json.dumps(v, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _sha256_text(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _content_hash_from_row(row: Dict[str, Any], exclude: Iterable[str]) -> str:
    x = {k: row.get(k) for k in sorted(row.keys()) if k not in set(exclude)}
    return _sha256_text(_json_dumps(x))


def _to_int_bool(v: Any) -> Optional[int]:
    if v is None:
        return None
    if isinstance(v, bool):
        return 1 if v else 0
    if isinstance(v, (int, float)):
        return 1 if int(v) != 0 else 0
    if isinstance(v, str):
        s = v.strip().lower()
        if s in ("true", "t", "1", "yes", "y"):
            return 1
        if s in ("false", "f", "0", "no", "n"):
            return 0
    return None


def _safe_int(v: Any) -> Optional[int]:
    if v is None:
        return None
    try:
        return int(v)
    except Exception:
        return None


def _safe_text(v: Any) -> Optional[str]:
    if v is None:
        return None
    if isinstance(v, str):
        return v
    try:
        return str(v)
    except Exception:
        return None


def _coerce_json_text(v: Any) -> Optional[str]:
    if v is None:
        return None
    if isinstance(v, str):
        s = v.strip()
        if s == "" or s.lower() == "null":
            return None
        return s
    try:
        return json.dumps(v, ensure_ascii=False, sort_keys=True)
    except Exception:
        return None


def _parse_iso_ts(v: Any) -> Optional[str]:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        try:
            dt = datetime.fromtimestamp(float(v), tz=timezone.utc)
            return dt.isoformat().replace("+00:00", "Z")
        except Exception:
            return None
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return None
        if s.endswith("+00:00"):
            s = s[:-6] + "Z"
        return s
    return None


def _table_columns(cur: sqlite3.Cursor, table: str) -> Dict[str, str]:
    cols: Dict[str, str] = {}
    try:
        for row in cur.execute(f"PRAGMA table_info({table})").fetchall():
            cols[str(row[1])] = str(row[2])
    except Exception:
        pass
    return cols


def _ensure_column(cur: sqlite3.Cursor, table: str, col: str, ddl_type: str) -> None:
    cols = _table_columns(cur, table)
    if col in cols:
        return
    cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {ddl_type}")


def ensure_schema(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL;")
    cur.execute("PRAGMA synchronous=NORMAL;")
    cur.execute("PRAGMA temp_store=MEMORY;")
    cur.execute("PRAGMA foreign_keys=ON;")
    cur.execute("PRAGMA busy_timeout=5000;")
    cur.execute("PRAGMA wal_autocheckpoint=1000;")
    cur.execute("PRAGMA journal_size_limit=67108864;")

    # Drop unwanted legacy tables explicitly requested by the user.
    for table in (
        "rb_asset_archive",
        "rb_asset_map_archive",
        "rb_dynamic_announcements_archive",
        "rb_dynamic_event_archive",
        "rb_dynamic_forum_thread_archive",
        "rb_dynamic_forum_reply_archive",
        "rb_group_shout_archive",
        "rb_hierarchy_archive",
        "rb_layout_archive",
        "rb_static_enrich_queue",
    ):
        try:
            cur.execute(f"DROP TABLE IF EXISTS {table}")
        except Exception:
            pass

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS rb_raw_ingest_archive (
            uuid TEXT PRIMARY KEY,
            received TEXT NOT NULL,
            source TEXT,
            page_url TEXT,
            kind TEXT,
            payload TEXT NOT NULL
        )
        """
    )
    cur.execute("CREATE INDEX IF NOT EXISTS idx_rb_raw_kind_time ON rb_raw_ingest_archive(kind, received);")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS rb_static_archive (
            id INTEGER PRIMARY KEY,
            owner INTEGER,
            type TEXT,
            subtype TEXT,
            creation TEXT,
            active INTEGER,
            verified TEXT
        )
        """
    )
    cur.execute("CREATE INDEX IF NOT EXISTS idx_rb_static_type ON rb_static_archive(type);")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS rb_misc_archive (
            uuid TEXT PRIMARY KEY,
            url TEXT,
            key TEXT,
            captured TEXT,
            metadata TEXT
        )
        """
    )
    cur.execute("CREATE INDEX IF NOT EXISTS idx_rb_misc_key_time ON rb_misc_archive(key, captured);")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS rb_dynamic_group_archive (
            uuid TEXT PRIMARY KEY,
            id INTEGER NOT NULL,
            name TEXT,
            description TEXT,
            ranks TEXT,
            members INTEGER,
            funds INTEGER,
            verified INTEGER,
            links TEXT,
            affiliates TEXT,
            captured TEXT NOT NULL,
            content_hash TEXT
        )
        """
    )
    _ensure_column(cur, "rb_dynamic_group_archive", "verified", "INTEGER")
    _ensure_column(cur, "rb_dynamic_group_archive", "links", "TEXT")
    _ensure_column(cur, "rb_dynamic_group_archive", "affiliates", "TEXT")
    _ensure_column(cur, "rb_dynamic_group_archive", "captured", "TEXT")
    _ensure_column(cur, "rb_dynamic_group_archive", "content_hash", "TEXT")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_rb_dyn_group_id_time ON rb_dynamic_group_archive(id, captured);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_rb_dyn_group_hash ON rb_dynamic_group_archive(id, content_hash);")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS rb_group_wall_archive (
            post_id INTEGER PRIMARY KEY,
            group_id INTEGER,
            user_id INTEGER,
            username TEXT,
            role TEXT,
            body TEXT,
            created TEXT
        )
        """
    )
    _ensure_column(cur, "rb_group_wall_archive", "user_id", "INTEGER")
    _ensure_column(cur, "rb_group_wall_archive", "username", "TEXT")
    _ensure_column(cur, "rb_group_wall_archive", "role", "TEXT")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_rb_wall_group ON rb_group_wall_archive(group_id);")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS discovery (
            GroupID INTEGER PRIMARY KEY,
            GroupName TEXT,
            MemberCount INTEGER,
            Status TEXT NOT NULL,
            Checked TEXT NOT NULL,
            BoundaryDate TEXT,
            ReachedTimestamp TEXT
        )
        """
    )
    _ensure_column(cur, "discovery", "MemberCount", "INTEGER")
    _ensure_column(cur, "discovery", "BoundaryDate", "TEXT")
    _ensure_column(cur, "discovery", "ReachedTimestamp", "TEXT")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_discovery_status_checked ON discovery(Status, Checked, GroupID);")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS discovery_runtime (
            Key TEXT PRIMARY KEY,
            Value TEXT,
            Updated TEXT NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS discovery_claims (
            Mode TEXT NOT NULL,
            ClaimKey TEXT NOT NULL,
            ClaimedBy TEXT NOT NULL,
            ClaimedAt TEXT NOT NULL,
            LeaseUntil TEXT NOT NULL,
            Payload TEXT,
            PRIMARY KEY (Mode, ClaimKey)
        )
        """
    )
    cur.execute("CREATE INDEX IF NOT EXISTS idx_discovery_claims_mode_lease ON discovery_claims(Mode, LeaseUntil);")
    conn.commit()


def insert_raw_ingest(
    conn: sqlite3.Connection,
    source: Optional[str],
    page_url: Optional[str],
    kind: Optional[str],
    payload_obj: Any,
) -> None:
    conn.execute(
        "INSERT INTO rb_raw_ingest_archive(uuid, received, source, page_url, kind, payload) VALUES(?,?,?,?,?,?)",
        (str(uuid.uuid4()), now_iso_z(), source, page_url, kind, json.dumps(payload_obj, ensure_ascii=False)),
    )


def wal_checkpoint(conn: sqlite3.Connection, mode: str = "PASSIVE") -> Dict[str, int]:
    m = (mode or "PASSIVE").strip().upper()
    if m not in ("PASSIVE", "FULL", "RESTART", "TRUNCATE"):
        m = "PASSIVE"
    row = conn.execute(f"PRAGMA wal_checkpoint({m});").fetchone()
    if row is None:
        return {"busy": 0, "log": 0, "checkpointed": 0}
    try:
        busy = int(row[0])
        log = int(row[1])
        checkpointed = int(row[2])
    except Exception:
        busy = 0
        log = 0
        checkpointed = 0
    return {"busy": busy, "log": log, "checkpointed": checkpointed}


def open_connection(db_path: str) -> sqlite3.Connection:
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA busy_timeout=5000;")
    except Exception:
        pass
    ensure_schema(conn)
    return conn


class RobloxSite:
    def __init__(self, db_path: str):
        self.db_path = db_path

    def start_background_workers(self) -> None:
        return

    def stop_background_workers(self) -> None:
        return

    def _get_latest_row(self, conn: sqlite3.Connection, table: str, key_col: str, key_val: Any) -> Optional[Dict[str, Any]]:
        row = conn.execute(
            f"SELECT * FROM {table} WHERE {key_col}=? ORDER BY captured DESC LIMIT 1",
            (key_val,),
        ).fetchone()
        return dict(row) if row else None

    def ingest(self, conn: sqlite3.Connection, payload: Dict[str, Any]) -> Dict[str, Any]:
        recs = payload.get("records") or []
        if not isinstance(recs, list):
            return {"ok": False, "error": "records_not_list"}

        inserted = 0
        skipped = 0
        errors: List[str] = []

        for block in recs:
            if not isinstance(block, dict):
                continue
            t = block.get("type")
            rows = block.get("rows") or []
            if not isinstance(rows, list) or not t:
                continue

            try:
                if t == "rb_static_archive":
                    a, b = self._ingest_static(conn, rows)
                elif t == "rb_dynamic_group_archive":
                    a, b = self._ingest_dynamic_group(conn, rows)
                elif t == "rb_group_wall_archive":
                    a, b = self._ingest_wall(conn, rows)
                elif t == "rb_misc_archive":
                    a, b = self._ingest_misc(conn, rows)
                elif t == "discovery":
                    a, b = self._ingest_discovery_rows(conn, rows)
                else:
                    a, b = 0, len(rows)
                inserted += a
                skipped += b
            except Exception as e:
                errors.append(f"{t}: {e}")

        conn.commit()
        return {"ok": True, "inserted": inserted, "skipped": skipped, "errors": errors[:20]}

    def _ingest_static(self, conn: sqlite3.Connection, rows: List[Dict[str, Any]]) -> Tuple[int, int]:
        ins = 0
        skip = 0
        cur = conn.cursor()
        for r in rows:
            if not isinstance(r, dict):
                continue
            rid = _safe_int(r.get("id"))
            if rid is None:
                skip += 1
                continue
            cur.execute(
                """
                INSERT INTO rb_static_archive(id, owner, type, subtype, creation, active, verified)
                VALUES(?,?,?,?,?,?,?)
                ON CONFLICT(id) DO UPDATE SET
                    owner = COALESCE(excluded.owner, rb_static_archive.owner),
                    type = COALESCE(excluded.type, rb_static_archive.type),
                    subtype = COALESCE(excluded.subtype, rb_static_archive.subtype),
                    creation = COALESCE(rb_static_archive.creation, excluded.creation),
                    active = COALESCE(excluded.active, rb_static_archive.active),
                    verified = COALESCE(excluded.verified, rb_static_archive.verified)
                """,
                (
                    rid,
                    _safe_int(r.get("owner")),
                    _safe_text(r.get("type")),
                    _safe_text(r.get("subtype")),
                    _parse_iso_ts(r.get("creation")),
                    _to_int_bool(r.get("active")),
                    _parse_iso_ts(r.get("verified")),
                ),
            )
            ins += 1
        return ins, skip

    def _ingest_dynamic_group(self, conn: sqlite3.Connection, rows: List[Dict[str, Any]]) -> Tuple[int, int]:
        cur = conn.cursor()
        ins = 0
        skip = 0

        for r in rows:
            if not isinstance(r, dict):
                continue
            gid = _safe_int(r.get("id"))
            if gid is None:
                skip += 1
                continue

            captured = _parse_iso_ts(r.get("captured")) or now_iso_z()
            new_row = {
                "id": gid,
                "name": _safe_text(r.get("name")),
                "description": _safe_text(r.get("description")),
                "ranks": _coerce_json_text(r.get("ranks")),
                "members": _safe_int(r.get("members")),
                "funds": _safe_int(r.get("funds")),
                "verified": _to_int_bool(r.get("verified")),
                "links": _coerce_json_text(r.get("links")),
                "affiliates": _coerce_json_text(r.get("affiliates")),
                "captured": captured,
            }

            prev = self._get_latest_row(conn, "rb_dynamic_group_archive", "id", gid)
            prev_hash = None
            if prev:
                for k in ("name", "description", "ranks", "members", "funds", "verified", "links", "affiliates"):
                    if new_row.get(k) is None and prev.get(k) is not None:
                        new_row[k] = prev.get(k)
                prev_hash = prev.get("content_hash")

            if (
                not new_row.get("name")
                and new_row.get("members") is None
                and not new_row.get("description")
                and not new_row.get("ranks")
                and not new_row.get("links")
                and not new_row.get("affiliates")
            ):
                skip += 1
                continue

            content_hash = _content_hash_from_row(new_row, exclude=("uuid", "captured", "content_hash"))
            if prev_hash and content_hash == prev_hash:
                skip += 1
                continue

            cur.execute(
                """
                INSERT INTO rb_dynamic_group_archive(
                    uuid, id, name, description, ranks, members, funds, verified, links, affiliates, captured, content_hash
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    _safe_text(r.get("uuid")) or str(uuid.uuid4()),
                    gid,
                    new_row.get("name"),
                    new_row.get("description"),
                    new_row.get("ranks"),
                    new_row.get("members"),
                    new_row.get("funds"),
                    new_row.get("verified"),
                    new_row.get("links"),
                    new_row.get("affiliates"),
                    captured,
                    content_hash,
                ),
            )
            ins += 1
        return ins, skip

    def _ingest_wall(self, conn: sqlite3.Connection, rows: List[Dict[str, Any]]) -> Tuple[int, int]:
        cur = conn.cursor()
        ins = 0
        skip = 0
        for r in rows:
            if not isinstance(r, dict):
                continue
            post_id = _safe_int(r.get("post_id"))
            if post_id is None:
                skip += 1
                continue
            cur.execute(
                """
                INSERT INTO rb_group_wall_archive(post_id, group_id, user_id, username, role, body, created)
                VALUES(?,?,?,?,?,?,?)
                ON CONFLICT(post_id) DO UPDATE SET
                    group_id = COALESCE(excluded.group_id, rb_group_wall_archive.group_id),
                    user_id = COALESCE(excluded.user_id, rb_group_wall_archive.user_id),
                    username = COALESCE(excluded.username, rb_group_wall_archive.username),
                    role = COALESCE(excluded.role, rb_group_wall_archive.role),
                    body = COALESCE(excluded.body, rb_group_wall_archive.body),
                    created = COALESCE(excluded.created, rb_group_wall_archive.created)
                """,
                (
                    post_id,
                    _safe_int(r.get("group_id")),
                    _safe_int(r.get("user_id")),
                    _safe_text(r.get("username")),
                    _safe_text(r.get("role")),
                    _safe_text(r.get("body")),
                    _parse_iso_ts(r.get("created")),
                ),
            )
            ins += 1
        return ins, skip

    def _ingest_misc(self, conn: sqlite3.Connection, rows: List[Dict[str, Any]]) -> Tuple[int, int]:
        cur = conn.cursor()
        ins = 0
        skip = 0
        for r in rows:
            if not isinstance(r, dict):
                continue
            cur.execute(
                "INSERT OR REPLACE INTO rb_misc_archive(uuid, url, key, captured, metadata) VALUES(?,?,?,?,?)",
                (
                    _safe_text(r.get("uuid")) or str(uuid.uuid4()),
                    _safe_text(r.get("url")),
                    _safe_text(r.get("key")),
                    _parse_iso_ts(r.get("captured")) or now_iso_z(),
                    _coerce_json_text(r.get("metadata")),
                ),
            )
            ins += 1
        return ins, skip

    def _ingest_discovery_rows(self, conn: sqlite3.Connection, rows: List[Dict[str, Any]]) -> Tuple[int, int]:
        ins = 0
        skip = 0
        for r in rows:
            if not isinstance(r, dict):
                continue
            gid = _safe_int(r.get("GroupID") if "GroupID" in r else r.get("group_id"))
            status = _safe_text(r.get("Status") if "Status" in r else r.get("status"))
            if gid is None or not status:
                skip += 1
                continue
            self.complete_discovery(
                conn,
                group_id=gid,
                claimed_by=None,
                group_name=_safe_text(r.get("GroupName") if "GroupName" in r else r.get("group_name")),
                member_count=_safe_int(r.get("MemberCount") if "MemberCount" in r else r.get("member_count")),
                status=status,
                checked=_parse_iso_ts(r.get("Checked") if "Checked" in r else r.get("checked")) or now_iso_z(),
                boundary_date=_safe_text(r.get("BoundaryDate") if "BoundaryDate" in r else r.get("boundary_date")),
                reached_timestamp=_parse_iso_ts(r.get("ReachedTimestamp") if "ReachedTimestamp" in r else r.get("reached_timestamp")),
            )
            ins += 1
        return ins, skip

    def _lease_until(self, lease_seconds: Any) -> str:
        secs = _safe_int(lease_seconds)
        if secs is None:
            secs = 120
        secs = max(15, min(3600, secs))
        return (datetime.now(timezone.utc) + timedelta(seconds=secs)).isoformat().replace("+00:00", "Z")

    def _cleanup_expired_claims(self, conn: sqlite3.Connection) -> None:
        conn.execute("DELETE FROM discovery_claims WHERE LeaseUntil < ?", (now_iso_z(),))

    def _runtime_get_int(self, conn: sqlite3.Connection, key: str, default: int) -> int:
        row = conn.execute("SELECT Value FROM discovery_runtime WHERE Key=?", (key,)).fetchone()
        if not row:
            return default
        try:
            return int(row["Value"])
        except Exception:
            try:
                return int(row[0])
            except Exception:
                return default

    def _runtime_set_int(self, conn: sqlite3.Connection, key: str, value: int) -> None:
        conn.execute(
            """
            INSERT INTO discovery_runtime(Key, Value, Updated)
            VALUES(?,?,?)
            ON CONFLICT(Key) DO UPDATE SET
                Value=excluded.Value,
                Updated=excluded.Updated
            """,
            (key, str(int(value)), now_iso_z()),
        )

    def claim_discovery(self, conn: sqlite3.Connection, minimum_id: int, claimed_by: str, lease_seconds: int = 120) -> Dict[str, Any]:
        minimum_id = max(1, _safe_int(minimum_id) or 1)
        claimed_by = _safe_text(claimed_by) or "unknown"
        conn.execute("BEGIN IMMEDIATE")
        try:
            self._cleanup_expired_claims(conn)
            current = self._runtime_get_int(conn, "discovery_next_id", minimum_id)
            if current < minimum_id:
                current = minimum_id
            self._runtime_set_int(conn, "discovery_next_id", current + 1)
            payload = _json_dumps({"group_id": current, "minimum_id": minimum_id})
            conn.execute(
                """
                INSERT INTO discovery_claims(Mode, ClaimKey, ClaimedBy, ClaimedAt, LeaseUntil, Payload)
                VALUES(?,?,?,?,?,?)
                ON CONFLICT(Mode, ClaimKey) DO UPDATE SET
                    ClaimedBy=excluded.ClaimedBy,
                    ClaimedAt=excluded.ClaimedAt,
                    LeaseUntil=excluded.LeaseUntil,
                    Payload=excluded.Payload
                """,
                ("discovery", str(current), claimed_by, now_iso_z(), self._lease_until(lease_seconds), payload),
            )
            conn.commit()
            return {"ok": True, "group_id": current}
        except Exception:
            conn.rollback()
            raise

    def claim_climb(self, conn: sqlite3.Connection, claimed_by: str, lease_seconds: int = 120) -> Dict[str, Any]:
        claimed_by = _safe_text(claimed_by) or "unknown"
        conn.execute("BEGIN IMMEDIATE")
        try:
            self._cleanup_expired_claims(conn)
            row = conn.execute(
                """
                SELECT d.GroupID, d.GroupName, d.MemberCount, d.Status, d.BoundaryDate, d.ReachedTimestamp
                FROM discovery d
                LEFT JOIN discovery_claims c
                  ON c.Mode='climb'
                 AND c.ClaimKey=CAST(d.GroupID AS TEXT)
                 AND c.LeaseUntil >= ?
                WHERE d.Status IN ('NEEDED')
                  AND c.ClaimKey IS NULL
                ORDER BY d.GroupID ASC
                LIMIT 1
                """,
                (now_iso_z(),),
            ).fetchone()
            if not row:
                conn.commit()
                return {"ok": True, "group_id": None}
            gid = int(row["GroupID"])
            payload = _json_dumps({
                "group_id": gid,
                "group_name": row["GroupName"],
                "member_count": row["MemberCount"],
                "status": row["Status"],
                "boundary_date": row["BoundaryDate"],
                "reached_timestamp": row["ReachedTimestamp"],
            })
            conn.execute(
                """
                INSERT INTO discovery_claims(Mode, ClaimKey, ClaimedBy, ClaimedAt, LeaseUntil, Payload)
                VALUES(?,?,?,?,?,?)
                ON CONFLICT(Mode, ClaimKey) DO UPDATE SET
                    ClaimedBy=excluded.ClaimedBy,
                    ClaimedAt=excluded.ClaimedAt,
                    LeaseUntil=excluded.LeaseUntil,
                    Payload=excluded.Payload
                """,
                ("climb", str(gid), claimed_by, now_iso_z(), self._lease_until(lease_seconds), payload),
            )
            conn.commit()
            return {
                "ok": True,
                "group_id": gid,
                "group_name": row["GroupName"],
                "member_count": row["MemberCount"],
                "status": row["Status"],
                "boundary_date": row["BoundaryDate"],
                "reached_timestamp": row["ReachedTimestamp"],
            }
        except Exception:
            conn.rollback()
            raise

    def claim_finish(self, conn: sqlite3.Connection, claimed_by: str, lease_seconds: int = 120) -> Dict[str, Any]:
        claimed_by = _safe_text(claimed_by) or "unknown"
        conn.execute("BEGIN IMMEDIATE")
        try:
            self._cleanup_expired_claims(conn)
            row = conn.execute(
                """
                SELECT d.GroupID, d.GroupName, d.MemberCount, d.Status, d.BoundaryDate, d.ReachedTimestamp
                FROM discovery d
                LEFT JOIN discovery_claims c
                  ON c.Mode='finish'
                 AND c.ClaimKey=CAST(d.GroupID AS TEXT)
                 AND c.LeaseUntil >= ?
                WHERE d.Status IN ('PARTIAL')
                  AND d.ReachedTimestamp IS NOT NULL
                  AND d.ReachedTimestamp <> ''
                  AND c.ClaimKey IS NULL
                ORDER BY d.GroupID ASC
                LIMIT 1
                """,
                (now_iso_z(),),
            ).fetchone()
            if not row:
                conn.commit()
                return {"ok": True, "group_id": None}
            gid = int(row["GroupID"])
            payload = _json_dumps({
                "group_id": gid,
                "group_name": row["GroupName"],
                "member_count": row["MemberCount"],
                "status": row["Status"],
                "boundary_date": row["BoundaryDate"],
                "reached_timestamp": row["ReachedTimestamp"],
            })
            conn.execute(
                """
                INSERT INTO discovery_claims(Mode, ClaimKey, ClaimedBy, ClaimedAt, LeaseUntil, Payload)
                VALUES(?,?,?,?,?,?)
                ON CONFLICT(Mode, ClaimKey) DO UPDATE SET
                    ClaimedBy=excluded.ClaimedBy,
                    ClaimedAt=excluded.ClaimedAt,
                    LeaseUntil=excluded.LeaseUntil,
                    Payload=excluded.Payload
                """,
                ("finish", str(gid), claimed_by, now_iso_z(), self._lease_until(lease_seconds), payload),
            )
            conn.commit()
            return {
                "ok": True,
                "group_id": gid,
                "group_name": row["GroupName"],
                "member_count": row["MemberCount"],
                "status": row["Status"],
                "boundary_date": row["BoundaryDate"],
                "reached_timestamp": row["ReachedTimestamp"],
            }
        except Exception:
            conn.rollback()
            raise

    def renew_claim(self, conn: sqlite3.Connection, mode: str, group_id: int, claimed_by: str, lease_seconds: int = 120) -> Dict[str, Any]:
        mode_in = str(mode).strip().lower()
        mode = "finish" if mode_in == "finish" else ("climb" if mode_in == "climb" else "discovery")
        gid = _safe_int(group_id)
        claimed_by = _safe_text(claimed_by) or "unknown"
        if gid is None:
            return {"ok": False, "error": "missing_group_id"}
        cur = conn.execute(
            """
            UPDATE discovery_claims
               SET LeaseUntil=?
             WHERE Mode=? AND ClaimKey=? AND ClaimedBy=?
            """,
            (self._lease_until(lease_seconds), mode, str(gid), claimed_by),
        )
        conn.commit()
        return {"ok": cur.rowcount > 0}

    def release_claim(self, conn: sqlite3.Connection, mode: str, group_id: int, claimed_by: Optional[str]) -> Dict[str, Any]:
        mode_in = str(mode).strip().lower()
        mode = "finish" if mode_in == "finish" else ("climb" if mode_in == "climb" else "discovery")
        gid = _safe_int(group_id)
        if gid is None:
            return {"ok": False, "error": "missing_group_id"}
        if claimed_by:
            cur = conn.execute(
                "DELETE FROM discovery_claims WHERE Mode=? AND ClaimKey=? AND ClaimedBy=?",
                (mode, str(gid), str(claimed_by)),
            )
        else:
            cur = conn.execute("DELETE FROM discovery_claims WHERE Mode=? AND ClaimKey=?", (mode, str(gid)))
        conn.commit()
        return {"ok": True, "deleted": int(cur.rowcount)}

    def complete_discovery(
        self,
        conn: sqlite3.Connection,
        group_id: int,
        claimed_by: Optional[str],
        group_name: Optional[str],
        member_count: Optional[int],
        status: str,
        checked: Optional[str] = None,
        boundary_date: Optional[str] = None,
        reached_timestamp: Optional[str] = None,
    ) -> Dict[str, Any]:
        gid = _safe_int(group_id)
        if gid is None:
            return {"ok": False, "error": "missing_group_id"}
        status_text = _safe_text(status) or "ERROR"
        checked = _parse_iso_ts(checked) or now_iso_z()
        conn.execute(
            """
            INSERT INTO discovery(GroupID, GroupName, MemberCount, Status, Checked, BoundaryDate, ReachedTimestamp)
            VALUES(?,?,?,?,?,?,?)
            ON CONFLICT(GroupID) DO UPDATE SET
                GroupName=COALESCE(excluded.GroupName, discovery.GroupName),
                MemberCount=COALESCE(excluded.MemberCount, discovery.MemberCount),
                Status=excluded.Status,
                Checked=excluded.Checked,
                BoundaryDate=COALESCE(excluded.BoundaryDate, discovery.BoundaryDate),
                ReachedTimestamp=COALESCE(excluded.ReachedTimestamp, discovery.ReachedTimestamp)
            """,
            (gid, _safe_text(group_name), _safe_int(member_count), status_text, checked, _safe_text(boundary_date), _parse_iso_ts(reached_timestamp)),
        )
        self.release_claim(conn, "discovery", gid, claimed_by)
        conn.commit()
        return {"ok": True, "group_id": gid, "status": status_text}

    def complete_climb(
        self,
        conn: sqlite3.Connection,
        group_id: int,
        claimed_by: Optional[str],
        status: str = "CLIMBED",
        checked: Optional[str] = None,
        boundary_date: Optional[str] = None,
        reached_timestamp: Optional[str] = None,
    ) -> Dict[str, Any]:
        gid = _safe_int(group_id)
        if gid is None:
            return {"ok": False, "error": "missing_group_id"}
        checked = _parse_iso_ts(checked) or now_iso_z()
        status_text = _safe_text(status) or "CLIMBED"
        conn.execute(
            "UPDATE discovery SET Status=?, Checked=?, BoundaryDate=COALESCE(?, BoundaryDate), ReachedTimestamp=COALESCE(?, ReachedTimestamp) WHERE GroupID=?",
            (status_text, checked, _safe_text(boundary_date), _parse_iso_ts(reached_timestamp), gid),
        )
        self.release_claim(conn, "climb", gid, claimed_by)
        conn.commit()
        return {"ok": True, "group_id": gid, "status": status_text}

    def complete_finish(
        self,
        conn: sqlite3.Connection,
        group_id: int,
        claimed_by: Optional[str],
        status: str = "DONE",
        checked: Optional[str] = None,
        reached_timestamp: Optional[str] = None,
    ) -> Dict[str, Any]:
        gid = _safe_int(group_id)
        if gid is None:
            return {"ok": False, "error": "missing_group_id"}
        checked = _parse_iso_ts(checked) or now_iso_z()
        status_text = _safe_text(status) or "DONE"
        conn.execute(
            "UPDATE discovery SET Status=?, Checked=?, ReachedTimestamp=COALESCE(?, ReachedTimestamp) WHERE GroupID=?",
            (status_text, checked, _parse_iso_ts(reached_timestamp), gid),
        )
        self.release_claim(conn, "finish", gid, claimed_by)
        conn.commit()
        return {"ok": True, "group_id": gid, "status": status_text}
