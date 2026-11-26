"""Merge Wayback forum batches into per-user shards for the forum-posts-index release.

Input:  directory of batch files (*.jsonl.gz), one post per line with "uid".
Output: <out>/fp-s<N>.txt.gz and <out>/manifest.json.
Shard lines are "<uid>\\t<json>" with keys id, th, ti, f, u, b, t; each user's posts are
de-duplicated by post id and sorted oldest first.
"""
import argparse, glob, gzip, json, os, shutil, time


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs")
    ap.add_argument("out")
    ap.add_argument("--shards", type=int, default=990)
    ap.add_argument("--max-body", type=int, default=2000)
    ap.add_argument("--max-title", type=int, default=160)
    args = ap.parse_args()
    tmp = os.path.join(args.out, "_tmp")
    os.makedirs(tmp, exist_ok=True)

    buckets = [open(os.path.join(tmp, f"{i}.txt"), "w", encoding="utf-8") for i in range(args.shards)]
    files = sorted(glob.glob(os.path.join(args.inputs, "*.jsonl.gz")))
    read = 0
    for path in files:
        try:
            with gzip.open(path, "rt", encoding="utf-8") as f:
                for line in f:
                    try:
                        p = json.loads(line)
                        uid = int(p["uid"])
                    except Exception:
                        continue
                    body = p.get("b") or ""
                    if len(body) > args.max_body:
                        body = body[: args.max_body].rstrip() + "…"
                    rec = {"id": p.get("id"), "th": p.get("th"), "ti": (p.get("ti") or "")[: args.max_title],
                           "f": p.get("f") or "", "u": p.get("u") or "", "b": body, "t": p.get("t") or ""}
                    buckets[uid % args.shards].write(f"{uid}\t{json.dumps(rec, ensure_ascii=False, separators=(',', ':'))}\n")
                    read += 1
        except (OSError, EOFError) as e:
            print("skipping unreadable", path, e)
    for b in buckets:
        b.close()

    records = users = 0
    for i in range(args.shards):
        src = os.path.join(tmp, f"{i}.txt")
        seen = {}
        with open(src, encoding="utf-8") as f:
            for line in f:
                uid, _, js = line.rstrip("\n").partition("\t")
                try:
                    pid = int(json.loads(js)["id"])
                except Exception:
                    continue
                seen[(int(uid), pid)] = js
        os.remove(src)
        keys = sorted(seen)
        users += len({k[0] for k in keys})
        records += len(keys)
        with gzip.open(os.path.join(args.out, f"fp-s{i}.txt.gz"), "wt", encoding="utf-8", compresslevel=6) as g:
            for uid, pid in keys:
                g.write(f"{uid}\t{seen[(uid, pid)]}\n")
    shutil.rmtree(tmp, ignore_errors=True)

    manifest = {
        "name": "Roblox Forum (rebuilt from Wayback Machine captures)",
        "source": "https://archive.org/details/archiveteam_roblox (via https://web.archive.org)",
        "shards": args.shards, "prefix": "fp-s", "suffix": ".txt.gz",
        "records": records, "users": users, "batchFiles": len(files), "linesRead": read,
        "fields": {"id": "post id", "th": "thread id", "ti": "thread title", "f": "subforum",
                   "u": "username", "b": "post text", "t": "posted (forum time)"},
        "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    json.dump(manifest, open(os.path.join(args.out, "manifest.json"), "w"), indent=1)
    print(json.dumps(manifest))


if __name__ == "__main__":
    main()
