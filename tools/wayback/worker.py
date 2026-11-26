"""Process one batch of the Wayback Machine's copy of the old Roblox forum.

A batch is a range of pages of the Wayback CDX index for forum.roblox.com/Forum/ShowPost.aspx.
For every thread page in the range we take the newest capture from 2016 on (those name
authors by Roblox user ID), fetch it, parse its posts, and keep posts that have an author ID.

Output: <out> (gzip JSON lines, one post per line, with "uid"), plus a progress file so an
unfinished batch can resume in a later run.
"""
import argparse, gzip, json, os, re, sys, threading, time, urllib.error, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(__file__))
from forum_parse import parse_thread_page, thread_from_url

CDX = "https://web.archive.org/cdx/search/cdx"
PREFIX = "forum.roblox.com/Forum/ShowPost.aspx"
UA = {"User-Agent": "bagof.fish forum archive index (https://bagof.fish; c@bagof.fish)"}
MIN_TS = "20160101000000"


class Throttle:
    """Shared pause: when the Wayback Machine says slow down, every thread waits."""
    def __init__(self):
        self.until = 0.0
        self.lock = threading.Lock()

    def wait(self):
        while True:
            delay = self.until - time.time()
            if delay <= 0:
                return
            time.sleep(min(delay, 5))

    def back_off(self, seconds):
        with self.lock:
            self.until = max(self.until, time.time() + seconds)


throttle = Throttle()


def fetch(url, timeout=90, tries=6):
    last = None
    for attempt in range(tries):
        throttle.wait()
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            last = e.code
            if e.code == 404:
                return 404, b""
            if e.code in (429, 503, 502, 504):
                throttle.back_off(60 * (attempt + 1))
            else:
                time.sleep(5 * (attempt + 1))
        except Exception as e:  # timeouts, resets
            last = repr(e)
            throttle.back_off(15 * (attempt + 1))
    return last, b""


def cdx_page(page):
    q = {"url": PREFIX, "matchType": "prefix", "page": str(page),
         "fl": "timestamp,original,statuscode", "filter": "statuscode:200"}
    status, body = fetch(CDX + "?" + urllib.parse.urlencode(q), timeout=180)
    if status != 200:
        raise RuntimeError(f"CDX page {page} failed: {status}")
    return body.decode("utf-8", "replace").splitlines()


def newest_captures(lines):
    """Map (thread id, page index) -> (timestamp, original url), newest capture from 2016 on."""
    best = {}
    for line in lines:
        parts = line.split(" ")
        if len(parts) < 2:
            continue
        ts, original = parts[0], parts[1]
        if ts < MIN_TS:
            continue
        thread, page = thread_from_url(original.replace("&amp;", "&"))
        if not thread:
            continue
        key = (int(thread), page)
        if key not in best or ts > best[key][0]:
            best[key] = (ts, original)
    return best


def snapshot_url(ts, original):
    return f"https://web.archive.org/web/{ts}id_/" + urllib.parse.quote(original, safe=":/?&=%#+,;@!$'()*~")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--batch", type=int, required=True)
    ap.add_argument("--pages-per-batch", type=int, default=50)
    ap.add_argument("--out", required=True)
    ap.add_argument("--progress", required=True, help="progress json (read if present, rewritten)")
    ap.add_argument("--threads", type=int, default=3)
    ap.add_argument("--time-budget", type=int, default=5 * 3600 + 1200, help="seconds")
    ap.add_argument("--max-pages", type=int, default=0, help="testing: cap thread pages fetched")
    args = ap.parse_args()
    started = time.time()

    progress = {"done": [], "failed": [], "batch": args.batch}
    if os.path.exists(args.progress):
        progress = json.load(open(args.progress))
    done = set(tuple(x) for x in progress.get("done", []))

    first = args.batch * args.pages_per_batch
    lines = []
    for p in range(first, first + args.pages_per_batch):
        lines += cdx_page(p)
    captures = newest_captures(lines)
    todo = sorted(k for k in captures if k not in done)
    if args.max_pages:
        todo = todo[: args.max_pages]
    print(f"batch {args.batch}: {len(lines):,} index lines, {len(captures):,} thread pages, "
          f"{len(done):,} already done, {len(todo):,} to fetch", flush=True)

    out = gzip.open(args.out, "at", encoding="utf-8")
    write_lock = threading.Lock()
    failed = []
    kept = fetched = 0

    def work(key):
        ts, original = captures[key]
        status, body = fetch(snapshot_url(ts, original))
        if status != 200:
            return key, None, status
        posts = parse_thread_page(body.decode("utf-8", "replace"), original.replace("&amp;", "&"))
        return key, posts, 200

    pool = ThreadPoolExecutor(max_workers=args.threads)
    futures = {}
    queue = iter(todo)
    out_of_time = False

    def submit_next():
        for key in queue:
            futures[pool.submit(work, key)] = key
            return True
        return False

    for _ in range(args.threads * 2):
        submit_next()
    while futures:
        for fut in as_completed(list(futures)):
            futures.pop(fut)
            key, posts, status = fut.result()
            fetched += 1
            if posts is None:
                failed.append([key[0], key[1], str(status)])
            else:
                with write_lock:
                    for post in posts:
                        if post.get("uid"):
                            out.write(json.dumps(post, ensure_ascii=False, separators=(",", ":")) + "\n")
                            kept += 1
                done.add(key)
            if fetched % 500 == 0:
                rate = fetched / max(1, time.time() - started)
                print(f"  {fetched:,}/{len(todo):,} pages, {kept:,} posts, {len(failed)} failed, {rate:.2f} pages/s", flush=True)
            if time.time() - started > args.time_budget:
                out_of_time = True
            if not out_of_time:
                submit_next()
            break
    pool.shutdown(wait=True)
    out.close()

    complete = not out_of_time and len(done) >= len(captures) - len(failed) and not args.max_pages
    progress = {"batch": args.batch, "done": sorted(done), "failed": failed,
                "threadPages": len(captures), "complete": complete}
    json.dump(progress, open(args.progress, "w"))
    print(json.dumps({"batch": args.batch, "fetched": fetched, "posts": kept, "failed": len(failed),
                      "complete": complete, "seconds": round(time.time() - started)}), flush=True)


if __name__ == "__main__":
    main()
