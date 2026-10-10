import React, { useEffect, useRef, useState } from 'react';

const API_BASE = (process.env.REACT_APP_API_BASE || 'https://bloxify-backend-sg.onrender.com').replace(/\/$/, '');
const GREETINGS = ['Sup', 'Hi', 'Hello', 'Haii', 'Hai', 'Yo'];
const randomGreeting = () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
const renderCoyEmoji = value => String(value ?? "").split(/(:ono:)/gi).map((part, index) => part.toLowerCase() === ":ono:"
  ? <img key={index} src="/images/ono.png" onError={event => { event.currentTarget.replaceWith(document.createTextNode("😬")); }} alt="nervous, awkward, or startled" title="Nervous / awkward / startled" style={{ width: "1.2em", height: "1.2em", objectFit: "contain", verticalAlign: "-0.25em", display: "inline-block" }} />
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
    if (!url) return <React.Fragment key={index}>{renderCoyEmoji(piece)}</React.Fragment>;
    const href = url.href;
    const embed = youtubeEmbedUrl(href);
    const mediaPath = url.pathname + url.search + url.hash;
    const isImage = Boolean(markdownImage) || /\.(?:png|jpe?g|gif|webp|avif|svg|bmp|tiff?)(?:$|[?#])/i.test(mediaPath);
    const isVideo = /\.(?:mp4|webm|mov|m4v)(?:$|[?#])/i.test(mediaPath);
    const isAudio = /\.(?:mp3|m4a|wav|ogg|opus|flac|aac)(?:$|[?#])/i.test(mediaPath);
    if (isImage) {
      return <span key={index} style={{ display: "block", maxWidth: "100%", marginTop: 6, marginBottom: 4 }}>
        <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", maxWidth: "100%" }} aria-label={"Open image " + (markdownImage?.[1] || href)}>
          <img src={href} alt={markdownImage?.[1] || "Image shared by Coy"} loading="lazy" style={{ display: "block", maxWidth: "100%", maxHeight: 320, height: "auto", objectFit: "contain", border: "1px solid #ccc" }} />
        </a>
        <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: "block", overflowWrap: "anywhere", color: "#0645ad", fontSize: "0.92em" }}>Open image ↗</a>
      </span>;
    }
    if (isVideo) {
      return <span key={index} style={{ display: "block", maxWidth: "100%", marginTop: 7, marginBottom: 5 }}>
        <video controls playsInline preload="metadata" src={href} style={{ display: "block", width: "100%", maxHeight: 320, background: "#111" }} />
        <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#0645ad", overflowWrap: "anywhere" }}>Open video ↗</a>
      </span>;
    }
    if (isAudio) {
      return <span key={index} style={{ display: "block", maxWidth: "100%", marginTop: 7, marginBottom: 5 }}>
        <audio controls preload="metadata" src={href} style={{ display: "block", width: "100%" }} />
        <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#0645ad", overflowWrap: "anywhere" }}>Open audio ↗</a>
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
    return <React.Fragment key={index}><a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#0645ad", textDecoration: "underline", overflowWrap: "anywhere" }}>{renderCoyEmoji(markdownLink?.[1] || href)}</a>{trailing}</React.Fragment>;
  });
}

// Durable local chat history. Cookies are too small for chat logs and can be
// dropped/restricted by mobile browsers, so use localStorage as the primary store.
const COY_CHAT_STORAGE_KEY = 'bagof-fish-coy-chat-v2';
const COY_CHAT_COOKIE = 'coy_chat_log';
function cleanCoyMessages(value, limit = 100) {
  return (Array.isArray(value) ? value : [])
    .filter(item => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
    .slice(-limit)
    .map(item => ({
      role: item.role,
      content: item.content,
      // Keep attachment names/types in history, but not base64 file bytes.
      attachments: Array.isArray(item.attachments)
        ? item.attachments.map(({ name, type }) => ({ name: String(name || 'Attachment').slice(0, 160), type: String(type || '').slice(0, 100) }))
        : undefined,
      image: typeof item.image === 'string' && item.image.length < 1500 ? item.image : undefined,
    }));
}
function readCoyChatLog() {
  try {
    const saved = window.localStorage.getItem(COY_CHAT_STORAGE_KEY);
    if (saved) return cleanCoyMessages(JSON.parse(saved));
  } catch (_) {}
  // One-time migration from the previous compact cookie-based log.
  try {
    const match = document.cookie.split('; ').find(part => part.startsWith(COY_CHAT_COOKIE + '='));
    if (match) {
      const migrated = cleanCoyMessages(JSON.parse(decodeURIComponent(match.slice(COY_CHAT_COOKIE.length + 1))));
      try { window.localStorage.setItem(COY_CHAT_STORAGE_KEY, JSON.stringify(migrated)); } catch (_) {}
      return migrated;
    }
  } catch (_) {}
  return [];
}
function writeCoyChatLog(messages) {
  const clean = cleanCoyMessages(messages);
  // Trim oldest entries progressively if storage is nearly full (e.g. iPhone Safari).
  for (const limit of [100, 60, 30, 12, 4, 1]) {
    try {
      window.localStorage.setItem(COY_CHAT_STORAGE_KEY, JSON.stringify(clean.slice(-limit)));
      return;
    } catch (_) {}
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('couldn’t read that file.'));
    reader.onerror = () => reject(new Error('couldn’t read that file.'));
    reader.readAsDataURL(file);
  });
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
  form: { display: 'flex', gap: 6, padding: 8, borderTop: '1px solid #9b9b9b', background: '#ece9d8', flexShrink: 0, alignItems: 'flex-end' },
  pendingAttachments: { display: 'flex', flexWrap: 'wrap', gap: 5, padding: '6px 8px', background: '#f7f5eb', borderTop: '1px solid #d0cbb8' },
  attachmentChip: { display: 'flex', alignItems: 'center', gap: 5, maxWidth: '100%', padding: '4px 6px', border: '1px solid #aaa', background: '#fff', overflowWrap: 'anywhere' },
  input: { flex: 1, minWidth: 0, minHeight: 34, maxHeight: 100, resize: 'vertical', border: '1px solid #7f9db9', borderRadius: 0, padding: '7px 8px', font: '12px Tahoma, Arial', background: '#fff', color: '#111' },
  button: { minHeight: 30, padding: '4px 12px', border: '1px solid #003c74', borderRadius: 2, color: '#111', font: '12px Tahoma, Arial', background: 'linear-gradient(#fff,#e1e1e1)', cursor: 'pointer' },
  status: { padding: '5px 9px', background: '#ece9d8', color: '#444', borderTop: '1px solid #d0cbb8', fontSize: 10, flexShrink: 0 },
};

export default function CoyChat({ initialImage }) {
  const [messages, setMessages] = useState(() => {
    const saved = readCoyChatLog();
    return saved.length ? saved : (initialImage
      ? [{ role: 'assistant', content: 'Hey, wanna use this?', image: initialImage.src }]
      : []);
  });
  const [greeting] = useState(randomGreeting);
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState([]);
  const fileInputRef = useRef(null);
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
    writeCoyChatLog(messages);
  }, [messages]);

  async function chooseFiles(event) {
    const picked = Array.from(event.target.files || []).map(file => {
      const extension = (file.name.split('.').pop() || '').toLowerCase();
      const inferred = ({
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
        heic: 'image/heic', heif: 'image/heif', bmp: 'image/bmp',
        mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', wav: 'audio/wav',
        ogg: 'audio/ogg', opus: 'audio/opus', flac: 'audio/flac', aac: 'audio/aac',
        aif: 'audio/aiff', aiff: 'audio/aiff', webm: file.type.startsWith('video/') ? 'video/webm' : 'audio/webm',
      })[extension] || '';
      let type = (file.type || inferred).toLowerCase();
      if (type === 'audio/x-m4a' || type === 'audio/m4a') type = 'audio/mp4';
      if (type === 'audio/x-wav') type = 'audio/wav';
      if (type === 'audio/mp3') type = 'audio/mpeg';
      return type && type !== file.type ? new File([file], file.name, { type, lastModified: file.lastModified }) : file;
    });
    event.target.value = '';
    if (!picked.length) return;
    const combined = [...attachments, ...picked];
    if (combined.length > 3) {
      setError('Attach up to 3 files at a time.');
      return;
    }
    if (combined.some(file => !/^(image|audio)\//i.test(file.type))) {
      setError('Coy can inspect image and audio files for now.');
      return;
    }
    if (combined.some(file => file.size > 8 * 1024 * 1024) || combined.reduce((sum, file) => sum + file.size, 0) > 10 * 1024 * 1024) {
      setError('Keep each file under 8 MB and all attachments under 10 MB total.');
      return;
    }
    try {
      const loaded = await Promise.all(picked.map(async file => ({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: await readFileAsDataUrl(file),
      })));
      setAttachments(previous => [...previous, ...loaded].slice(0, 3));
      setError('');
    } catch (err) {
      setError(err.message || 'couldn’t read that file.');
    }
  }

  async function send(event) {
    event.preventDefault();
    const message = draft.trim();
    if ((!message && !attachments.length) || busy) return;
    const filesToSend = attachments;
    const priorHistory = messages.slice(-16).map(({ role, content }) => ({ role, content }));
    setMessages(previous => [...previous, {
      role: 'user',
      content: message,
      attachments: filesToSend.map(({ name, type, dataUrl }) => ({ name, type, dataUrl })),
    }].slice(-100));
    setDraft('');
    setAttachments([]);
    setBusy(true);
    setError('');
    try {
      // Fetch the authoritative total only when the message asks about the visitor count.
      let liveVisitorCount = null;
      if (/\\b(visitor|visitors|visit|visits|counter|traffic)\\b/i.test(message) && /\\b(how many|how much|total|count|number|many people|visitor count|visitors?)\\b/i.test(message)) {
        try {
          const countResponse = await fetch(API_BASE + '/visitor-count/current', { cache: 'no-store' });
          if (countResponse.ok) {
            const countData = await countResponse.json();
            if (Number.isFinite(Number(countData.count)) && Number(countData.count) >= 0) liveVisitorCount = Number(countData.count);
          }
        } catch (_) {}
      }
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
            attachments: filesToSend.map(file => ({
              name: file.name,
              mimeType: file.type,
              data: file.dataUrl.split(',')[1] || '',
            })),
            websiteContext: {
              desktopApps: Array.from(document.querySelectorAll('[data-app-title]'))
                .map(node => node.getAttribute('data-app-title')).filter(Boolean),
              ...(liveVisitorCount !== null ? { totalVisitorCount: liveVisitorCount } : {}),
            },
          }),
        });
      } finally {
        window.clearTimeout(timeout);
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'couldn’t reach coy just now. try again in a bit.');
      const answer = typeof data.answer === 'string' && data.answer.trim() ? data.answer.trim() : '…';
      setMessages(previous => [...previous, { role: 'assistant', content: answer }].slice(-100));
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
            {item.content && <><strong>{item.role === 'user' ? 'You' : 'Coy'}:</strong>{' '}{renderCoyContent(item.content)}</>}
            {Array.isArray(item.attachments) && item.attachments.map((attachment, attachmentIndex) => <div key={attachmentIndex} style={{ marginTop: 7 }}>
              {attachment.dataUrl && attachment.type?.startsWith('image/') && <img src={attachment.dataUrl} alt={attachment.name || 'Uploaded image'} style={{ display: 'block', maxWidth: '100%', maxHeight: 260, objectFit: 'contain', border: '1px solid #ccc', marginBottom: 4 }} />}
              {attachment.dataUrl && attachment.type?.startsWith('audio/') && <audio controls preload="metadata" src={attachment.dataUrl} style={{ display: 'block', maxWidth: '100%', width: 280 }} />}
              <span style={{ fontSize: 11, color: '#444' }}>📎 {attachment.name || 'Attachment'}</span>
            </div>)}
            {item.image && <img src={item.image} alt="Image Coy found on the site" style={{ display: 'block', maxWidth: '100%', maxHeight: 220, marginTop: 7, objectFit: 'contain' }} />}
          </div>
        ))}
        {busy && <div style={{ ...styles.bubble, ...styles.coy }}>Typing…</div>}
        {error && <div role="alert" style={{ ...styles.bubble, borderColor: '#a00000', color: '#8b0000' }}>{error}</div>}
        <div ref={bottomRef} />
      </div>
      {attachments.length > 0 && <div style={styles.pendingAttachments} aria-label="Files ready to send">
        {attachments.map((file, index) => <div key={index} style={styles.attachmentChip}>
          <span>{file.type.startsWith('image/') ? '🖼️' : '🔊'} {file.name}</span>
          <button type="button" style={{ ...styles.button, minHeight: 22, padding: '1px 5px' }} aria-label={'Remove ' + file.name} onClick={() => setAttachments(previous => previous.filter((_, i) => i !== index))}>×</button>
        </div>)}
      </div>}
      <form style={styles.form} onSubmit={send}>
        <input ref={fileInputRef} type="file" accept="image/*,audio/*,.heic,.heif,.m4a,.mp3,.wav,.ogg,.flac,.aac,.opus" multiple onChange={chooseFiles} disabled={busy} style={{ display: 'none' }} />
        <button type="button" style={styles.button} onClick={() => fileInputRef.current?.click()} disabled={busy || attachments.length >= 3} aria-label="Attach images or audio" title="Attach images or audio">＋ Attach</button>
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
        <button type="submit" style={styles.button} disabled={busy || (!draft.trim() && !attachments.length)}>{busy ? '…' : 'Send'}</button>
      </form>
      <div style={styles.status}>Chat log is saved on this browser and should remain when you close this tab.</div>
    </div>
  );
}
