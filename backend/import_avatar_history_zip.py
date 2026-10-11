#!/usr/bin/env python3
"""Convert a backlink-search JSONL ZIP or Zstandard-compressed JSONL (.zst) into a compact user-avatar TSV index.

Input records are expected to have the shape:
  {"type":"user","id":123,"images":[{"url":"https://...","first_seen":"...","backlinks":[...]}]}

Only user records are kept. Each image must have a backlink that identifies the
same user ID, reducing accidental asset/game/group thumbnails and guest-avatar
contamination. The original ZIP is never modified.

Output format matches the renderer's saved-history line format:
  user_id<TAB>14-digit-wayback-timestamp<TAB>original-thumbnail-url

The output directory is intended to remain outside Git history. Host the shards
as release assets or in durable object storage; do not commit multi-gigabyte data.
"""
from __future__ import annotations

import argparse
import gzip
import io
import json
import re
import sqlite3
import sys
import zipfile
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


def normalize_timestamp(value: object) -> str:
    if value is None:
        return ""
    digits = re.sub(r"\D", "", str(value))
    if not digits:
        return ""
    return (digits + "00000000000000")[:14]


def backlink_matches_user(value: object, user_id: str) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    raw = unquote(value.strip())

    # Modern Roblox profile URLs: /users/<id>/profile
    for match in re.finditer(r"/users?/(\d+)(?:/|$)", raw, re.IGNORECASE):
        if match.group(1) == user_id:
            return True

    # Older Roblox profile URLs: /User.aspx?ID=<id>
    for match in re.finditer(r"(?:[?&]|%3[fF]|%26)(?:ID|userId|user_id)=(\d+)", raw, re.IGNORECASE):
        if match.group(1) == user_id:
            return True

    # Also handle a URL parsed normally, including non-archived legacy links.
    try:
        parsed = urlparse(raw)
        for key, values in parse_qs(parsed.query).items():
            if key.lower() in {"id", "userid", "user_id"} and user_id in values:
                return True
    except ValueError:
        pass
    return False


def iter_jsonl_members(archive: zipfile.ZipFile):
    for info in archive.infolist():
        if info.is_dir():
            continue
        name = info.filename.lower()
        if not (name.endswith(".jsonl") or name.endswith(".ndjson") or
                name.endswith(".jsonl.gz") or name.endswith(".ndjson.gz")):
            continue
        raw = archive.open(info, "r")
        if name.endswith(".gz"):
            raw = gzip.GzipFile(fileobj=raw, mode="rb")
        yield info.filename, io.TextIOWrapper(raw, encoding="utf-8-sig", errors="replace")


