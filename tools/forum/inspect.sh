#!/usr/bin/env bash
# Inspect the Roblox Forum Archive's public S3 bucket (rbx-archive, us-west-2).
set -uo pipefail
mkdir -p probe/forum
B="https://rbx-archive.s3-eu-west-1.amazonaws.com"
curl -sS "$B/?list-type=2&delimiter=/&max-keys=50" > probe/forum/root-delim.xml
curl -sS "$B/?list-type=2&max-keys=1000" > probe/forum/list1.xml
head -c 3000 probe/forum/list1.xml; echo
python3 - <<'PY'
import re, urllib.request, gzip, json, os
B = "https://rbx-archive.s3-eu-west-1.amazonaws.com"
x = open("probe/forum/list1.xml").read()
keys = re.findall(r"<Key>(.*?)</Key>", x); sizes = list(map(int, re.findall(r"<Size>(\d+)</Size>", x)))
print("first page keys", len(keys), "sum", sum(sizes)); print(keys[:20])
os.makedirs("probe/forum/samples", exist_ok=True)
picked = [k for k in keys if not k.endswith("/")][:4]
for k in picked:
    raw = urllib.request.urlopen(f"{B}/{urllib.request.quote(k)}").read()
    try: data = gzip.decompress(raw)
    except Exception: data = raw
    print(k, len(raw), "->", len(data), data[:200])
    open("probe/forum/samples/" + re.sub(r"[^A-Za-z0-9._-]", "_", k), "wb").write(data[:600000])
PY
# Estimate total size/count by walking the listing (cap pages so the job stays short).
python3 - <<'PY'
import re, urllib.request, urllib.parse, time, json
B = "https://rbx-archive.s3-eu-west-1.amazonaws.com"
token = None; n = 0; total = 0; pages = 0; t0 = time.time(); last = ""
while pages < 3000 and time.time() - t0 < 1500:
    q = {"list-type": "2", "max-keys": "1000"}
    if token: q["continuation-token"] = token
    x = urllib.request.urlopen(B + "/?" + urllib.parse.urlencode(q)).read().decode()
    ks = re.findall(r"<Key>(.*?)</Key>", x); n += len(ks); total += sum(map(int, re.findall(r"<Size>(\d+)</Size>", x)))
    if ks: last = ks[-1]
    pages += 1
    m = re.search(r"<NextContinuationToken>(.*?)</NextContinuationToken>", x)
    if not m: break
    token = m.group(1)
res = {"objects_seen": n, "bytes_seen": total, "pages": pages, "complete": not bool(token) or pages < 3000 and time.time() - t0 < 1500 and not m, "last_key": last}
print(res); open("probe/forum/listing-stats.json", "w").write(json.dumps(res))
PY
