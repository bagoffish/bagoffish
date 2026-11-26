"""Measure Wayback Machine coverage of the old Roblox forum and save sample pages."""
import json, time, urllib.request, urllib.parse, re
from pathlib import Path
OUT = Path("probe/wayback"); OUT.mkdir(parents=True, exist_ok=True)
UA = {"User-Agent": "bagof.fish forum archive index (contact: c@bagof.fish)"}
def get(url, timeout=120):
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return r.status, r.read()
        except Exception as e:
            err = e; time.sleep(5 * (i + 1))
    return repr(err), b""
report = {}
prefixes = ["forum.roblox.com/Forum/ShowPost.aspx", "www.roblox.com/Forum/ShowPost.aspx", "forum.roblox.com/Forum/User/UserPosts", "forum.roblox.com/Forum/ShowForum.aspx"]
for p in prefixes:
    q = {"url": p, "matchType": "prefix", "filter": "statuscode:200", "collapse": "urlkey", "output": "json", "limit": "20", "fl": "timestamp,original,length"}
    st, body = get("https://web.archive.org/cdx/search/cdx?" + urllib.parse.urlencode(q))
    rows = json.loads(body) if st == 200 and body.strip() else []
    q2 = {"url": p, "matchType": "prefix", "filter": "statuscode:200", "collapse": "urlkey", "showNumPages": "true"}
    st2, pages = get("https://web.archive.org/cdx/search/cdx?" + urllib.parse.urlencode(q2))
    report[p] = {"status": st, "sample": rows[:12], "cdx_pages": pages.decode().strip() if st2 == 200 else st2}
    print(p, report[p]["cdx_pages"], rows[:4], flush=True)
    for ts, orig, *_ in rows[1:4]:
        st3, html = get(f"https://web.archive.org/web/{ts}id_/{orig}")
        name = re.sub(r"[^A-Za-z0-9]+", "_", orig)[-90:]
        (OUT / f"{ts}_{name}.html").write_bytes(html[:500000])
        print("  sample", st3, len(html), orig, flush=True)
(OUT / "report.json").write_text(json.dumps(report, indent=1))
