// Parser for Roblox Forum Archive (archive.froast.io) user post listings.
//
// A user listing (https://archive.froast.io/users/<robloxUserId>) is a table
// where each post row contains a <div class="Topic"> (thread title) and a
// <div class="Body"> (post text). The next page is linked from an anchor with
// the classes "Forward Link-Enabled". Everything else (thread links, subforum
// names, dates) is picked up defensively so small markup changes don't break it.

const ENTITY_MAP = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

export function decodeEntities(value) {
  return String(value || "").replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (match, code) => {
    const lower = code.toLowerCase();
    if (lower[0] === "#") {
      const num = lower[1] === "x" ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
      if (Number.isFinite(num) && num > 0 && num < 0x110000) {
        try { return String.fromCodePoint(num); } catch { return match; }
      }
      return match;
    }
    return Object.prototype.hasOwnProperty.call(ENTITY_MAP, lower) ? ENTITY_MAP[lower] : match;
  });
}

export function htmlToText(html) {
  let source = String(html || "");
  let previous;
  do {
    previous = source;
    source = source.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");
  } while (source !== previous);

  return decodeEntities(source
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|blockquote|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, ""))
    .replace(/\r/g, "")
    .replace(/[ \t\f\v]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t\f\v]{2,}/g, " ")
    .trim();
}

function classOf(tag) {
  const m = tag.match(/\bclass\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
  return m ? (m[2] ?? m[3] ?? m[4] ?? "") : "";
}

function hrefOf(tag) {
  const m = tag.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
  return m ? decodeEntities(m[2] ?? m[3] ?? m[4] ?? "") : "";
}

function hasClass(tag, name) {
  return classOf(tag).split(/\s+/).includes(name);
}

// Return { start, openEnd, end, inner } for the <div> that opens at `start`,
// matching nested <div>s so post bodies containing quotes/divs stay intact.
function balancedDiv(html, start) {
  const openEnd = html.indexOf(">", start);
  if (openEnd === -1) return null;
  const re = /<\/?div\b[^>]*>/gi;
  re.lastIndex = openEnd + 1;
  let depth = 1;
  let m;
  while ((m = re.exec(html))) {
    if (m[0][1] === "/") depth -= 1;
    else if (!/\/>$/.test(m[0])) depth += 1;
    if (depth === 0) {
      return { start, openEnd, end: re.lastIndex, inner: html.slice(openEnd + 1, m.index) };
    }
  }
  return { start, openEnd, end: html.length, inner: html.slice(openEnd + 1) };
}

function findDivsWithClass(html, name, from = 0, to = html.length) {
  const out = [];
  const re = /<div\b[^>]*>/gi;
  re.lastIndex = from;
  let m;
  while ((m = re.exec(html)) && m.index < to) {
    if (hasClass(m[0], name)) out.push(m.index);
  }
  return out;
}

const DATE_PATTERNS = [
  /\b\d{1,2}\/\d{1,2}\/\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)?/i,
  /\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)?/,
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}(?:,?\s+\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)?/i,
];

function findDate(html) {
  const timeTag = html.match(/<time\b[^>]*datetime\s*=\s*["']([^"']+)["'][^>]*>/i);
  if (timeTag) return timeTag[1];
  // Replace tags with spaces so adjacent table cells don't run together ("Topic1/2/2010").
  const textValue = decodeEntities(String(html || "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
  for (const re of DATE_PATTERNS) {
    const m = textValue.match(re);
    if (m) return m[0].trim();
  }
  return "";
}

function findLinks(html) {
  const links = [];
  const re = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    links.push({ tag: m[0].slice(0, m[0].indexOf(">") + 1), href: hrefOf(m[0]), text: htmlToText(m[1]) });
  }
  return links;
}

const MAX_BODY_CHARS = 6000;

export function parseForumUserPage(html) {
  const source = String(html || "");
  const topicStarts = findDivsWithClass(source, "Topic");
  const posts = [];
  let previousEnd = 0;

  topicStarts.forEach((topicStart, index) => {
    const nextTopic = index + 1 < topicStarts.length ? topicStarts[index + 1] : source.length;
    const topic = balancedDiv(source, topicStart);
    if (!topic) return;

    const bodyStart = findDivsWithClass(source, "Body", topic.end, nextTopic)[0];
    const body = bodyStart !== undefined ? balancedDiv(source, bodyStart) : null;

    // Row context: everything between the previous post and the end of this post's row.
    // For the first post, include the row before it in case metadata sits in its own row.
    let contextStart = previousEnd;
    if (index === 0) {
      const ownRow = source.lastIndexOf("<tr", topicStart);
      const priorRow = ownRow > 0 ? source.lastIndexOf("<tr", ownRow - 1) : -1;
      contextStart = priorRow >= 0 ? priorRow : ownRow >= 0 ? ownRow : topicStart;
    }
    const afterPost = body ? body.end : topic.end;
    const rowClose = source.indexOf("</tr", afterPost);
    const contextEnd = rowClose !== -1 && rowClose < nextTopic ? rowClose : nextTopic;
    const context = source.slice(contextStart, contextEnd);
    const contextWithoutBody = body
      ? source.slice(contextStart, body.start) + source.slice(body.end, contextEnd)
      : context;
    previousEnd = contextEnd;

    const links = findLinks(contextWithoutBody);
    const threadLink = findLinks(topic.inner).find((l) => /\/forum\/\d+/.test(l.href))
      || links.find((l) => /\/forum\/\d+/.test(l.href));
    const forumLink = links.find((l) => /\/forums\/\d+/.test(l.href) && l.text);
    const threadMatch = threadLink ? threadLink.href.match(/\/forum\/(\d+)(?:\/(\d+))?/) : null;

    const title = htmlToText(topic.inner);
    let text = body ? htmlToText(body.inner) : "";
    const truncated = text.length > MAX_BODY_CHARS;
    if (truncated) text = text.slice(0, MAX_BODY_CHARS).trimEnd() + "…";
    if (!title && !text) return;

    posts.push({
      title,
      body: text,
      truncated,
      threadId: threadMatch ? threadMatch[1] : "",
      threadUrl: threadMatch ? `https://archive.froast.io/forum/${threadMatch[1]}${threadMatch[2] ? "/" + threadMatch[2] : ""}` : "",
      forum: forumLink ? forumLink.text : "",
      date: findDate(contextWithoutBody),
    });
  });

  let next = "";
  const anchorRe = /<a\b[^>]*>/gi;
  let m;
  while ((m = anchorRe.exec(source))) {
    if (hasClass(m[0], "Forward") && hasClass(m[0], "Link-Enabled")) {
      next = hrefOf(m[0]);
      break;
    }
  }

  return { posts, next };
}

// Only allow cursors that stay on this user's listing on the archive.
export function safeForumPath(userId, rawPath) {
  const id = String(userId || "");
  if (!/^\d+$/.test(id)) return "";
  let value = String(rawPath || "").trim();
  if (!value) return `/users/${id}`;
  try {
    const parsed = new URL(value, "https://archive.froast.io");
    if (parsed.hostname !== "archive.froast.io") return "";
    value = parsed.pathname + parsed.search;
  } catch {
    return "";
  }
  const re = new RegExp(`^/users/${id}(?:/[A-Za-z0-9_-]+)*/?(?:\\?[A-Za-z0-9_=&%.-]*)?$`);
  return re.test(value) ? value : "";
}
