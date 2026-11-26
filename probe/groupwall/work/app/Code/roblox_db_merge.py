#!/usr/bin/env python3
from __future__ import annotations

import base64
import hashlib
import json
import os
import shutil
import sqlite3
import threading
import time
import traceback
from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from tkinter import BOTH, END, LEFT, RIGHT, W, X, Y, filedialog, messagebox, StringVar, Tk
from tkinter import scrolledtext
from tkinter import ttk
from typing import Any, Iterable, Sequence

APP_TITLE = "Roblox DB Merge GUI"
STATE_FILE_NAME = "roblox_db_merge_state.json"
MAIN_WALL_TABLES = {"rb_group_wall_archive", "rb_group_wall", "rb_wall_archive"}
MAIN_SHOUT_TABLES = {"rb_group_shout_archive", "rb_shout_archive", "wall_posts"}
SPECIAL_PARTIAL_LOGS = {
    "rb_wall_archive": ["group_name", "status", "captured"],
    "rb_group_shout_archive": ["captured", "role", "shout_id"],
    "rb_shout_archive": ["captured", "status", "group_name"],
    "wall_posts": [
        "owner_id", "is_verified", "member_count", "created", "public_entry_allowed",
        "wall_access_type", "wall_requires_cookie", "wall_access_checked_at",
        "wall_quick_complete", "wall_full_complete", "wall_in_progress",
        "claimed_by", "claimed_at", "last_error", "last_attempt_at",
        "discovered_at", "last_updated_at",
    ],
}

DEFAULT_INPUTS = [
    r"E:\Roblox\Roblox_001.db",
    r"E:\Roblox\Roblox_002.db",
    r"E:\Roblox\Roblox_003.db",
    r"E:\Roblox\Roblox_005.db",
    r"E:\Roblox\Roblox_004.db",
    r"E:\Roblox\roblox_groups_ENRICHMENT2.sqlite",
    r"E:\Roblox\Roblox.db",
    r"E:\Roblox\Roblox_004.05.db",
    r"E:\Roblox\roblox_archive_BACKUP15.db",
    r"E:\Roblox\Roblox_2026-02-15_01.42.db",
    r"E:\Roblox\Roblox_0.db",
    r"E:\Roblox\Roblox2.db",
    r"E:\Roblox\roblox_archive.db",
    r"E:\Roblox\roblox_groups_2026-01-15_14.11.sqlite",
    r"E:\Roblox\roblox_groups.sqlite",
    r"E:\Roblox\roblox_groups_FULL-1-40M.sqlite",
    r"E:\Roblox\roblox_groups1.sqlite",
    r"E:\Roblox\RobloxUsers.db",
    r"E:\Roblox\roblox_groups_MORE_ENRICHMENT.sqlite",
]

DEFAULT_OUTPUTS = {
    "wall": r"E:\Roblox\OUTPUT\RobloxGroupWall.db",
    "wall_dupes": r"E:\Roblox\OUTPUT\RobloxGroupWallDupes.db",
    "shout": r"E:\Roblox\OUTPUT\RobloxGroupShout.db",
    "logs": r"E:\Roblox\OUTPUT\RobloxGroupArchiveLogs.db",
}

STATE_SAVE_INTERVAL_SECONDS = 30.0
STATE_BATCH_LOG_INTERVAL_SECONDS = 60.0
TABLE_PROGRESS_LOG_INTERVAL_SECONDS = 30.0
TABLE_PROGRESS_LOG_ROWS = 1_000_000

SPEED_PROFILES: dict[str, dict[str, Any]] = {
    "Safe": {
        "journal_mode": "WAL",
        "synchronous": "FULL",
        "cache_kib": 256_000,
        "mmap_size": 0,
        "fetch_batch": 1000,
        "commit_rows": 5000,
    },
    "Balanced": {
        "journal_mode": "WAL",
        "synchronous": "NORMAL",
        "cache_kib": 512_000,
        "mmap_size": 256 * 1024 * 1024,
        "fetch_batch": 5000,
        "commit_rows": 25000,
    },
    "Fast": {
        "journal_mode": "WAL",
        "synchronous": "OFF",
        "cache_kib": 1_024_000,
        "mmap_size": 1024 * 1024 * 1024,
        "fetch_batch": 10000,
        "commit_rows": 100000,
    },
    "Maximum": {
        "journal_mode": "WAL",
        "synchronous": "OFF",
        "cache_kib": 2_048_000,
        "mmap_size": 2 * 1024 * 1024 * 1024,
        "fetch_batch": 20000,
        "commit_rows": 250000,
    },
}