def iter_input_members(input_path: Path):
    """Yield (name, text stream) from a ZIP archive or a .jsonl.zst stream."""
    if input_path.suffix.lower() == ".zst":
        try:
            import zstandard
        except ImportError as exc:
            raise RuntimeError(
                "Reading .zst requires zstandard; install it with: py -m pip install zstandard"
            ) from exc
        raw = input_path.open("rb")
        reader = zstandard.ZstdDecompressor().stream_reader(raw)
        buffered = io.BufferedReader(reader)
        yield input_path.name, io.TextIOWrapper(
            buffered, encoding="utf-8-sig", errors="replace"
        )
        return

    with zipfile.ZipFile(input_path, "r") as archive:
        yield from iter_jsonl_members(archive)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_file", type=Path, help="Backlink-search ZIP or JSONL Zstandard file (.zst)")
    parser.add_argument("--out", type=Path, default=Path("backend/thumbnail_chunks/avatar-history"),
                        help="Output directory (default: backend/thumbnail_chunks/avatar-history)")
    parser.add_argument("--shards", type=int, default=256, help="Number of user-ID modulo shards (default: 256)")
    args = parser.parse_args()

    if not args.input_file.is_file():
        parser.error(f"Input file does not exist: {args.input_file}")
    if args.shards < 1 or args.shards > 4096:
        parser.error("--shards must be between 1 and 4096")

    args.out.mkdir(parents=True, exist_ok=True)
    db_path = args.out / ".avatar-index-build.sqlite3"
    if db_path.exists():
        db_path.unlink()

    records = 0
    accepted = 0
    rejected = 0
    members_seen = 0
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("PRAGMA journal_mode=OFF")
        conn.execute("PRAGMA synchronous=OFF")
        conn.execute("PRAGMA temp_store=FILE")
        conn.execute("""
            CREATE TABLE entries (
                shard INTEGER NOT NULL,
                user_id TEXT NOT NULL,
                stamp TEXT NOT NULL,
                url TEXT NOT NULL,
                PRIMARY KEY (user_id, stamp, url)
            ) WITHOUT ROWID
        """)

        for member_name, stream in iter_input_members(args.input_file):
            members_seen += 1
            print(f"Reading {member_name}", file=sys.stderr)
            try:
                with stream:
                    for line in stream:
                        if not line.strip():
                            continue
                        records += 1
                        try:
                            obj = json.loads(line)
                        except (json.JSONDecodeError, UnicodeDecodeError):
                            rejected += 1
                            continue

                        if not isinstance(obj, dict) or str(obj.get("type", "")).lower() != "user":
                            continue
                        raw_id = obj.get("id")
                        if raw_id is None or not str(raw_id).isdigit():
                            continue
                        user_id = str(int(raw_id))
                        images = obj.get("images")
                        if not isinstance(images, list):
                            continue

                        for image in images:
                            if not isinstance(image, dict):
                                continue
                            url = str(image.get("url") or "").strip()
                            if not url.startswith(("http://", "https://")):
                                continue
                            if any(ch in url for ch in "\\t\\r\\n"):
                                continue

                            backlinks = image.get("backlinks")
                            if not isinstance(backlinks, list):
                                continue
                            matching = [
                                backlink for backlink in backlinks
                                if isinstance(backlink, dict) and
                                backlink_matches_user(backlink.get("url"), user_id)
                            ]
                            # A user-type record alone is not enough: verify the
                            # image is actually linked from this user's profile.
                            if not matching:
                                rejected += 1
                                continue

                            stamps = [
                                normalize_timestamp(backlink.get("timestamp"))
                                for backlink in matching
                            ]
                            stamps = [stamp for stamp in stamps if stamp]
                            if not stamps:
                                fallback = normalize_timestamp(
                                    image.get("first_seen") or image.get("last_seen")
                                )
                                if fallback:
                                    stamps = [fallback]
                            if not stamps:
                                rejected += 1
                                continue

                            # Keep the earliest verified profile capture for this
                            # thumbnail; the original URL is replayed by the renderer.
                            stamp = min(stamps)
                            shard = int(user_id) % args.shards
                            cur = conn.execute(
                                "INSERT OR IGNORE INTO entries(shard,user_id,stamp,url) VALUES(?,?,?,?)",
                                (shard, user_id, stamp, url),
                            )
                            if cur.rowcount:
                                accepted += 1
            except (OSError, EOFError, gzip.BadGzipFile) as exc:
                print(f"WARNING: skipped unreadable member {member_name}: {exc}", file=sys.stderr)

            conn.commit()

        # Write plain TSV shards only after successful parsing. Keep source ZIP and
        # source JSONL files untouched.
        for old in args.out.glob("s*.txt*"):
            old.unlink()
        counts = [0] * args.shards
        for shard in range(args.shards):
            target = args.out / f"s{shard}.txt.gz"
            with gzip.open(target, "wt", encoding="utf-8", newline="\n", compresslevel=6) as output:
                cursor = conn.execute(
                    "SELECT user_id, stamp, url FROM entries WHERE shard=? ORDER BY user_id, stamp DESC, url",
                    (shard,),
                )
                for user_id, stamp, url in cursor:
                    output.write(f"{user_id}\t{stamp}\t{url}\n")
                    counts[shard] += 1

        manifest = {
            "format": "user_id<TAB>timestamp<TAB>original_thumbnail_url",
            "shards": args.shards,
            "records_read": records,
            "unique_user_thumbnail_records": accepted,
            "rejected_or_unverified_images": rejected,
            "input_members": members_seen,
            "shard_counts": counts,
        }
        (args.out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(manifest, indent=2))
    finally:
        conn.close()
        try:
            db_path.unlink()
        except OSError:
            pass

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
