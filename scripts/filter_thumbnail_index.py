#!/usr/bin/env python3
"""Filter a Roblox thumbnail_index.jsonl(.zst) into user-avatar image records.

The input is streamed line by line, so the complete multi-GB index is never
loaded into RAM. Original records are preserved byte-for-byte as JSON text.
"""
from __future__ import annotations

import argparse
import collections
import io
import json
import re
import sys
from pathlib import Path
from typing import Any, Iterator

try:
    import zstandard
except ImportError:
    zstandard = None

AVATAR_URL = re.compile(
    r"(?:/users/avatar(?:-headshot|-thumbnail)?(?:/|\?|$)|"
    r"avatar-headshot|avatar-thumbnail|avatarimage|headshot)",
    re.IGNORECASE,
)
NON_AVATAR = re.compile(
    r"\b(?:asset|audio|game|place|universe|group|badge|catalog|item|"
    r"developer.?product|game.?pass|icon|bundle|decal|mesh|texture|"
    r"animation|sound|video|plugin|shirt|pants|tshirt)\b",
    re.IGNORECASE,
)
USER_TYPE = re.compile(r"^(?:user|users|avatar|headshot|avatar-headshot|avatar-thumbnail)$", re.I)
IMAGE_KEY = re.compile(r"(?:image|thumbnail|avatar|headshot|picture|photo|url|imageurl|thumbnailurl)", re.I)
TYPE_KEY = re.compile(r"(?:^|_)(?:type|kind|category|entity|class|target|resource)(?:$|_)", re.I)


def walk(obj: Any, path: str = "") -> Iterator[tuple[str, Any]]:
    if isinstance(obj, dict):
        for key, value in obj.items():
            p = f"{path}.{key}" if path else str(key)
            yield p, value
            yield from walk(value, p)
    elif isinstance(obj, list):
        for i, value in enumerate(obj):
            yield from walk(value, f"{path}[{i}]")


def classify(record: Any) -> tuple[bool, str]:
    if not isinstance(record, (dict, list)):
        return False, "not_object"

    entries = list(walk(record))
    typed_values: list[str] = []
    image_values: list[str] = []
    all_strings: list[str] = []

    for path, value in entries:
        if not isinstance(value, str):
            continue
        all_strings.append(value)
        key = path.rsplit(".", 1)[-1].split("[", 1)[0]
        if TYPE_KEY.search(key):
            typed_values.append(value.strip())
        if IMAGE_KEY.search(key) and (value.startswith(("http://", "https://", "//", "/")) or "." in value):
            image_values.append(value.strip())

    # Explicit asset/game/group/audio classifications always veto the record.
    type_blob = " ".join(typed_values)
    if NON_AVATAR.search(type_blob):
        return False, "excluded_type"

    user_typed = any(USER_TYPE.fullmatch(v) for v in typed_values)
    avatar_url = any(AVATAR_URL.search(v) for v in all_strings)
    has_image = bool(image_values)

    # Be strict: require either an explicit user/avatar record with an image,
    # or an unmistakable Roblox avatar/headshot URL.
    if user_typed and has_image:
        return True, "explicit_user_with_image"
    if avatar_url and has_image:
        return True, "avatar_url_with_image"
    if avatar_url:
        return True, "avatar_url"
    return False, "not_confirmed_avatar"


def open_text(path: Path):
    raw = path.open("rb")
    if path.name.lower().endswith(".zst"):
        if zstandard is None:
            raw.close()
            raise RuntimeError("Missing dependency. Install it with: py -m pip install zstandard")
        reader = zstandard.ZstdDecompressor().stream_reader(raw)
        return io.TextIOWrapper(reader, encoding="utf-8", errors="replace"), raw
    return io.TextIOWrapper(raw, encoding="utf-8", errors="replace"), raw


def open_output(path: Path):
    if path.name.lower().endswith(".zst"):
        if zstandard is None:
            raise RuntimeError("Missing dependency. Install it with: py -m pip install zstandard")
        raw = path.open("wb")
        writer = zstandard.ZstdCompressor(level=6).stream_writer(raw)
        return io.TextIOWrapper(writer, encoding="utf-8", newline="\n")
    return path.open("w", encoding="utf-8", newline="\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="Path to .jsonl or .jsonl.zst input")
    parser.add_argument("-o", "--output", default="avatar_thumbnail_index.jsonl",
                        help="Filtered JSONL output path")
    parser.add_argument("--report", default="avatar_filter_report.json",
                        help="Machine-readable counts report")
    args = parser.parse_args()

    source = Path(args.input)
    output = Path(args.output)
    report_path = Path(args.report)
    if not source.is_file():
        parser.error(f"Input file not found: {source}")
    if source.resolve() == output.resolve():
        parser.error("Output must be a different file from the input.")

    counts: collections.Counter[str] = collections.Counter()
    keys: collections.Counter[str] = collections.Counter()
    samples: dict[str, dict[str, Any]] = {}
    total = 0
    malformed = 0

    text_stream, raw_stream = open_text(source)
    try:
        with open_output(output) as out:
            for line_number, line in enumerate(text_stream, 1):
                if not line.strip():
                    continue
                total += 1
                try:
                    record = json.loads(line)
                except json.JSONDecodeError:
                    malformed += 1
                    counts["malformed_json"] += 1
                    continue

                if isinstance(record, dict):
                    for key in record.keys():
                        keys[str(key)] += 1

                keep, reason = classify(record)
                counts[reason] += 1
                if reason not in samples and len(samples) < 8:
                    # Samples are written only to the local report, with values
                    # truncated so it stays small and useful for schema review.
                    samples[reason] = {
                        "line": line_number,
                        "top_level_keys": list(record.keys())[:40] if isinstance(record, dict) else [],
                        "record_preview": line[:900],
                    }
                if keep:
                    out.write(line.rstrip("\r\n") + "\n")
                if total % 500000 == 0:
                    print(f"Scanned {total:,} lines; kept {counts['explicit_user_with_image'] + counts['avatar_url_with_image'] + counts['avatar_url']:,}",
                          file=sys.stderr)

    finally:
        text_stream.close()
        raw_stream.close()

    kept = counts["explicit_user_with_image"] + counts["avatar_url_with_image"] + counts["avatar_url"]
    report = {
        "input": str(source),
        "output": str(output),
        "total_nonempty_lines": total,
        "kept_avatar_records": kept,
        "malformed_json_lines": malformed,
        "counts_by_reason": dict(counts),
        "most_common_top_level_keys": keys.most_common(60),
        "sample_records_by_classification": samples,
        "warning": (
            "Conservative filter: records without explicit user/avatar metadata or "
            "recognizable avatar/headshot URLs are excluded. Review the report before "
            "discarding the original archive."
        ),
    }
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({
        "scanned": total,
        "kept": kept,
        "excluded": total - kept - malformed,
        "malformed": malformed,
        "output": str(output),
        "report": str(report_path),
    }, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(2)
