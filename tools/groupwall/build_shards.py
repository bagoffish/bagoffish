"""Split the Roblox Group Wall Archive database into per-user gzip shards.

Input:  RobloxGroupWall.db (table wall(post, group, user, username, role, content, created))
Output: <out>/gw-s<N>.txt.gz for N in 0..shards-1, plus <out>/manifest.json

Each shard line is "<userId>\\t<json>" where json has compact keys:
  id=post id, g=group id, u=username at the time, r=role, m=message, t=created (ISO 8601)
Rows are read in post order, so each user's lines are chronological.
"""
import argparse, gzip, json, os, sqlite3, sys, time

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("db")
    ap.add_argument("out")
    ap.add_argument("--shards", type=int, default=960)
    ap.add_argument("--max-message", type=int, default=4000)
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    con = sqlite3.connect(f"file:{args.db}?mode=ro&immutable=1", uri=True)
    con.execute("PRAGMA mmap_size=0")
    con.execute("PRAGMA cache_size=-262144")
    handles = [gzip.open(os.path.join(args.out, f"gw-s{i}.txt.gz"), "wt", encoding="utf-8", newline="\n", compresslevel=6)
               for i in range(args.shards)]
    counts = [0] * args.shards
    rows = skipped = 0
    started = time.time()
    dumps = json.JSONEncoder(ensure_ascii=False, separators=(",", ":")).encode

    cur = con.execute('SELECT post, "group", "user", username, role, content, created FROM wall ORDER BY rowid')
    while True:
        batch = cur.fetchmany(50000)
        if not batch:
            break
        for post, group, user, username, role, content, created in batch:
            rows += 1
            try:
                uid = int(user)
            except (TypeError, ValueError):
                skipped += 1
                continue
            if uid <= 0:
                skipped += 1
                continue
            msg = content or ""
            if len(msg) > args.max_message:
                msg = msg[: args.max_message] + "…"
            rec = {"id": post, "g": group, "u": username or "", "r": role or "", "m": msg, "t": created or ""}
            s = uid % args.shards
            handles[s].write(f"{uid}\t{dumps(rec)}\n")
            counts[s] += 1
        if rows % 5_000_000 < 50000:
            rate = rows / max(1, time.time() - started)
            print(f"{rows:,} rows, {skipped:,} skipped, {rate:,.0f} rows/s", flush=True)

    for h in handles:
        h.close()
    records = sum(counts)
    manifest = {
        "name": "Roblox Group Wall Archive",
        "source": "https://archive.org/details/roblox-group-wall-archive",
        "shards": args.shards, "prefix": "gw-s", "suffix": ".txt.gz",
        "records": records, "rowsRead": rows, "rowsWithoutUser": skipped,
        "fields": {"id": "post id", "g": "group id", "u": "username", "r": "role", "m": "message", "t": "created"},
        "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    with open(os.path.join(args.out, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1)
    print(json.dumps(manifest))
    print(f"largest shard: {max(counts):,} rows; smallest: {min(counts):,}")

if __name__ == "__main__":
    main()
