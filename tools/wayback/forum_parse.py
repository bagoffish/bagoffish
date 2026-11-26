"""Parse archived Roblox forum thread pages (Forum/ShowPost.aspx) into post records.

Handles the 2016-2017 layout (authors linked as /users/<id>/profile) and older
layouts (authors linked by username only). Each record:
  {"id": post id, "th": thread id, "ti": thread title, "f": subforum,
   "uid": author user id or None, "u": author username, "t": date text, "b": body text}
"""
import html as htmllib
import re

POST_ANCHOR = re.compile(r'<a name="(\d+)"\s*/?>')
AUTHOR = re.compile(
    r'<a class="normalTextSmallBold[^"]*" href="([^"]*)">([^<]{1,64})</a>', re.I)
BODY = re.compile(r'<span class="normalTextSmall(?: [^"]*)?">(.*?)</span>\s*</td>', re.S | re.I)
DATE_TEXT = re.compile(r'\d{1,2} [A-Z][a-z]{2} \d{4} \d{1,2}:\d{2} [AP]M')
TITLE_NEW = re.compile(r'id="[^"]*PostTitle"[^>]*>(.*?)</h2>', re.S | re.I)
TITLE_OLD = re.compile(r'>&nbsp;Thread:\s*(.*?)</th>', re.S | re.I)
FORUM_LINK = re.compile(r'id="[^"]*LinkForum"[^>]*href="[^"]*ForumID=(\d+)"[^>]*>(.*?)</a>', re.S | re.I)
FORUM_LINK_OLD = re.compile(r'href="[^"]*ShowForum\.aspx\?ForumID=(\d+)"[^>]*>([^<]{1,80})</a>', re.I)
USER_ID = re.compile(r'/users/(\d+)/profile|[?&](?:ID|UserID)=(\d+)', re.I)

MAX_BODY = 6000


def text_of(fragment):
    s = re.sub(r'<br\s*/?>', '\n', fragment or '', flags=re.I)
    s = re.sub(r'<[^>]+>', '', s)
    s = htmllib.unescape(s).replace('\r', '')
    s = re.sub(r'[ \t\xa0]+\n', '\n', s)
    s = re.sub(r'\n{3,}', '\n\n', s)
    return s.strip()


def thread_from_url(url):
    m = re.search(r'PostID=(\d+)', url or '', re.I)
    p = re.search(r'PageIndex=(\d+)', url or '', re.I)
    return (m.group(1) if m else ''), (int(p.group(1)) if p else 1)


def parse_thread_page(page, url=''):
    thread_id, _ = thread_from_url(url)
    m = TITLE_NEW.search(page) or TITLE_OLD.search(page)
    title = text_of(m.group(1)) if m else ''
    m = FORUM_LINK.search(page) or FORUM_LINK_OLD.search(page)
    forum = text_of(m.group(2)) if m else ''

    anchors = list(POST_ANCHOR.finditer(page))
    posts = []
    for i, a in enumerate(anchors):
        post_id = a.group(1)
        prev_end = anchors[i - 1].end() if i else 0
        next_start = anchors[i + 1].start() if i + 1 < len(anchors) else len(page)

        # Author: the last author link before this post's anchor (and after the previous post).
        authors = list(AUTHOR.finditer(page, prev_end, a.start()))
        if not authors:
            continue
        href, name = authors[-1].group(1), text_of(authors[-1].group(2))
        um = USER_ID.search(href)
        uid = (um.group(1) or um.group(2)) if um else None

        # Date: newest layout puts it right before the anchor, older ones right after.
        before = page[authors[-1].end():a.start()]
        dates = DATE_TEXT.findall(before)
        if not dates:
            dates = DATE_TEXT.findall(page[a.end():min(next_start, a.end() + 600)])
        date = dates[-1] if dates else ''

        bm = BODY.search(page, a.end(), next_start)
        body = text_of(bm.group(1)) if bm else ''
        if len(body) > MAX_BODY:
            body = body[:MAX_BODY].rstrip() + '…'

        posts.append({
            'id': int(post_id), 'th': int(thread_id) if thread_id else None,
            'ti': title, 'f': forum, 'uid': int(uid) if uid else None,
            'u': name, 't': date, 'b': body,
        })
    return posts
