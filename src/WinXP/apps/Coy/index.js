import React, { useEffect, useRef, useState } from 'react';

const API_BASE = (process.env.REACT_APP_API_BASE || 'https://bloxify-backend-sg.onrender.com').replace(/\/$/, '');
const GREETINGS = ['Sup', 'Hi', 'Hello', 'Haii', 'Hai', 'Yo'];
const randomGreeting = () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
const renderCoyEmoji = value => String(value ?? "").split(/(:ono:)/gi).map((part, index) => part.toLowerCase() === ":ono:"
  ? <img key={index} src={(process.env.PUBLIC_URL || "").replace(/\/$/, "") + "/images/ono.png"} alt="nervous, awkward, or startled" title="Nervous / awkward / startled" style={{ width: "1.2em", height: "1.2em", objectFit: "contain", verticalAlign: "-0.25em", display: "inline-block" }} />
  : part);

function safeWebUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch (_) { return null; }
}
function youtubeEmbedUrl(value) {
  const url = safeWebUrl(value);
  if (!url) return null;
  let id = "";
  if (url.hostname === "youtu.be" || url.hostname.endsWith(".youtu.be")) id = url.pathname.split("/").filter(Boolean)[0] || "";
  else if (url.hostname === "youtube.com" || url.hostname.endsWith(".youtube.com") || url.hostname === "youtube-nocookie.com" || url.hostname.endsWith(".youtube-nocookie.com")) {
    id = url.searchParams.get("v") || (url.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/) || [])[1] || "";
  }
  return /^[\w-]{11}$/.test(id) ? "https://www.youtube-nocookie.com/embed/" + id : null;
}
function renderCoyContent(value) {
  const pattern = /(!\[[^\]]*\]\(https?:\/\/[^\s)]+\)|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<>"']+)/g;
  const pieces = String(value ?? "").split(pattern);
  return pieces.map((piece, index) => {
    if (!piece) return null;
    const markdownImage = piece.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/);
    const markdownLink = piece.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    let rawUrl = markdownImage?.[2] || markdownLink?.[2] || (piece.startsWith("http") ? piece : "");
    let trailing = "";
    if (rawUrl && !markdownImage && !markdownLink) {
      while (/[.,!?;:]$/.test(rawUrl)) { trailing = rawUrl.slice(-1) + trailing; rawUrl = rawUrl.slice(0, -1); }
    }
    const url = rawUrl ? safeWebUrl(rawUrl) : null;
    if (!url) return <React.Fragment key={index}>{piece}</React.Fragment>;
    const href = url.href;
    const embed = youtubeEmbedUrl(href);
    const isImage = Boolean(markdownImage) || /\.(?:png|jpe?g|gif|webp|avif|svg)(?:$|[?#])/i.test(url.pathname + url.search + url.hash);
    if (isImage) {
      return <span key={index} style={{ display: "block", maxWidth: "100%", marginTop: 6, marginBottom: 4 }}>
        <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", maxWidth: "100%" }} aria-label={"Open image " + (markdownImage?.[1] || href)}>
          <img src={href} alt={markdownImage?.[1] || "Image shared by Coy"} loading="lazy" style={{ display: "block", maxWidth: "100%", maxHeight: 320, height: "auto", objectFit: "contain", border: "1px solid #ccc" }} />
        </a>
        <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: "block", overflowWrap: "anywhere", color: "#0645ad", fontSize: "0.92em" }}>Open image ↗</a>
      </span>;
    }
    if (embed) {
      return <span key={index} style={{ display: "block", width: "min(100%, 420px)", marginTop: 7, marginBottom: 5 }}>
        <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#0645ad", overflowWrap: "anywhere" }}>{markdownLink?.[1] || href} ↗</a>
        <span style={{ display: "block", position: "relative", width: "100%", aspectRatio: "16 / 9", marginTop: 5, background: "#111" }}>
          <iframe title="YouTube video" src={embed} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
        </span>
      </span>;
    }
    return <React.Fragment key={index}><a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#0645ad", textDecoration: "underline", overflowWrap: "anywhere" }}>{markdownLink?.[1] || href}</a>{trailing}</React.Fragment>;
  });
}