class ControlledStop(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass
class RunOptions:
    speed_profile: str = "Maximum"
    progress_mode: str = "Fast"
    delay_index_creation: bool = True
    skip_empty_tables: bool = True
    vacuum_after_stage: bool = False
    verify_writes: bool = False


def qident(name: str) -> str:
    return '"' + str(name).replace('"', '""') + '"'


def utc_now_text() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


def now_text() -> str:
    return datetime.now().strftime("%H:%M:%S")


def normalize_path_text(path: str) -> str:
    path = path.strip().strip('"').strip()
    if not path:
        return ""
    return os.path.normpath(path)


def ensure_parent_dir(path: str) -> None:
    Path(path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)


def read_nonempty_lines(text: str) -> list[str]:
    out: list[str] = []
    for line in text.splitlines():
        line = normalize_path_text(line)
        if line:
            out.append(line)
    return out


def backup_existing_file(path: str) -> str | None:
    if not os.path.exists(path):
        return None
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"{path}.bak_{ts}"
    shutil.move(path, backup_path)
    return backup_path


def canonical_value(value: Any) -> Any:
    if value is None:
        return {"t": "null"}
    if isinstance(value, bytes):
        return {"t": "bytes", "v": base64.b64encode(value).decode("ascii")}
    if isinstance(value, bool):
        return {"t": "bool", "v": int(value)}
    if isinstance(value, int):
        return {"t": "int", "v": value}
    if isinstance(value, float):
        return {"t": "float", "v": value}
    return {"t": "str", "v": str(value)}


def row_hash(values: Sequence[Any]) -> str:
    payload = json.dumps([canonical_value(v) for v in values], ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def deterministic_pick(rows: Sequence[dict[str, Any]], salt: str) -> dict[str, Any]:
    best_row = None
    best_key = None
    for row in rows:
        digest = hashlib.sha256((salt + json.dumps(row, sort_keys=True, default=str)).encode("utf-8")).hexdigest()
        if best_key is None or digest < best_key:
            best_key = digest
            best_row = row
    assert best_row is not None
    return best_row


def is_nullish(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and value.strip() == "":
        return True
    return False


def content_rank(value: Any) -> int:
    if is_nullish(value):
        return 0
    text = str(value).strip().lower()
    if text == "[ content deleted ]":
        return 1
    return 2


def content_length(value: Any) -> int:
    if is_nullish(value):
        return 0
    return len(str(value))


def non_role_null_count(row: dict[str, Any]) -> int:
    keys = ("group", "user", "username", "content", "created")
    return sum(1 for key in keys if is_nullish(row.get(key)))


def rows_identical_except(rows: Sequence[dict[str, Any]], ignored: set[str]) -> bool:
    if not rows:
        return True
    keys = set(rows[0].keys()) - ignored
    baseline = {k: rows[0].get(k) for k in keys}
    for row in rows[1:]:
        other = {k: row.get(k) for k in keys}
        if other != baseline:
            return False
    return True


def dedupe_exact_rows(rows: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for row in rows:
        sig = row_hash([row.get("post"), row.get("group"), row.get("user"), row.get("username"), row.get("role"), row.get("content"), row.get("created")])
        if sig in seen:
            continue
        seen.add(sig)
        out.append(row)
    return out


def choose_best_wall_row(rows: Sequence[dict[str, Any]]) -> tuple[dict[str, Any], str]:
    candidates = dedupe_exact_rows(rows)
    if len(candidates) == 1:
        return candidates[0], "single_or_exact_duplicate"

    max_content = max(content_rank(row.get("content")) for row in candidates)
    candidates = [row for row in candidates if content_rank(row.get("content")) == max_content]
    if len(candidates) == 1:
        return candidates[0], "content_quality"

    min_nulls = min(non_role_null_count(row) for row in candidates)
    candidates = [row for row in candidates if non_role_null_count(row) == min_nulls]
    if len(candidates) == 1:
        return candidates[0], "fewest_nulls"

    if rows_identical_except(candidates, {"role"}):
        return deterministic_pick(candidates, "role-only-random"), "role_only_random"

    if rows_identical_except(candidates, {"user", "username", "role"}):
        return deterministic_pick(candidates, "same-post-group-created-random"), "same_post_group_created_random"

    max_len = max(content_length(row.get("content")) for row in candidates)
    candidates = [row for row in candidates if content_length(row.get("content")) == max_len]
    if len(candidates) == 1:
        return candidates[0], "longest_content"

    return deterministic_pick(candidates, "fallback-random"), "fallback_random"


def infer_sqlite_type(column_name: str) -> str:
    col = column_name.lower()
    integerish = {
        "id", "group", "user", "post", "message_id", "group_id", "user_id", "owner_id", "shout_user_id",
        "source_group_id", "related_group_id", "target_id", "membercount", "member_count", "members",
        "funds", "depth", "attempts", "retry_count", "priority", "groups_done", "errors",
        "verified", "active", "done", "is_verified", "owner_verified", "public_entry",
        "public_entry_allowed", "builders_club", "wall_archived", "wall_quick_complete",
        "wall_full_complete", "wall_in_progress", "wall_requires_cookie", "consumed",
    }
    if col in integerish or col.endswith("_id") or col.endswith("count"):
        return "INTEGER"
    return "TEXT"


def parse_database_info_paths(text: str) -> tuple[list[str], list[str]]:
    inputs: list[str] = []
    outputs: list[str] = []
    mode: str | None = None
    in_paths = False
    for raw_line in text.splitlines():
        stripped = raw_line.strip()
        if stripped == "Paths":
            in_paths = True
            mode = None
            continue
        if in_paths and stripped == "Structure":
            break
        if not in_paths:
            continue
        if stripped == "Input":
            mode = "input"
            continue
        if stripped == "Output":
            mode = "output"
            continue
        if stripped.startswith('"') and stripped.endswith('"'):
            value = normalize_path_text(stripped.strip('"'))
            if mode == "input":
                inputs.append(value)
            elif mode == "output":
                outputs.append(value)
    return list(dict.fromkeys(inputs)), list(dict.fromkeys(outputs))


class MergeWorker:
    def __init__(
        self,
        gui: "MergeGUI",
        mode: str,
        input_paths: list[str],
        outputs: dict[str, str],
        options: RunOptions,
        count_selection: list[str] | None = None,
        resume: bool = False,
    ) -> None:
        self.gui = gui
        self.mode = mode
        self.resume_mode = resume
        self.input_paths = input_paths
        self.outputs = outputs
        self.options = options
        self.count_selection = count_selection or []
        self.run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.start_time = time.time()
        self.current_stage = "Idle"
        self.current_table_label = ""
        self.state_path = os.path.join(os.path.dirname(self.outputs["logs"]) or os.getcwd(), STATE_FILE_NAME)
        self.pause_event = gui.pause_event
        self.stop_event = gui.stop_event
        self.stage_plan: list[str] = []
        self.completed_stages: list[str] = []
        self.stage_state: dict[str, Any] = {}
        self.stats: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        self.wall_rule_counts: dict[str, int] = defaultdict(int)
        self.logs_name_map: dict[str, dict[str, Any]] = {}
        self.logs_name_counters: dict[str, int] = defaultdict(int)
        self.log_index_defs: dict[str, list[list[str]]] = defaultdict(list)
        self.pending_index_builds: dict[str, list[tuple[str, list[str]]]] = defaultdict(list)
        self.exact_stage_totals: dict[str, int] = defaultdict(int)
        self.fast_stage_totals: dict[str, int] = defaultdict(int)
        self.stage_units_done: dict[str, int] = defaultdict(int)
        self.logs_conn: sqlite3.Connection | None = None
        self.shout_conn: sqlite3.Connection | None = None
        self.wall_dupes_conn: sqlite3.Connection | None = None
        self.wall_conn: sqlite3.Connection | None = None
        self._commit_since_last = 0
        self._counted_once = False
        self.last_state_save_at = 0.0
        self.last_batch_state_log_at = 0.0
        self._table_progress_state: dict[str, tuple[float, int]] = {}

    # ---------- helpers ----------

    def profile(self) -> dict[str, Any]:
        return SPEED_PROFILES.get(self.options.speed_profile, SPEED_PROFILES["Maximum"])

    def batch_size(self) -> int:
        return int(self.profile()["fetch_batch"])

    def commit_rows(self) -> int:
        return int(self.profile()["commit_rows"])

    def log_gui(self, level: str, phase: str, message: str) -> None:
        self.gui.enqueue_log(f"[{now_text()}] {level.upper()} [{phase}] {message}")

    def ensure_logs_db_for_merge_log(self) -> None:
        if self.logs_conn is not None:
            return
        ensure_parent_dir(self.outputs["logs"])
        self.logs_conn = sqlite3.connect(self.outputs["logs"])
        self.logs_conn.row_factory = sqlite3.Row
        self.apply_pragmas(self.logs_conn)
        self.logs_conn.execute(
            """
            CREATE TABLE IF NOT EXISTS db_merge_log (
                log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                level TEXT NOT NULL,
                phase TEXT NOT NULL,
                percent REAL NOT NULL,
                message TEXT NOT NULL
            )
            """
        )
        self.logs_conn.execute(
            """
            CREATE TABLE IF NOT EXISTS _row_registry (
                table_name TEXT NOT NULL,
                row_hash TEXT NOT NULL,
                PRIMARY KEY (table_name, row_hash)
            )
            """
        )
        self.logs_conn.commit()

    def merge_log(self, level: str, phase: str, message: str) -> None:
        self.log_gui(level, phase, message)
        try:
            self.ensure_logs_db_for_merge_log()
            assert self.logs_conn is not None
            self.logs_conn.execute(
                "INSERT INTO db_merge_log (run_id, created_at, level, phase, percent, message) VALUES (?, ?, ?, ?, ?, ?)",
                (self.run_id, utc_now_text(), level.upper(), phase, round(self.compute_percent(), 4), message),
            )
            self.logs_conn.commit()
        except Exception:
            pass

    def apply_pragmas(self, conn: sqlite3.Connection) -> None:
        p = self.profile()
        conn.execute(f"PRAGMA journal_mode={p['journal_mode']};")
        conn.execute(f"PRAGMA synchronous={p['synchronous']};")
        conn.execute("PRAGMA temp_store=MEMORY;")
        conn.execute("PRAGMA foreign_keys=OFF;")
        conn.execute(f"PRAGMA cache_size=-{int(p['cache_kib'])};")
        conn.execute(f"PRAGMA mmap_size={int(p['mmap_size'])};")

    def connect_db(self, path: str) -> sqlite3.Connection:
        ensure_parent_dir(path)
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        self.apply_pragmas(conn)
        return conn

    def close_outputs(self) -> None:
        for conn in (self.wall_conn, self.wall_dupes_conn, self.shout_conn, self.logs_conn):
            if conn is not None:
                try:
                    conn.commit()
                except Exception:
                    pass
                try:
                    conn.close()
                except Exception:
                    pass
        self.wall_conn = None
        self.wall_dupes_conn = None
        self.shout_conn = None
        self.logs_conn = None

    def reset_control_events(self) -> None:
        self.pause_event.clear()
        self.stop_event.clear()

    def state_payload(self, reason: str | None = None) -> dict[str, Any]:
        return {
            "version": 1,
            "run_id": self.run_id,
            "mode": self.mode,
            "input_paths": self.input_paths,
            "outputs": self.outputs,
            "options": asdict(self.options),
            "count_selection": self.count_selection,
            "stage_plan": self.stage_plan,
            "completed_stages": self.completed_stages,
            "stage_state": self.stage_state,
            "stats": {k: dict(v) for k, v in self.stats.items()},
            "wall_rule_counts": dict(self.wall_rule_counts),
            "logs_name_map": self.logs_name_map,
            "logs_name_counters": dict(self.logs_name_counters),
            "log_index_defs": self.log_index_defs,
            "exact_stage_totals": dict(self.exact_stage_totals),
            "fast_stage_totals": dict(self.fast_stage_totals),
            "stage_units_done": dict(self.stage_units_done),
            "reason": reason,
            "saved_at": utc_now_text(),
        }

    def save_state(self, reason: str, force: bool = False) -> None:
        now = time.time()
        is_batch = reason == "batch-commit"
        if is_batch and not force and (now - self.last_state_save_at) < STATE_SAVE_INTERVAL_SECONDS:
            return
        ensure_parent_dir(self.state_path)
        with open(self.state_path, "w", encoding="utf-8") as f:
            json.dump(self.state_payload(reason), f, ensure_ascii=False, indent=2)
        self.last_state_save_at = now
        if not is_batch:
            self.merge_log("INFO", self.current_stage or "State", f"Saved resumable state: {self.state_path} ({reason})")
            self.last_batch_state_log_at = now
        elif force or (now - self.last_batch_state_log_at) >= STATE_BATCH_LOG_INTERVAL_SECONDS:
            self.merge_log("INFO", self.current_stage or "State", f"Saved resumable state: {self.state_path} ({reason})")
            self.last_batch_state_log_at = now

    def maybe_save_state(self, reason: str = "batch-commit") -> None:
        self.save_state(reason, force=False)

    def load_state(self) -> None:
        with open(self.state_path, "r", encoding="utf-8") as f:
            state = json.load(f)
        self.run_id = state.get("run_id", self.run_id)
        self.input_paths = [normalize_path_text(p) for p in state.get("input_paths", self.input_paths)]
        self.outputs = {k: normalize_path_text(v) for k, v in state.get("outputs", self.outputs).items()}
        self.options = RunOptions(**state.get("options", asdict(self.options)))
        self.count_selection = list(state.get("count_selection", self.count_selection))
        self.stage_plan = list(state.get("stage_plan", []))
        self.completed_stages = list(state.get("completed_stages", []))
        self.stage_state = dict(state.get("stage_state", {}))
        self.wall_rule_counts = defaultdict(int, state.get("wall_rule_counts", {}))
        self.logs_name_map = dict(state.get("logs_name_map", {}))
        self.logs_name_counters = defaultdict(int, state.get("logs_name_counters", {}))
        self.log_index_defs = defaultdict(list, state.get("log_index_defs", {}))
        self.exact_stage_totals = defaultdict(int, state.get("exact_stage_totals", {}))
        self.fast_stage_totals = defaultdict(int, state.get("fast_stage_totals", {}))
        self.stage_units_done = defaultdict(int, state.get("stage_units_done", {}))
        saved_stats = state.get("stats", {})
        self.stats = defaultdict(lambda: defaultdict(int))
        for stage, values in saved_stats.items():
            self.stats[stage].update(values)

    def clear_state_file(self) -> None:
        if os.path.exists(self.state_path):
            os.remove(self.state_path)

    def check_control(self) -> None:
        if self.pause_event.is_set():
            self.commit_outputs()
            self.save_state("paused", force=True)
            raise ControlledStop("Paused")
        if self.stop_event.is_set():
            self.commit_outputs()
            self.save_state("stopped", force=True)
            raise ControlledStop("Stopped")

    def commit_outputs(self) -> None:
        for conn in (self.wall_conn, self.wall_dupes_conn, self.shout_conn, self.logs_conn):
            if conn is not None:
                conn.commit()
        self._commit_since_last = 0

    def maybe_commit(self) -> None:
        if self._commit_since_last >= self.commit_rows():
            self.commit_outputs()
            self.maybe_save_state("batch-commit")
            self.check_control()

    def set_status(self, text: str) -> None:
        self.current_stage = text
        self.gui.enqueue_status(text)

    def maybe_log_table_progress(self, table_label: str, rows_done: int) -> None:
        if rows_done <= 0:
            return
        now = time.time()
        last_at, last_rows = self._table_progress_state.get(table_label, (0.0, 0))
        if (rows_done - last_rows) < TABLE_PROGRESS_LOG_ROWS and (now - last_at) < TABLE_PROGRESS_LOG_INTERVAL_SECONDS:
            return
        elapsed = max(now - self.start_time, 0.001)
        percent_text = "n/a"
        if self.options.progress_mode == "Exact":
            percent_text = f"{self.compute_percent():.4f}"
        rate = rows_done / max(now - (last_at if last_at else now - 1), 0.001) if last_rows else rows_done / max(elapsed, 0.001)
        self.merge_log("INFO", self.current_stage or "Progress", f"In progress {table_label} rows={rows_done:,}, approx_rate={rate:,.0f} rows/s, percent={percent_text}")
        self._table_progress_state[table_label] = (now, rows_done)

    def ensure_stage_plan(self) -> None:
        if self.stage_plan:
            return
        if self.mode == "count":
            self.stage_plan = []
        elif self.mode == "shouts":
            self.stage_plan = ["shouts"]
        elif self.mode == "logs":
            self.stage_plan = ["logs"]
        elif self.mode == "wall_dupes":
            self.stage_plan = ["wall_dupes"]
        elif self.mode == "wall_deduped":
            self.stage_plan = ["wall_deduped"]
        else:
            self.stage_plan = ["shouts", "logs", "wall_dupes", "wall_deduped"]

    def compute_percent(self) -> float:
        if self.mode == "count":
            total = sum(self.exact_stage_totals.values()) or sum(self.fast_stage_totals.values()) or 1
            done = sum(self.stage_units_done.values())
            return min(100.0, (done / total) * 100.0)
        if not self.stage_plan:
            return 0.0
        weights = []
        for stage in self.stage_plan:
            if self.options.progress_mode == "Exact":
                w = self.exact_stage_totals.get(stage, 0)
                if w <= 0:
                    w = 1
            else:
                w = self.fast_stage_totals.get(stage, 0)
                if w <= 0:
                    w = 1
            weights.append((stage, w))
        total_weight = sum(w for _, w in weights) or 1
        completed = 0.0
        current = 0.0
        for stage, weight in weights:
            if stage in self.completed_stages:
                completed += weight
            elif stage == self.stage_name_key():
                total = (self.exact_stage_totals if self.options.progress_mode == "Exact" else self.fast_stage_totals).get(stage, weight) or weight
                done = self.stage_units_done.get(stage, 0)
                current = weight * min(1.0, done / max(1, total))
                break
            else:
                break
        return min(100.0, ((completed + current) / total_weight) * 100.0)

    def stage_name_key(self) -> str:
        if self.current_stage.startswith("Counting"):
            return "count"
        if self.current_stage.startswith("Building shouts"):
            return "shouts"
        if self.current_stage.startswith("Building logs"):
            return "logs"
        if self.current_stage.startswith("Building wall dupes"):
            return "wall_dupes"
        if self.current_stage.startswith("Building deduped wall"):
            return "wall_deduped"
        return ""

    def update_progress(self) -> None:
        self.gui.enqueue_progress(self.compute_percent())

    def backup_output_if_needed(self, key: str, fresh_stage: bool) -> None:
        if not fresh_stage:
            return
        path = self.outputs[key]
        if os.path.exists(path):
            backup = backup_existing_file(path)
            if backup:
                self.merge_log("INFO", "Startup", f"Existing output backed up: {backup}")

    def create_wall_dupes_schema(self) -> None:
        assert self.wall_dupes_conn is not None
        self.wall_dupes_conn.execute(
            "CREATE TABLE IF NOT EXISTS wall (post INTEGER, \"group\" INTEGER, \"user\" INTEGER, username TEXT, role TEXT, content TEXT, created TEXT)"
        )
        if not self.options.delay_index_creation:
            self.create_wall_dupes_indexes()

    def create_wall_dupes_indexes(self) -> None:
        assert self.wall_dupes_conn is not None
        self.wall_dupes_conn.execute('CREATE INDEX IF NOT EXISTS idx_wall_dupes_post ON wall(post)')
        self.wall_dupes_conn.execute('CREATE INDEX IF NOT EXISTS idx_wall_dupes_group ON wall("group")')
        self.wall_dupes_conn.execute('CREATE INDEX IF NOT EXISTS idx_wall_dupes_user ON wall("user")')
        self.wall_dupes_conn.execute('CREATE INDEX IF NOT EXISTS idx_wall_dupes_created ON wall(created)')

    def create_wall_schema(self) -> None:
        assert self.wall_conn is not None
        self.wall_conn.execute(
            "CREATE TABLE IF NOT EXISTS wall (post INTEGER PRIMARY KEY, \"group\" INTEGER, \"user\" INTEGER, username TEXT, role TEXT, content TEXT, created TEXT)"
        )
        if not self.options.delay_index_creation:
            self.create_wall_indexes()

    def create_wall_indexes(self) -> None:
        assert self.wall_conn is not None
        self.wall_conn.execute('CREATE INDEX IF NOT EXISTS idx_wall_group ON wall("group")')
        self.wall_conn.execute('CREATE INDEX IF NOT EXISTS idx_wall_user ON wall("user")')
        self.wall_conn.execute('CREATE INDEX IF NOT EXISTS idx_wall_created ON wall(created)')

    def create_shout_schema(self) -> None:
        assert self.shout_conn is not None
        self.shout_conn.execute(
            'CREATE TABLE IF NOT EXISTS shout ("group" INTEGER, "user" INTEGER, username TEXT, content TEXT, created TEXT)'
        )
        self.shout_conn.execute(
            'CREATE TABLE IF NOT EXISTS _row_registry (table_name TEXT NOT NULL, row_hash TEXT NOT NULL, PRIMARY KEY (table_name, row_hash))'
        )
        if not self.options.delay_index_creation:
            self.create_shout_indexes()

    def create_shout_indexes(self) -> None:
        assert self.shout_conn is not None
        self.shout_conn.execute('CREATE INDEX IF NOT EXISTS idx_shout_group ON shout("group")')
        self.shout_conn.execute('CREATE INDEX IF NOT EXISTS idx_shout_user ON shout("user")')
        self.shout_conn.execute('CREATE INDEX IF NOT EXISTS idx_shout_created ON shout(created)')

    def table_exists(self, conn: sqlite3.Connection, table_name: str) -> bool:
        row = conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=? COLLATE NOCASE", (table_name,)).fetchone()
        return row is not None

    def list_tables(self, conn: sqlite3.Connection) -> list[str]:
        rows = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").fetchall()
        return [str(r[0]) for r in rows]

    def get_table_info(self, conn: sqlite3.Connection, table_name: str) -> list[sqlite3.Row]:
        return list(conn.execute(f"PRAGMA table_info({qident(table_name)})"))

    def get_table_columns(self, conn: sqlite3.Connection, table_name: str) -> list[str]:
        return [str(r["name"]) for r in self.get_table_info(conn, table_name)]

    def table_count(self, conn: sqlite3.Connection, table_name: str) -> int:
        return int(conn.execute(f"SELECT COUNT(*) FROM {qident(table_name)}").fetchone()[0])

    def table_has_rowid(self, conn: sqlite3.Connection, table_name: str) -> bool:
        try:
            conn.execute(f"SELECT rowid FROM {qident(table_name)} LIMIT 1").fetchone()
            return True
        except sqlite3.OperationalError:
            return False

    def select_resume_batch(self, conn: sqlite3.Connection, table_name: str, columns: Sequence[str], checkpoint: Any) -> tuple[list[sqlite3.Row], Any]:
        existing = set(self.get_table_columns(conn, table_name))
        parts: list[str] = []
        for col in columns:
            if col in existing:
                parts.append(f"{qident(col)} AS {qident(col)}")
            else:
                parts.append(f"NULL AS {qident(col)}")

        if self.table_has_rowid(conn, table_name):
            last_rowid = int(checkpoint or 0)
            sql = f"SELECT rowid AS __rowid__, {', '.join(parts)} FROM {qident(table_name)} WHERE rowid > ? ORDER BY rowid LIMIT ?"
            rows = list(conn.execute(sql, (last_rowid, self.batch_size())).fetchall())
            next_checkpoint = int(rows[-1]["__rowid__"]) if rows else last_rowid
            return rows, next_checkpoint

        offset = int(checkpoint or 0)
        sql = f"SELECT {', '.join(parts)} FROM {qident(table_name)} LIMIT ? OFFSET ?"
        rows = list(conn.execute(sql, (self.batch_size(), offset)).fetchall())
        next_checkpoint = offset + len(rows)
        return rows, next_checkpoint

    def stage_tables_for_count(self, stages: Sequence[str]) -> list[tuple[str, str]]:
        out: list[tuple[str, str]] = []
        for db_path in self.input_paths:
            if not os.path.exists(db_path):
                continue
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            try:
                tables = self.list_tables(conn)
                for table in tables:
                    include = False
                    if "shouts" in stages and table in MAIN_SHOUT_TABLES:
                        include = True
                    if "wall_dupes" in stages and table in MAIN_WALL_TABLES:
                        include = True
                    if "logs" in stages:
                        if table in SPECIAL_PARTIAL_LOGS:
                            include = True
                        elif table not in MAIN_WALL_TABLES and table not in MAIN_SHOUT_TABLES:
                            include = True
                    if include:
                        out.append((db_path, table))
            finally:
                conn.close()
        return out

    def count_selected_stages(self, stages: Sequence[str]) -> None:
        self.set_status("Counting selected stages")
        self.exact_stage_totals.clear()
        self.fast_stage_totals.clear()
        self.stage_units_done.clear()
        work = self.stage_tables_for_count(stages)
        total_work = len(work)
        done_work = 0
        for db_path, table in work:
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            try:
                count = self.table_count(conn, table)
            finally:
                conn.close()
            if table in MAIN_SHOUT_TABLES:
                self.exact_stage_totals["shouts"] += count
                self.fast_stage_totals["shouts"] += 1
            if table in MAIN_WALL_TABLES:
                self.exact_stage_totals["wall_dupes"] += count
                self.fast_stage_totals["wall_dupes"] += 1
            if table in SPECIAL_PARTIAL_LOGS or (table not in MAIN_WALL_TABLES and table not in MAIN_SHOUT_TABLES):
                if "logs" in stages:
                    self.exact_stage_totals["logs"] += count
                    self.fast_stage_totals["logs"] += 1
            self.stage_units_done["count"] += count
            done_work += 1
            self.update_progress()
            self.log_gui("INFO", "Counting", f"{os.path.basename(db_path)} :: {table} = {count}")
            self.check_control()
        if "wall_deduped" in stages:
            src = self.outputs["wall_dupes"]
            if os.path.exists(src):
                conn = sqlite3.connect(src)
                try:
                    count = int(conn.execute("SELECT COUNT(DISTINCT post) FROM wall WHERE post IS NOT NULL").fetchone()[0])
                finally:
                    conn.close()
                self.exact_stage_totals["wall_deduped"] = count
                self.fast_stage_totals["wall_deduped"] = max(count, 1)
                self.log_gui("INFO", "Counting", f"{os.path.basename(src)} :: distinct post = {count}")
            else:
                self.log_gui("WARNING", "Counting", f"Skipped WallDeduped count: Wall dupes source does not exist yet ({src})")
        total_rows = sum(self.exact_stage_totals.values())
        self.log_gui("INFO", "Counting", f"Total source rows to scan: {total_rows}")
        self.gui.enqueue_progress(100.0)
        self.gui.enqueue_status("Done.")

    def insert_shout_row(self, values: Sequence[Any]) -> None:
        assert self.shout_conn is not None
        sig = row_hash(values)
        cur = self.shout_conn.execute("INSERT OR IGNORE INTO _row_registry (table_name, row_hash) VALUES (?, ?)", ("shout", sig))
        if cur.rowcount:
            self.shout_conn.execute('INSERT INTO shout ("group", "user", username, content, created) VALUES (?, ?, ?, ?, ?)', tuple(values))
            self.stats["shouts"]["inserted"] += 1
        else:
            self.stats["shouts"]["duplicates_skipped"] += 1
        self._commit_since_last += 1
        self.stage_units_done["shouts"] += 1
        self.maybe_commit()

    def insert_log_row(self, table_name: str, columns: Sequence[str], values: Sequence[Any]) -> None:
        assert self.logs_conn is not None
        sig = row_hash(values)
        cur = self.logs_conn.execute("INSERT OR IGNORE INTO _row_registry (table_name, row_hash) VALUES (?, ?)", (table_name, sig))
        if cur.rowcount:
            placeholders = ",".join("?" for _ in values)
            cols_sql = ", ".join(qident(c) for c in columns)
            self.logs_conn.execute(f"INSERT INTO {qident(table_name)} ({cols_sql}) VALUES ({placeholders})", tuple(values))
            self.stats["logs"]["inserted"] += 1
        else:
            self.stats["logs"]["duplicates_skipped"] += 1
        self._commit_since_last += 1
        self.stage_units_done["logs"] += 1
        self.maybe_commit()

    def insert_wall_dupe_row(self, row: dict[str, Any]) -> None:
        assert self.wall_dupes_conn is not None
        self.wall_dupes_conn.execute(
            'INSERT INTO wall (post, "group", "user", username, role, content, created) VALUES (?, ?, ?, ?, ?, ?, ?)',
            (row.get("post"), row.get("group"), row.get("user"), row.get("username"), row.get("role"), row.get("content"), row.get("created")),
        )
        self.stats["wall_dupes"]["inserted"] += 1
        self._commit_since_last += 1
        self.stage_units_done["wall_dupes"] += 1
        self.maybe_commit()

    def get_stage_table_checkpoint(self, stage: str, db_path: str, table_name: str) -> Any:
        return self.stage_state.get(stage, {}).get("checkpoints", {}).get(db_path, {}).get(table_name, 0)

    def set_stage_table_checkpoint(self, stage: str, db_path: str, table_name: str, checkpoint: Any) -> None:
        self.stage_state.setdefault(stage, {}).setdefault("checkpoints", {}).setdefault(db_path, {})[table_name] = checkpoint
        self.stage_state[stage]["current_db"] = db_path
        self.stage_state[stage]["current_table"] = table_name
        self.stage_state[stage]["last_checkpoint"] = checkpoint

    def mark_stage_table_done(self, stage: str, db_path: str, table_name: str) -> None:
        self.stage_state.setdefault(stage, {}).setdefault("completed_tables", []).append(f"{db_path}|{table_name}")
        self.stage_state[stage]["current_db"] = db_path
        self.stage_state[stage]["current_table"] = table_name

    def stage_table_done(self, stage: str, db_path: str, table_name: str) -> bool:
        return f"{db_path}|{table_name}" in set(self.stage_state.get(stage, {}).get("completed_tables", []))

    def ensure_logs_target_from_schema(self, base_name: str, info_rows: list[sqlite3.Row], src_conn: sqlite3.Connection) -> tuple[str, list[str]]:
        signature = json.dumps(
            [(str(r["name"]), str(r["type"] or ""), int(r["notnull"] or 0), r["dflt_value"]) for r in info_rows],
            ensure_ascii=False,
        )
        key = f"{base_name}::{signature}"
        existing = self.logs_name_map.get(key)
        if existing:
            return existing["target_name"], existing["columns"]
        used = {entry["target_name"] for entry in self.logs_name_map.values()}
        if base_name not in used:
            target_name = base_name
        else:
            idx = self.logs_name_counters[base_name] + 1
            while f"{base_name}{idx}" in used:
                idx += 1
            self.logs_name_counters[base_name] = idx
            target_name = f"{base_name}{idx}"
        cols_sql_parts = []
        columns: list[str] = []
        for row in info_rows:
            name = str(row["name"])
            columns.append(name)
            col_type = str(row["type"] or "TEXT")
            part = f"{qident(name)} {col_type}".strip()
            if int(row["notnull"] or 0):
                part += " NOT NULL"
            if row["dflt_value"] is not None:
                part += f" DEFAULT {row['dflt_value']}"
            cols_sql_parts.append(part)
        assert self.logs_conn is not None
        self.logs_conn.execute(f"CREATE TABLE IF NOT EXISTS {qident(target_name)} ({', '.join(cols_sql_parts)})")
        self.logs_name_map[key] = {"target_name": target_name, "columns": columns}
        self.collect_log_indexes(base_name, target_name, src_conn)
        return target_name, columns

    def collect_log_indexes(self, source_table: str, target_name: str, conn: sqlite3.Connection) -> None:
        try:
            idx_rows = conn.execute(f"PRAGMA index_list({qident(source_table)})").fetchall()
        except sqlite3.Error:
            return
        seen = {tuple(cols) for _, cols in self.pending_index_builds.get(target_name, [])}
        for idx_row in idx_rows:
            if int(idx_row[2]) != 0:
                continue
            idx_name = str(idx_row[1])
            try:
                cols = [str(r[2]) for r in conn.execute(f"PRAGMA index_info({qident(idx_name)})").fetchall()]
            except sqlite3.Error:
                continue
            if not cols:
                continue
            key = tuple(cols)
            if key in seen:
                continue
            seen.add(key)
            self.pending_index_builds[target_name].append((idx_name, cols))

    def create_pending_log_indexes(self) -> None:
        if self.logs_conn is None:
            return
        for target_name, defs in self.pending_index_builds.items():
            for _, cols in defs:
                idx_name = f"idx_{target_name}_{'_'.join(cols)}"
                cols_sql = ", ".join(qident(c) for c in cols)
                try:
                    self.logs_conn.execute(f"CREATE INDEX IF NOT EXISTS {qident(idx_name)} ON {qident(target_name)} ({cols_sql})")
                except sqlite3.Error:
                    continue
        self.logs_conn.commit()

    def build_exact_totals_for_stage(self, stage: str) -> None:
        if self.options.progress_mode != "Exact":
            return
        if self.exact_stage_totals.get(stage):
            return
        if stage == "shouts":
            total = 0
            for db_path in self.input_paths:
                if not os.path.exists(db_path):
                    continue
                conn = sqlite3.connect(db_path)
                try:
                    for table in MAIN_SHOUT_TABLES:
                        if self.table_exists(conn, table):
                            total += self.table_count(conn, table)
                finally:
                    conn.close()
            self.exact_stage_totals[stage] = total
        elif stage == "wall_dupes":
            total = 0
            for db_path in self.input_paths:
                if not os.path.exists(db_path):
                    continue
                conn = sqlite3.connect(db_path)
                try:
                    for table in MAIN_WALL_TABLES:
                        if self.table_exists(conn, table):
                            total += self.table_count(conn, table)
                finally:
                    conn.close()
            self.exact_stage_totals[stage] = total
        elif stage == "logs":
            total = 0
            for db_path in self.input_paths:
                if not os.path.exists(db_path):
                    continue
                conn = sqlite3.connect(db_path)
                try:
                    for table in self.list_tables(conn):
                        if table in MAIN_WALL_TABLES or table in MAIN_SHOUT_TABLES:
                            if table not in SPECIAL_PARTIAL_LOGS:
                                continue
                        total += self.table_count(conn, table)
                finally:
                    conn.close()
            self.exact_stage_totals[stage] = total
        elif stage == "wall_deduped":
            src = self.outputs["wall_dupes"]
            if os.path.exists(src):
                conn = sqlite3.connect(src)
                try:
                    total = int(conn.execute("SELECT COUNT(DISTINCT post) FROM wall WHERE post IS NOT NULL").fetchone()[0])
                finally:
                    conn.close()
                self.exact_stage_totals[stage] = total
        self.update_progress()

    def init_stage_output(self, stage: str, fresh_stage: bool) -> None:
        self.ensure_logs_db_for_merge_log()
        if fresh_stage:
            self.stage_units_done[stage] = 0
            self.stage_state.pop(stage, None)
        if stage == "shouts":
            self.backup_output_if_needed("shout", fresh_stage)
            self.shout_conn = self.connect_db(self.outputs["shout"])
            self.create_shout_schema()
        elif stage == "logs":
            self.backup_output_if_needed("logs", fresh_stage)
            if self.logs_conn is not None:
                try:
                    self.logs_conn.close()
                except Exception:
                    pass
                self.logs_conn = None
            self.ensure_logs_db_for_merge_log()
        elif stage == "wall_dupes":
            self.backup_output_if_needed("wall_dupes", fresh_stage)
            self.wall_dupes_conn = self.connect_db(self.outputs["wall_dupes"])
            self.create_wall_dupes_schema()
        elif stage == "wall_deduped":
            self.backup_output_if_needed("wall", fresh_stage)
            self.wall_conn = self.connect_db(self.outputs["wall"])
            self.create_wall_schema()

    def verify_db(self, path: str) -> None:
        if not self.options.verify_writes or not os.path.exists(path):
            return
        conn = sqlite3.connect(path)
        try:
            result = conn.execute("PRAGMA integrity_check").fetchone()[0]
        finally:
            conn.close()
        self.merge_log("INFO", "Verify", f"{os.path.basename(path)} integrity_check: {result}")

    def maybe_vacuum(self, path: str) -> None:
        if not self.options.vacuum_after_stage or not os.path.exists(path):
            return
        conn = sqlite3.connect(path)
        try:
            conn.execute("VACUUM")
            conn.commit()
        finally:
            conn.close()
        self.merge_log("INFO", "VACUUM", f"Vacuumed {path}")

    def stage_shouts(self) -> None:
        stage = "shouts"
        self.set_status("Building shouts")
        self.build_exact_totals_for_stage(stage)
        fresh = stage not in self.completed_stages and stage not in self.stage_state
        self.init_stage_output(stage, fresh)
        assert self.shout_conn is not None
        for db_path in self.input_paths:
            if not os.path.exists(db_path):
                self.merge_log("WARNING", "Building shouts", f"Skipped missing input DB: {db_path}")
                continue
            src_conn = sqlite3.connect(db_path)
            src_conn.row_factory = sqlite3.Row
            src_conn.execute("PRAGMA query_only=ON")
            try:
                for table in ("rb_group_shout_archive", "rb_shout_archive", "wall_posts"):
                    if not self.table_exists(src_conn, table):
                        continue
                    if self.stage_table_done(stage, db_path, table):
                        continue
                    self.current_table_label = f"{os.path.basename(db_path)} :: {table}"
                    self.merge_log("INFO", "Building shouts", f"Processing {self.current_table_label}")
                    checkpoint = self.get_stage_table_checkpoint(stage, db_path, table)
                    cols = {
                        "rb_group_shout_archive": ["group_id", "user_id", "username", "body", "created"],
                        "rb_shout_archive": ["group_id", "user_id", "username", "shout", "creation"],
                        "wall_posts": ["group_id", "shout_user_id", "shout_content", "shout_timestamp"],
                    }[table]
                    while True:
                        rows, checkpoint = self.select_resume_batch(src_conn, table, cols, checkpoint)
                        if not rows:
                            break
                        for row in rows:
                            if table == "rb_group_shout_archive":
                                self.insert_shout_row([row["group_id"], row["user_id"], row["username"], row["body"], row["created"]])
                            elif table == "rb_shout_archive":
                                self.insert_shout_row([row["group_id"], row["user_id"], row["username"], row["shout"], row["creation"]])
                            else:
                                self.insert_shout_row([row["group_id"], row["shout_user_id"], None, row["shout_content"], row["shout_timestamp"]])
                        self.set_stage_table_checkpoint(stage, db_path, table, checkpoint)
                        self.update_progress()
                        self.check_control()
                    self.mark_stage_table_done(stage, db_path, table)
                    self.merge_log("INFO", "Building shouts", f"Finished {self.current_table_label}")
            finally:
                src_conn.close()
        if self.options.delay_index_creation:
            self.create_shout_indexes()
        self.commit_outputs()
        self.verify_db(self.outputs["shout"])
        self.maybe_vacuum(self.outputs["shout"])

    def create_special_log_table(self, table_name: str, columns: Sequence[str]) -> None:
        assert self.logs_conn is not None
        cols_sql = ", ".join(f"{qident(col)} {infer_sqlite_type(col)}" for col in columns)
        self.logs_conn.execute(f"CREATE TABLE IF NOT EXISTS {qident(table_name)} ({cols_sql})")

    def stage_logs(self) -> None:
        stage = "logs"
        self.set_status("Building logs")
        self.build_exact_totals_for_stage(stage)
        fresh = stage not in self.completed_stages and stage not in self.stage_state
        self.init_stage_output(stage, fresh)
        assert self.logs_conn is not None
        for special_name, columns in SPECIAL_PARTIAL_LOGS.items():
            self.create_special_log_table(special_name, columns)
        for db_path in self.input_paths:
            if not os.path.exists(db_path):
                self.merge_log("WARNING", "Building logs", f"Skipped missing input DB: {db_path}")
                continue
            src_conn = sqlite3.connect(db_path)
            src_conn.row_factory = sqlite3.Row
            src_conn.execute("PRAGMA query_only=ON")
            try:
                for table in self.list_tables(src_conn):
                    handle_as_special = table in SPECIAL_PARTIAL_LOGS
                    if table in MAIN_WALL_TABLES and table not in SPECIAL_PARTIAL_LOGS:
                        continue
                    if table in MAIN_SHOUT_TABLES and table not in SPECIAL_PARTIAL_LOGS:
                        continue
                    count = self.table_count(src_conn, table)
                    if count == 0 and self.options.skip_empty_tables:
                        self.merge_log("INFO", "Building logs", f"Empty table skipped: {os.path.basename(db_path)} :: {table}")
                        self.stats[stage]["empty_skipped"] += 1
                        continue
                    if handle_as_special:
                        if self.stage_table_done(stage, db_path, table):
                            continue
                        cols = SPECIAL_PARTIAL_LOGS[table]
                        self.current_table_label = f"{os.path.basename(db_path)} :: {table}"
                        self.merge_log("INFO", "Building logs", f"Processing special fields {self.current_table_label}")
                        checkpoint = self.get_stage_table_checkpoint(stage, db_path, table)
                        while True:
                            rows, checkpoint = self.select_resume_batch(src_conn, table, cols, checkpoint)
                            if not rows:
                                break
                            for row in rows:
                                self.insert_log_row(table, cols, [row[c] for c in cols])
                                self.set_stage_table_checkpoint(stage, db_path, table, checkpoint)
                            self.update_progress()
                            self.check_control()
                        self.mark_stage_table_done(stage, db_path, table)
                        continue
                    if self.stage_table_done(stage, db_path, table):
                        continue
                    info_rows = self.get_table_info(src_conn, table)
                    if not info_rows:
                        continue
                    target_name, columns = self.ensure_logs_target_from_schema(table, info_rows, src_conn)
                    self.current_table_label = f"{os.path.basename(db_path)} :: {table} -> {target_name}"
                    self.merge_log("INFO", "Building logs", f"Processing {self.current_table_label}")
                    checkpoint = self.get_stage_table_checkpoint(stage, db_path, table)
                    while True:
                        rows, checkpoint = self.select_resume_batch(src_conn, table, columns, checkpoint)
                        if not rows:
                            break
                        for row in rows:
                            self.insert_log_row(target_name, columns, [row[c] for c in columns])
                        self.set_stage_table_checkpoint(stage, db_path, table, checkpoint)
                        self.update_progress()
                        self.check_control()
                    self.mark_stage_table_done(stage, db_path, table)
            finally:
                src_conn.close()
        if self.options.delay_index_creation:
            self.create_pending_log_indexes()
        self.commit_outputs()
        self.verify_db(self.outputs["logs"])
        self.maybe_vacuum(self.outputs["logs"])

    def stage_wall_dupes(self) -> None:
        stage = "wall_dupes"
        self.set_status("Building wall dupes")
        self.build_exact_totals_for_stage(stage)
        fresh = stage not in self.completed_stages and stage not in self.stage_state
        self.init_stage_output(stage, fresh)
        assert self.wall_dupes_conn is not None
        mappings = {
            "rb_group_wall_archive": ["created", "body", "role", "username", "user_id", "group_id", "post_id"],
            "rb_group_wall": ["created", "body", "role", "username", "user_id", "group_id", "post_id"],
            "rb_wall_archive": ["group_id", "user_id", "username", "message_id", "message", "creation"],
        }
        for db_path in self.input_paths:
            if not os.path.exists(db_path):
                self.merge_log("WARNING", "Building wall dupes", f"Skipped missing input DB: {db_path}")
                continue
            src_conn = sqlite3.connect(db_path)
            src_conn.row_factory = sqlite3.Row
            src_conn.execute("PRAGMA query_only=ON")
            try:
                for table, cols in mappings.items():
                    if not self.table_exists(src_conn, table):
                        continue
                    if self.stage_table_done(stage, db_path, table):
                        continue
                    self.current_table_label = f"{os.path.basename(db_path)} :: {table}"
                    self.merge_log("INFO", "Building wall dupes", f"Processing {self.current_table_label}")
                    table_rows_done = 0
                    self._table_progress_state.pop(self.current_table_label, None)
                    checkpoint = self.get_stage_table_checkpoint(stage, db_path, table)
                    while True:
                        rows, checkpoint = self.select_resume_batch(src_conn, table, cols, checkpoint)
                        if not rows:
                            break
                        for row in rows:
                            if table == "rb_wall_archive":
                                wall = {
                                    "post": row["message_id"],
                                    "group": row["group_id"],
                                    "user": row["user_id"],
                                    "username": row["username"],
                                    "role": None,
                                    "content": row["message"],
                                    "created": row["creation"],
                                }
                            else:
                                wall = {
                                    "post": row["post_id"],
                                    "group": row["group_id"],
                                    "user": row["user_id"],
                                    "username": row["username"],
                                    "role": row["role"],
                                    "content": row["body"],
                                    "created": row["created"],
                                }
                            self.insert_wall_dupe_row(wall)
                        table_rows_done += len(rows)
                        self.set_stage_table_checkpoint(stage, db_path, table, checkpoint)
                        self.update_progress()
                        self.maybe_log_table_progress(self.current_table_label, table_rows_done)
                        self.check_control()
                    self.mark_stage_table_done(stage, db_path, table)
                    self.merge_log("INFO", "Building wall dupes", f"Finished {self.current_table_label} rows={table_rows_done:,}")
            finally:
                src_conn.close()
        if self.options.delay_index_creation:
            self.create_wall_dupes_indexes()
        self.commit_outputs()
        self.verify_db(self.outputs["wall_dupes"])
        self.maybe_vacuum(self.outputs["wall_dupes"])

    def stage_wall_deduped(self) -> None:
        stage = "wall_deduped"
        self.set_status("Building deduped wall")
        src = self.outputs["wall_dupes"]
        if not os.path.exists(src):
            raise RuntimeError(f"Wall dupes source does not exist: {src}")
        self.build_exact_totals_for_stage(stage)
        fresh = stage not in self.completed_stages and stage not in self.stage_state
        self.init_stage_output(stage, fresh)
        assert self.wall_conn is not None
        last_completed_post = self.stage_state.get(stage, {}).get("last_completed_post")
        src_conn = sqlite3.connect(src)
        src_conn.row_factory = sqlite3.Row
        self.apply_pragmas(src_conn)
        try:
            if last_completed_post is None:
                sql = 'SELECT rowid, post, "group", "user", username, role, content, created FROM wall ORDER BY post, rowid'
                cur = src_conn.execute(sql)
            else:
                sql = 'SELECT rowid, post, "group", "user", username, role, content, created FROM wall WHERE post > ? OR post IS NULL ORDER BY post, rowid'
                cur = src_conn.execute(sql, (last_completed_post,))
            bucket: list[dict[str, Any]] = []
            current_post = None
            skipped_null_post = 0
            while True:
                rows = cur.fetchmany(self.batch_size())
                if not rows:
                    break
                for row in rows:
                    post_value = row["post"]
                    if current_post is None:
                        current_post = post_value
                    if post_value != current_post:
                        if bucket:
                            if bucket[0]["post"] is None:
                                skipped_null_post += len(bucket)
                            else:
                                winner, rule_name = choose_best_wall_row(bucket)
                                self.wall_rule_counts[rule_name] += 1
                                self.wall_conn.execute(
                                    'INSERT OR REPLACE INTO wall (post, "group", "user", username, role, content, created) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                    (winner["post"], winner["group"], winner["user"], winner["username"], winner["role"], winner["content"], winner["created"]),
                                )
                                self.stats[stage]["inserted"] += 1
                                self.stats[stage]["duplicates_removed"] += max(0, len(bucket) - 1)
                                self.stage_units_done[stage] += 1
                                self.stage_state.setdefault(stage, {})["last_completed_post"] = bucket[0]["post"]
                                self._commit_since_last += 1
                                self.maybe_commit()
                                self.update_progress()
                                self.check_control()
                        bucket = []
                        current_post = post_value
                    bucket.append(
                        {
                            "post": row["post"],
                            "group": row["group"],
                            "user": row["user"],
                            "username": row["username"],
                            "role": row["role"],
                            "content": row["content"],
                            "created": row["created"],
                        }
                    )
                self.check_control()
            if bucket:
                if bucket[0]["post"] is None:
                    skipped_null_post += len(bucket)
                else:
                    winner, rule_name = choose_best_wall_row(bucket)
                    self.wall_rule_counts[rule_name] += 1
                    self.wall_conn.execute(
                        'INSERT OR REPLACE INTO wall (post, "group", "user", username, role, content, created) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        (winner["post"], winner["group"], winner["user"], winner["username"], winner["role"], winner["content"], winner["created"]),
                    )
                    self.stats[stage]["inserted"] += 1
                    self.stats[stage]["duplicates_removed"] += max(0, len(bucket) - 1)
                    self.stage_units_done[stage] += 1
                    self.stage_state.setdefault(stage, {})["last_completed_post"] = bucket[0]["post"]
                    self._commit_since_last += 1
            if skipped_null_post:
                self.stats[stage]["null_post_skipped"] += skipped_null_post
                self.merge_log("WARNING", "Building deduped wall", f"Skipped {skipped_null_post} wall rows with NULL post")
        finally:
            src_conn.close()
        if self.options.delay_index_creation:
            self.create_wall_indexes()
        self.commit_outputs()
        self.verify_db(self.outputs["wall"])
        self.maybe_vacuum(self.outputs["wall"])

    def finalize(self) -> None:
        self.ensure_logs_db_for_merge_log()
        self.merge_log("INFO", "Finalizing", f"Wall winner rules: {dict(sorted(self.wall_rule_counts.items()))}")
        summary = {stage: dict(values) for stage, values in self.stats.items()}
        self.merge_log("INFO", "Finalizing", f"Summary counts: {summary}")
        elapsed = time.time() - self.start_time
        self.merge_log("INFO", "Done", f"Run finished in {elapsed:.2f}s")
        self.commit_outputs()

    def run(self) -> None:
        try:
            self.reset_control_events()
            if self.resume_mode:
                if not os.path.exists(self.state_path):
                    raise RuntimeError(f"Resume state does not exist: {self.state_path}")
                self.load_state()
                self.merge_log("INFO", "Startup", f"Resuming run: {self.run_id}")
            else:
                self.ensure_stage_plan()
                self.clear_state_file()
                self.merge_log("INFO", "Startup", f"Run ID: {self.run_id}")

            if self.mode == "count":
                stages = self.count_selection or ["shouts", "logs", "wall_dupes"]
                self.count_selected_stages(stages)
                self.gui.enqueue_done(True, "Count completed.")
                return

            self.ensure_stage_plan()
            if self.options.progress_mode == "Exact" and not self._counted_once:
                count_stages = [s for s in self.stage_plan if s != "wall_deduped"]
                self.count_selected_stages(count_stages)
                self.stage_units_done.clear()
                self._counted_once = True
                self.gui.enqueue_progress(0.0)

            for stage in self.stage_plan:
                if stage in self.completed_stages:
                    continue
                if stage == "shouts":
                    self.stage_shouts()
                elif stage == "logs":
                    self.stage_logs()
                elif stage == "wall_dupes":
                    self.stage_wall_dupes()
                    if self.options.progress_mode == "Exact" and not self.exact_stage_totals.get("wall_deduped"):
                        self.build_exact_totals_for_stage("wall_deduped")
                elif stage == "wall_deduped":
                    self.stage_wall_deduped()
                if stage not in self.completed_stages:
                    self.completed_stages.append(stage)
                self.save_state("stage-complete", force=True)
            self.finalize()
            self.clear_state_file()
            self.gui.enqueue_progress(100.0)
            self.gui.enqueue_status("Done.")
            self.gui.enqueue_done(True, "Run completed.")
        except ControlledStop as exc:
            self.gui.enqueue_status(exc.reason)
            self.gui.enqueue_done(True, exc.reason)
        except Exception as exc:
            err = ''.join(traceback.format_exception(exc))
            try:
                self.merge_log("ERROR", self.current_stage or "Error", err)
            except Exception:
                self.log_gui("ERROR", self.current_stage or "Error", err)
            self.gui.enqueue_status("Failed.")
            self.gui.enqueue_done(False, str(exc))
        finally:
            self.close_outputs()


class MergeGUI:
    def __init__(self) -> None:
        self.root = Tk()
        self.root.title(APP_TITLE)
        self.root.geometry("1400x980")
        self.worker: threading.Thread | None = None
        self.ui_queue: list[tuple[str, Any]] = []
        self.queue_lock = threading.Lock()
        self.pause_event = threading.Event()
        self.stop_event = threading.Event()

        self.progress_var = StringVar(value="0.00%")
        self.status_var = StringVar(value="Ready.")
        self.wall_path_var = StringVar(value=DEFAULT_OUTPUTS["wall"])
        self.wall_dupes_path_var = StringVar(value=DEFAULT_OUTPUTS["wall_dupes"])
        self.shout_path_var = StringVar(value=DEFAULT_OUTPUTS["shout"])
        self.logs_path_var = StringVar(value=DEFAULT_OUTPUTS["logs"])
        self.speed_profile_var = StringVar(value="Maximum")
        self.progress_mode_var = StringVar(value="Fast")
        self.delay_indexes_var = StringVar(value="1")
        self.skip_empty_var = StringVar(value="1")
        self.vacuum_var = StringVar(value="0")
        self.verify_var = StringVar(value="0")
        self.count_shouts_var = StringVar(value="1")
        self.count_logs_var = StringVar(value="1")
        self.count_wall_dupes_var = StringVar(value="1")
        self.count_wall_deduped_var = StringVar(value="0")

        self._build_ui()
        self._load_default_inputs()
        self.root.after(100, self._drain_ui_queue)

    def enqueue_log(self, message: str) -> None:
        with self.queue_lock:
            self.ui_queue.append(("log", message))

    def enqueue_progress(self, value: float) -> None:
        with self.queue_lock:
            self.ui_queue.append(("progress", float(value)))

    def enqueue_status(self, value: str) -> None:
        with self.queue_lock:
            self.ui_queue.append(("status", value))

    def enqueue_done(self, success: bool, message: str) -> None:
        with self.queue_lock:
            self.ui_queue.append(("done", (success, message)))

    def _build_ui(self) -> None:
        main = ttk.Frame(self.root, padding=10)
        main.pack(fill=BOTH, expand=True)

        top = ttk.Frame(main)
        top.pack(fill=BOTH, expand=False)

        input_frame = ttk.LabelFrame(top, text="Input database paths (one per line)", padding=10)
        input_frame.pack(side=LEFT, fill=BOTH, expand=True, padx=(0, 8))
        self.inputs_text = scrolledtext.ScrolledText(input_frame, height=16, wrap="none")
        self.inputs_text.pack(fill=BOTH, expand=True)
        input_btns = ttk.Frame(input_frame)
        input_btns.pack(fill=X, pady=(8, 0))
        ttk.Button(input_btns, text="Load defaults", command=self._load_default_inputs).pack(side=LEFT)
        ttk.Button(input_btns, text="Load DatabaseInfo.txt", command=self._load_database_info_file).pack(side=LEFT, padx=(8, 0))
        ttk.Button(input_btns, text="Add input DBs", command=self._add_input_dbs).pack(side=LEFT, padx=(8, 0))

        right = ttk.Frame(top)
        right.pack(side=RIGHT, fill=BOTH, expand=False)

        output_frame = ttk.LabelFrame(right, text="Output databases", padding=10)
        output_frame.pack(fill=X)
        self._build_path_row(output_frame, "RobloxGroupWall.db", self.wall_path_var)
        self._build_path_row(output_frame, "RobloxGroupWallDupes.db", self.wall_dupes_path_var)
        self._build_path_row(output_frame, "RobloxGroupShout.db", self.shout_path_var)
        self._build_path_row(output_frame, "RobloxGroupArchiveLogs.db", self.logs_path_var)

        options = ttk.LabelFrame(right, text="Options", padding=10)
        options.pack(fill=X, pady=(8, 0))
        row1 = ttk.Frame(options)
        row1.pack(fill=X, pady=2)
        ttk.Label(row1, text="Speed profile", width=20).pack(side=LEFT)
        ttk.Combobox(row1, textvariable=self.speed_profile_var, values=list(SPEED_PROFILES.keys()), state="readonly", width=14).pack(side=LEFT)
        ttk.Label(row1, text="Progress mode", width=16).pack(side=LEFT, padx=(12, 0))
        ttk.Combobox(row1, textvariable=self.progress_mode_var, values=["Fast", "Exact"], state="readonly", width=12).pack(side=LEFT)

        row2 = ttk.Frame(options)
        row2.pack(fill=X, pady=2)
        ttk.Checkbutton(row2, text="Delay index creation", variable=self.delay_indexes_var, onvalue="1", offvalue="0").pack(side=LEFT)
        ttk.Checkbutton(row2, text="Skip empty tables", variable=self.skip_empty_var, onvalue="1", offvalue="0").pack(side=LEFT, padx=(12, 0))
        ttk.Checkbutton(row2, text="VACUUM after stage", variable=self.vacuum_var, onvalue="1", offvalue="0").pack(side=LEFT, padx=(12, 0))
        ttk.Checkbutton(row2, text="Verify writes", variable=self.verify_var, onvalue="1", offvalue="0").pack(side=LEFT, padx=(12, 0))

        count_frame = ttk.LabelFrame(right, text="Count selection", padding=10)
        count_frame.pack(fill=X, pady=(8, 0))
        ttk.Checkbutton(count_frame, text="Shouts", variable=self.count_shouts_var, onvalue="1", offvalue="0").pack(side=LEFT)
        ttk.Checkbutton(count_frame, text="Logs", variable=self.count_logs_var, onvalue="1", offvalue="0").pack(side=LEFT, padx=(12, 0))
        ttk.Checkbutton(count_frame, text="WallDupes", variable=self.count_wall_dupes_var, onvalue="1", offvalue="0").pack(side=LEFT, padx=(12, 0))
        ttk.Checkbutton(count_frame, text="WallDeduped", variable=self.count_wall_deduped_var, onvalue="1", offvalue="0").pack(side=LEFT, padx=(12, 0))

        actions = ttk.LabelFrame(main, text="Modes", padding=10)
        actions.pack(fill=X, pady=(10, 6))
        ttk.Button(actions, text="Count selected", command=lambda: self._start_worker("count")).pack(side=LEFT)
        ttk.Button(actions, text="Build Shouts only", command=lambda: self._start_worker("shouts")).pack(side=LEFT, padx=(8, 0))
        ttk.Button(actions, text="Build Logs only", command=lambda: self._start_worker("logs")).pack(side=LEFT, padx=(8, 0))
        ttk.Button(actions, text="Build WallDupes only", command=lambda: self._start_worker("wall_dupes")).pack(side=LEFT, padx=(8, 0))
        ttk.Button(actions, text="Build WallDeduped from WallDupes", command=lambda: self._start_worker("wall_deduped")).pack(side=LEFT, padx=(8, 0))
        ttk.Button(actions, text="Build All", command=lambda: self._start_worker("all")).pack(side=LEFT, padx=(8, 0))
        ttk.Button(actions, text="Resume", command=lambda: self._start_worker("resume")).pack(side=LEFT, padx=(18, 0))
        ttk.Button(actions, text="Pause", command=self._pause_job).pack(side=RIGHT)
        ttk.Button(actions, text="Stop", command=self._stop_job).pack(side=RIGHT, padx=(0, 8))

        progress_frame = ttk.LabelFrame(main, text="Progress", padding=10)
        progress_frame.pack(fill=X, pady=(0, 6))
        self.progress = ttk.Progressbar(progress_frame, mode="determinate", maximum=100.0)
        self.progress.pack(fill=X)
        status_row = ttk.Frame(progress_frame)
        status_row.pack(fill=X, pady=(6, 0))
        ttk.Label(status_row, textvariable=self.progress_var, width=12).pack(side=LEFT)
        ttk.Label(status_row, textvariable=self.status_var).pack(side=LEFT)

        log_frame = ttk.LabelFrame(main, text="Live log", padding=10)
        log_frame.pack(fill=BOTH, expand=True)
        self.log_text = scrolledtext.ScrolledText(log_frame, wrap="word", state="disabled")
        self.log_text.pack(fill=BOTH, expand=True)

    def _build_path_row(self, parent: ttk.Widget, label: str, var: StringVar) -> None:
        row = ttk.Frame(parent)
        row.pack(fill=X, pady=4)
        ttk.Label(row, text=label, width=28).pack(side=LEFT)
        ttk.Entry(row, textvariable=var, width=78).pack(side=LEFT, fill=X, expand=True, padx=(6, 6))
        ttk.Button(row, text="Browse", command=lambda v=var: self._browse_save_file(v)).pack(side=RIGHT)

    def _append_log(self, text: str) -> None:
        self.log_text.configure(state="normal")
        self.log_text.insert(END, text + "\n")
        self.log_text.see(END)
        self.log_text.configure(state="disabled")

    def _drain_ui_queue(self) -> None:
        with self.queue_lock:
            items = self.ui_queue[:]
            self.ui_queue.clear()
        for kind, payload in items:
            if kind == "log":
                self._append_log(str(payload))
            elif kind == "progress":
                value = max(0.0, min(100.0, float(payload)))
                self.progress["value"] = value
                self.progress_var.set(f"{value:.2f}%")
            elif kind == "status":
                self.status_var.set(str(payload))
            elif kind == "done":
                success, message = payload
                if success:
                    self.status_var.set(str(message))
                else:
                    self.status_var.set("Failed.")
                    messagebox.showerror(APP_TITLE, str(message))
        self.root.after(100, self._drain_ui_queue)

    def _load_default_inputs(self) -> None:
        self.inputs_text.delete("1.0", END)
        self.inputs_text.insert("1.0", "\n".join(DEFAULT_INPUTS))

    def _add_input_dbs(self) -> None:
        files = filedialog.askopenfilenames(
            title="Select input databases",
            filetypes=[("SQLite databases", "*.db *.sqlite *.sqlite3"), ("All files", "*.*")],
        )
        if not files:
            return
        combined = read_nonempty_lines(self.inputs_text.get("1.0", END)) + [normalize_path_text(f) for f in files]
        self.inputs_text.delete("1.0", END)
        self.inputs_text.insert("1.0", "\n".join(dict.fromkeys(combined)))

    def _browse_save_file(self, var: StringVar) -> None:
        initial = normalize_path_text(var.get()) or os.getcwd()
        file_path = filedialog.asksaveasfilename(
            title="Select output database",
            initialfile=os.path.basename(initial),
            initialdir=os.path.dirname(initial) if os.path.dirname(initial) else os.getcwd(),
            defaultextension=".db",
            filetypes=[("SQLite databases", "*.db *.sqlite *.sqlite3"), ("All files", "*.*")],
        )
        if file_path:
            var.set(normalize_path_text(file_path))

    def _load_database_info_file(self) -> None:
        file_path = filedialog.askopenfilename(title="Select DatabaseInfo.txt", filetypes=[("Text files", "*.txt"), ("All files", "*.*")])
        if not file_path:
            return
        with open(file_path, "r", encoding="utf-8") as f:
            text = f.read()
        inputs, outputs = parse_database_info_paths(text)
        if inputs:
            self.inputs_text.delete("1.0", END)
            self.inputs_text.insert("1.0", "\n".join(inputs))
        if len(outputs) >= 1:
            self.wall_path_var.set(outputs[0])
        if len(outputs) >= 2:
            self.wall_dupes_path_var.set(outputs[1])
        if len(outputs) >= 3:
            self.shout_path_var.set(outputs[2])
        if len(outputs) >= 4:
            self.logs_path_var.set(outputs[3])
        self._append_log(f"[{now_text()}] INFO [UI] Loaded DatabaseInfo.txt paths from {file_path}")

    def gather_options(self) -> RunOptions:
        return RunOptions(
            speed_profile=self.speed_profile_var.get() or "Maximum",
            progress_mode=self.progress_mode_var.get() or "Fast",
            delay_index_creation=self.delay_indexes_var.get() == "1",
            skip_empty_tables=self.skip_empty_var.get() == "1",
            vacuum_after_stage=self.vacuum_var.get() == "1",
            verify_writes=self.verify_var.get() == "1",
        )

    def gather_outputs(self) -> dict[str, str]:
        return {
            "wall": normalize_path_text(self.wall_path_var.get()),
            "wall_dupes": normalize_path_text(self.wall_dupes_path_var.get()),
            "shout": normalize_path_text(self.shout_path_var.get()),
            "logs": normalize_path_text(self.logs_path_var.get()),
        }

    def gather_count_selection(self) -> list[str]:
        out: list[str] = []
        if self.count_shouts_var.get() == "1":
            out.append("shouts")
        if self.count_logs_var.get() == "1":
            out.append("logs")
        if self.count_wall_dupes_var.get() == "1":
            out.append("wall_dupes")
        if self.count_wall_deduped_var.get() == "1":
            out.append("wall_deduped")
        return out

    def _pause_job(self) -> None:
        if not self.worker or not self.worker.is_alive():
            return
        self.pause_event.set()
        self._append_log(f"[{now_text()}] INFO [Control] Pause requested")

    def _stop_job(self) -> None:
        if not self.worker or not self.worker.is_alive():
            return
        self.stop_event.set()
        self._append_log(f"[{now_text()}] INFO [Control] Stop requested")

    def _start_worker(self, mode: str) -> None:
        if self.worker and self.worker.is_alive():
            messagebox.showwarning(APP_TITLE, "A job is already running.")
            return
        if mode != "resume":
            input_paths = read_nonempty_lines(self.inputs_text.get("1.0", END))
            if not input_paths:
                messagebox.showerror(APP_TITLE, "Add at least one input database.")
                return
            outputs = self.gather_outputs()
            missing = [k for k, v in outputs.items() if not v]
            if missing:
                messagebox.showerror(APP_TITLE, f"Missing output path(s): {', '.join(missing)}")
                return
        else:
            input_paths = []
            outputs = self.gather_outputs()
        self.pause_event.clear()
        self.stop_event.clear()
        self.log_text.configure(state="normal")
        self.log_text.delete("1.0", END)
        self.log_text.configure(state="disabled")
        self.progress["value"] = 0.0
        self.progress_var.set("0.00%")
        self.status_var.set("Starting...")
        options = self.gather_options()
        worker = MergeWorker(
            gui=self,
            mode="all" if mode == "all" else mode,
            input_paths=input_paths,
            outputs=outputs,
            options=options,
            count_selection=self.gather_count_selection(),
            resume=(mode == "resume"),
        )
        self.worker = threading.Thread(target=worker.run, daemon=True)
        self.worker.start()

    def run(self) -> None:
        self.root.mainloop()


def main() -> None:
    gui = MergeGUI()
    gui.run()


if __name__ == "__main__":
    main()
