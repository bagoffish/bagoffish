"""Pick the next batches for the forum workers.

Reads the work release's asset names from stdin (one per line) and prints a JSON list of
batch numbers: unfinished partial batches first, then the lowest batches not started.
"""
import json, math, re, sys, urllib.parse, urllib.request

count = int(sys.argv[1]); per_batch = int(sys.argv[2])
assets = set(line.strip() for line in sys.stdin if line.strip())
q = {"url": "forum.roblox.com/Forum/ShowPost.aspx", "matchType": "prefix", "showNumPages": "true"}
req = urllib.request.Request("https://web.archive.org/cdx/search/cdx?" + urllib.parse.urlencode(q),
                             headers={"User-Agent": "bagof.fish forum archive index (c@bagof.fish)"})
pages = int(urllib.request.urlopen(req, timeout=180).read().decode().strip())
total = math.ceil(pages / per_batch)
done = {int(m.group(1)) for a in assets if (m := re.match(r"batch-(\d+)\.jsonl\.gz$", a))}
partial = sorted({int(m.group(1)) for a in assets if (m := re.match(r"partial-(\d+)\.progress\.json$", a))} - done)
fresh = [b for b in range(total) if b not in done and b not in partial]
pick = (partial + fresh)[:count]
print(json.dumps({"batches": pick, "total": total, "done": len(done), "indexPages": pages}))
