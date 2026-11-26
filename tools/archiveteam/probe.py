"""Check whether Archive Team Roblox files are downloadable (public) or restricted."""
import json, urllib.request, urllib.error
from pathlib import Path
OUT = Path("probe"); OUT.mkdir(exist_ok=True)
UA = {"User-Agent": "bagof.fish archive access check"}
def fetch(url, extra=None):
    h = dict(UA); h.update(extra or {})
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=60) as r:
            return r.status, r.read(64)
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception as e:
        return repr(e), b""
items = json.loads(urllib.request.urlopen(urllib.request.Request("https://archive.org/advancedsearch.php?q=collection%3Aarchiveteam_roblox&fl[]=identifier&rows=1000&output=json", headers=UA)).read())["response"]["docs"]
ids = sorted(d["identifier"] for d in items)
sample = ids[:3] + ids[150:152] + ids[-6:]
report = []
for ident in sample:
    meta = json.loads(urllib.request.urlopen(urllib.request.Request(f"https://archive.org/metadata/{ident}", headers=UA)).read())
    m = meta.get("metadata", {})
    row = {"id": ident, "access-restricted": m.get("access-restricted-item"), "collection": m.get("collection"), "files": {}}
    for f in meta.get("files", []):
        n = f["name"]
        if n.endswith((".warc.gz", ".cdx.gz", ".json.gz")):
            row["files"][n] = {"size": f.get("size"), "private": f.get("private"), "status": fetch(f"https://archive.org/download/{ident}/{n}", {"Range": "bytes=0-63"})[0]}
    print(json.dumps(row), flush=True); report.append(row)
(OUT / "access.json").write_text(json.dumps(report, indent=1))
