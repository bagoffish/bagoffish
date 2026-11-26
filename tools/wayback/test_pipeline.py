"""Tests for the Wayback forum pipeline. Run: python3 tools/wayback/test_pipeline.py"""
import gzip, json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from forum_parse import parse_thread_page, thread_from_url
from worker import newest_captures


def load(name):
    return open(os.path.join(HERE, "fixtures", name), encoding="utf-8", errors="replace").read()


def test_2017_layout():
    posts = parse_thread_page(load("thread_2017.html"), "https://forum.roblox.com/Forum/ShowPost.aspx?PostID=10000007&PageIndex=1")
    assert len(posts) == 25, len(posts)
    first = posts[0]
    assert first["id"] == 10000007 and first["th"] == 10000007
    assert first["uid"] == 557844 and first["u"] == "AlextheWerepyre"
    assert first["t"] == "21 Jun 2009 11:12 PM"
    assert first["f"] == "Off Topic"
    assert first["ti"].startswith("Frankly, my dear")
    assert first["b"].startswith("Only talked to her on the phone.\n\nAnywho")
    assert all(p["uid"] for p in posts)
    assert len({p["id"] for p in posts}) == 25


def test_2006_layout_has_no_ids():
    posts = parse_thread_page(load("thread_2006.html"), "http://www.roblox.com/Forum/ShowPost.aspx?PostID=2351&PageIndex=1")
    assert len(posts) == 25
    assert posts[0]["u"] == "DracoSwordMaster" and posts[0]["uid"] is None
    assert posts[0]["t"] == "12 Sep 2006 07:19 PM" and posts[0]["ti"] == "Join the Draco Army"


def test_thread_from_url():
    assert thread_from_url("https://forum.roblox.com/Forum/ShowPost.aspx?PostID=5&PageIndex=3") == ("5", 3)
    assert thread_from_url("http://forum.roblox.com:80/Forum/ShowPost.aspx?PostID=177918146&rbxp=1&nl=true") == ("177918146", 1)
    assert thread_from_url("http://x/none") == ("", 1)


def test_newest_capture_selection():
    lines = [
        "20151101000000 http://forum.roblox.com/Forum/ShowPost.aspx?PostID=9 200",
        "20161101000000 http://forum.roblox.com/Forum/ShowPost.aspx?PostID=9&nl=true 200",
        "20171208000000 https://forum.roblox.com/Forum/ShowPost.aspx?PostID=9&PageIndex=1 200",
        "20171209000000 https://forum.roblox.com/Forum/ShowPost.aspx?PostID=9&amp;PageIndex=2 200",
        "20150101000000 http://forum.roblox.com/Forum/ShowPost.aspx?PostID=11 200",
    ]
    best = newest_captures(lines)
    assert best[(9, 1)][0] == "20171208000000"
    assert best[(9, 2)][0] == "20171209000000"
    assert (11, 1) not in best  # only pre-2016 capture: no user ids


def test_merge_dedupes_and_groups():
    with tempfile.TemporaryDirectory() as d:
        inp = os.path.join(d, "in"); out = os.path.join(d, "out"); os.makedirs(inp)
        posts = parse_thread_page(load("thread_2017.html"), "https://forum.roblox.com/Forum/ShowPost.aspx?PostID=10000007")
        for name in ("a.jsonl.gz", "b.jsonl.gz"):  # same posts twice -> deduped
            with gzip.open(os.path.join(inp, name), "wt") as f:
                for p in posts:
                    f.write(json.dumps(p) + "\n")
        subprocess.run([sys.executable, os.path.join(HERE, "merge.py"), inp, out, "--shards", "7"], check=True, capture_output=True)
        manifest = json.load(open(os.path.join(out, "manifest.json")))
        assert manifest["records"] == 25 and manifest["shards"] == 7
        shard = gzip.open(os.path.join(out, f"fp-s{557844 % 7}.txt.gz"), "rt").read()
        mine = [l for l in shard.splitlines() if l.startswith("557844\t")]
        assert len(mine) == sum(1 for p in posts if p["uid"] == 557844)
        rec = json.loads(mine[0].split("\t", 1)[1])
        assert set(rec) == {"id", "th", "ti", "f", "u", "b", "t"} and rec["id"] == 10000007


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("ok", name)