// Cookie-backed chat log. Keep it compact because browsers limit each cookie to ~4 KB.
const COY_CHAT_COOKIE = 'coy_chat_log';
function readCoyChatCookie() {
  try {
    const match = document.cookie.split('; ').find(part => part.startsWith(COY_CHAT_COOKIE + '='));
    if (!match) return [];
    const parsed = JSON.parse(decodeURIComponent(match.slice(COY_CHAT_COOKIE.length + 1)));
    return Array.isArray(parsed) ? parsed.filter(item => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string').slice(-12) : [];
  } catch (_) { return []; }
}
function writeCoyChatCookie(messages) {
  try {
    let kept = messages.slice(-12);
    let encoded = encodeURIComponent(JSON.stringify(kept));
    while (encoded.length > 3500 && kept.length > 2) {
      kept = kept.slice(1);
      encoded = encodeURIComponent(JSON.stringify(kept));
    }
    document.cookie = COY_CHAT_COOKIE + '=' + encoded + '; Max-Age=2592000; Path=/; SameSite=Lax';
  } catch (_) {}
}

const styles = {
  root: { height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', background: '#ece9d8', color: '#111', font: '12px Tahoma, Arial, sans-serif' },
  intro: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'linear-gradient(#fff,#e7e4d6)', borderBottom: '1px solid #9b9b9b', flexShrink: 0 },
  portrait: { width: 58, height: 70, objectFit: 'contain', objectPosition: 'bottom', flexShrink: 0 },
  title: { fontWeight: 'bold', fontSize: 14, marginBottom: 5 },
  subtitle: { lineHeight: 1.45, color: '#444' },
  messages: { flex: 1, minHeight: 0, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, background: '#fff' },
  bubble: { maxWidth: '92%', padding: '7px 9px', border: '1px solid #b7b7b7', borderRadius: 2, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.45 },
  user: { alignSelf: 'flex-end', background: '#e7f0ff', borderColor: '#9ab8e8' },
  coy: { alignSelf: 'flex-start', background: '#f7f5eb' },
  form: { display: 'flex', gap: 6, padding: 8, borderTop: '1px solid #9b9b9b', background: '#ece9d8', flexShrink: 0 },
  input: { flex: 1, minWidth: 0, minHeight: 34, maxHeight: 100, resize: 'vertical', border: '1px solid #7f9db9', borderRadius: 0, padding: '7px 8px', font: '12px Tahoma, Arial', background: '#fff', color: '#111' },
  button: { minHeight: 30, padding: '4px 12px', border: '1px solid #003c74', borderRadius: 2, color: '#111', font: '12px Tahoma, Arial', background: 'linear-gradient(#fff,#e1e1e1)', cursor: 'pointer' },
  status: { padding: '5px 9px', background: '#ece9d8', color: '#444', borderTop: '1px solid #d0cbb8', fontSize: 10, flexShrink: 0 },
};

export default function CoyChat({ initialImage }) {
  const [messages, setMessages] = useState(() => {
    const saved = readCoyChatCookie();
    return saved.length ? saved : (initialImage
      ? [{ role: 'assistant', content: 'Hey, wanna use this?', image: initialImage.src }]
      : []);
  });
  const [greeting] = useState(randomGreeting);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, busy, error]);

  useEffect(() => {
    writeCoyChatCookie(messages);
  }, [messages]);

  async function send(event) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    const priorHistory = messages.slice(-16).map(({ role, content }) => ({ role, content }));
    setMessages(previous => [...previous, { role: 'user', content: message }].slice(-18));
    setDraft('');
    setBusy(true);
    setError('');
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 55000);
      let response;
      try {
        response = await fetch(API_BASE + '/personal-ai/chat', {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            message,
            history: priorHistory,
            websiteContext: {
              desktopApps: Array.from(document.querySelectorAll('[data-app-title]'))
                .map(node => node.getAttribute('data-app-title')).filter(Boolean),
            },
          }),
        });
      } finally {
        window.clearTimeout(timeout);
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'couldn’t reach coy just now. try again in a bit.');
      const answer = typeof data.answer === 'string' && data.answer.trim() ? data.answer.trim() : '…';
      setMessages(previous => [...previous, { role: 'assistant', content: answer }].slice(-18));
    } catch (err) {
      setError(err.name === 'AbortError'
        ? 'coy took too long to answer. try again in a bit.'
        : (err.message === 'Failed to fetch'
          ? 'couldn’t reach coy just now. check the connection and try again.'
          : (err.message || 'couldn’t send that just now. try again in a bit.')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.root} data-coy-chat-window="true">
      <div style={styles.intro}>
        <img src={(process.env.PUBLIC_URL || '').replace(/\/$/, '') + '/images/coy.png'} alt="Coy" style={styles.portrait} />
        <div>
          <div style={styles.title}>Coy</div>
        </div>
      </div>
      <div style={styles.messages} aria-live="polite">
        {!messages.length && <div style={{ ...styles.bubble, ...styles.coy }}><strong>Coy:</strong> {greeting}</div>}
        {messages.map((item, index) => (
          <div key={index} style={{ ...styles.bubble, ...(item.role === 'user' ? styles.user : styles.coy) }}>
            <strong>{item.role === 'user' ? 'You' : 'Coy'}:</strong>{' '}{renderCoyContent(item.content)}
            {item.image && <img src={item.image} alt="Image Coy found on the site" style={{ display: 'block', maxWidth: '100%', maxHeight: 220, marginTop: 7, objectFit: 'contain' }} />}
          </div>
        ))}
        {busy && <div style={{ ...styles.bubble, ...styles.coy }}>Typing…</div>}
        {error && <div role="alert" style={{ ...styles.bubble, borderColor: '#a00000', color: '#8b0000' }}>{error}</div>}
        <div ref={bottomRef} />
      </div>
      <form style={styles.form} onSubmit={send}>
        <textarea
          ref={inputRef}
          aria-label="Message Coy"
          rows={2}
          maxLength={2000}
          placeholder="say something..."
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(event); } }}
          style={styles.input}
          disabled={busy}
        />
        <button type="submit" style={styles.button} disabled={busy || !draft.trim()}>{busy ? '…' : 'Send'}</button>
      </form>
      <div style={styles.status}>Chat log is saved in a cookie for 30 days on this browser.</div>
    </div>
  );
}
