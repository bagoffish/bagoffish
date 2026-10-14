import React, { useEffect, useRef, useState } from 'react';

const API_BASE = (process.env.REACT_APP_API_BASE || 'https://bloxify-backend-sg.onrender.com').replace(/\/$/, '');
const GREETINGS = ['Sup', 'Hi', 'Hello', 'Haii', 'Hai', 'Yo'];
const randomGreeting = () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
const ALLOWED_COY_EMOJIS = ["😭", "💀", "👀", "🖤", "💔", "🥀"];
function removeUnwantedCoyEmojis(value) {
  let text = String(value ?? "");
  const protectedTokens = [];
  ALLOWED_COY_EMOJIS.forEach((emoji, index) => {
    const token = `__COY_ALLOWED_EMOJI_${index}__`;
    text = text.split(emoji).join(token);
    protectedTokens.push([token, emoji]);
  });
  // Strip other pictographic emoji, flags, and emoji modifiers; preserve the user's six.
  text = text.replace(/(?:\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*)|(?:\p{Regional_Indicator}{2})|\p{Emoji_Modifier}/gu, "");
  for (const [token, emoji] of protectedTokens) text = text.split(token).join(emoji);
  return text;
}

const renderCoyEmoji = value => String(value ?? "").split(/(:ono:)/gi).map((part, index) => part.toLowerCase() === ":ono:"
  ? <img key={index} src="/images/ono.png" onError={event => { event.currentTarget.replaceWith(document.createTextNode("😬")); }} alt="nervous, awkward, or startled" title="Nervous / awkward / startled" style={{ width: "1.6em", height: "1.6em", objectFit: "contain", verticalAlign: "-0.3em", display: "inline-block" }} />
  : part);

function safeWebUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch (_) { return null; }
}

const COY_DESKTOP_APP_ALIASES = {
  'about me': 'About Me', about: 'About Me', profile: 'About Me',
  'winter letter': 'Winter_Letter', winterletter: 'Winter_Letter', letters: 'Winter_Letter',
  poems: 'Poems', poem: 'Poems',
  renderer: 'Renderer', 'roblox renderer': 'Renderer', 'avatar renderer': 'Renderer',
  bloxify: 'Bloxify', 'music ai': 'Bloxify', 'music generator': 'Bloxify',
  paint: 'Paint', 'ms paint': 'Paint',
  minesweeper: 'Minesweeper', 'mine sweeper': 'Minesweeper',
  winamp: 'Winamp', 'music player': 'Winamp',
  coy: 'Coy', 'coy chat': 'Coy',
};

function parseCoyDesktopAction(message) {
  // Accept natural requests ("could you open Renderer for me?") while only
  // executing clear, explicit desktop actions—not ordinary conversation.
  const text = String(message || '').trim()
    .replace(/^(?:hey\s+coy[,! ]*|coy[,! ]*)/i, '')
    .replace(/^(?:(?:please|kindly)\s+|(?:can|could|would|will)\s+you\s+(?:(?:please)\s+)?|i\s+(?:want|need)\s+you\s+to\s+|could\s+i\s+|can\s+i\s+)/i, '')
    .trim();
  const clean = value => String(value || '').trim().replace(/^["']|["']$/g, '').replace(/[.!?]+$/, '').replace(/\s+(?:for me|please|thanks|thank you)$/i, '').trim();
  const appName = value => {
    const normalized = clean(value).toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+(?:app|window)$/i, '').replace(/\s+/g, ' ');
    return COY_DESKTOP_APP_ALIASES[normalized] || null;
  };
  let match = text.match(/^(?:please\s+)?(?:look\s+up|lookup|find)\s+(.+?)\s+in\s+(?:the\s+)?(.+?)[.!?]*$/i);
  if (match) {
    const name = appName(match[2]);
    if (name) return { action: 'search', name, target: 'search', value: clean(match[1]).replace(/^for\s+/i, '') };
  }
  match = text.match(/^(?:please\s+)?(?:search\s+(?:for\s+)?)(.+?)\s+in\s+(?:the\s+)?(.+?)[.!?]*$/i);
  if (match) {
    const name = appName(match[2]);
    if (name) return { action: 'search', name, target: 'search', value: clean(match[1]).replace(/^for\s+/i, '') };
  }
  match = text.match(/^(?:please\s+)?click\s+(?:on\s+)?(?:the\s+)?(.+?)\s+(?:button\s+)?in\s+(?:the\s+)?(.+?)[.!?]*$/i);
  if (match) {
    const name = appName(match[2]);
    if (name) return { action: 'click', name, target: clean(match[1]).replace(/\s+button$/i, '') };
  }
  match = text.match(/^(?:please\s+)?(?:type|enter)\s+(.+?)\s+into\s+(?:the\s+)?(.+?)\s+in\s+(?:the\s+)?(.+?)[.!?]*$/i);
  if (match) {
    const name = appName(match[3]);
    if (name) return { action: 'fill', name, value: clean(match[1]), target: clean(match[2]) };
  }
  match = text.match(/^(?:please\s+)?search\s+(.+?)\s+in\s+(?:the\s+)?(.+?)[.!?]*$/i);
  if (match) {
    const name = appName(match[2]);
    if (name) return { action: 'search', name, target: 'search', value: clean(match[1]) };
  }
  match = text.match(/^(?:please\s+)?press\s+(enter|escape|space|tab)\s+in\s+(?:the\s+)?(.+?)[.!?]*$/i);
  if (match) {
    const name = appName(match[2]);
    if (name) return { action: 'press', name, key: ({ enter: 'Enter', escape: 'Escape', space: ' ', tab: 'Tab' })[match[1].toLowerCase()] };
  }
  match = text.match(/^(?:please\s+)?(play|pause|stop|next|previous)\s+(?:track\s+)?in\s+(?:the\s+)?(winamp|music player)[.!?]*$/i);
  if (match) return { action: 'click', name: 'Winamp', target: match[1].toLowerCase() === 'previous' ? 'previous' : match[1] };
  match = text.match(/^(?:please\s+)?(open|launch|start|show|focus|switch to|maximize|minimize|restore|close|hide)(?:\s+up)?\s+(?:the\s+)?(.+?)[.!?]*$/i);
  if (!match) return null;
  const actionWord = match[1].toLowerCase();
  const target = match[2].trim().toLowerCase()
    .replace(/\s+(?:app|window)$/i, '')
    .replace(/\s+(?:for me|please|thanks|thank you)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  const name = COY_DESKTOP_APP_ALIASES[target];
  if (!name) return null;
  const action = ['launch', 'start'].includes(actionWord) ? 'open'
    : ['show', 'switch to'].includes(actionWord) ? 'focus'
    : actionWord === 'hide' ? 'minimize'
    : actionWord;
  return { action, name };
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
function renderCoyInline(value) {
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

// Discord-style headings: a leading # plus a space enlarges that line.
// Keep normal text and existing link/image rendering unchanged.
function renderCoyContent(value) {
  const lines = String(value ?? '').split('\n');
  return lines.map((line, index) => {
    const heading = line.match(/^#\s+(.+)$/);
    const newline = index < lines.length - 1 ? '\n' : '';
    if (!heading) return <React.Fragment key={index}>{renderCoyInline(line)}{newline}</React.Fragment>;
    return <React.Fragment key={index}><span style={{ fontSize: '1.6em', fontWeight: 'bold' }}>{renderCoyInline(heading[1])}</span>{newline}</React.Fragment>;
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

async function prepareMediaFile(file, mimeType) {
  if (!String(mimeType || '').startsWith('image/')) return { file, mimeType };
  // Send a reasonably small image to vision providers; large base64 screenshots
  // were triggering provider HTTP 413 errors. One decoded frame is enough for analysis.
  try {
    const sourceUrl = await readFileAsDataUrl(file);
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('image decode failed'));
      element.src = sourceUrl;
    });
    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return { file, mimeType };
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (!blob || blob.size >= file.size) return { file, mimeType };
    return { file: new File([blob], (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: file.lastModified }), mimeType: 'image/jpeg' };
  } catch (_) {
    // HEIC and a few iPhone formats cannot be decoded by every browser. Preserve
    // the original bytes so the backend can give a useful provider error instead.
    return { file, mimeType };
  }
}

async function readFileAsDataUrl(file) {
  if (!file || typeof file.size !== 'number' || file.size <= 0) {
    throw new Error('That file is empty or unavailable. Choose it again and retry.');
  }
  const mimeType = file.type || 'application/octet-stream';
  // File.arrayBuffer() is more reliable than FileReader in browsers where a
  // pasted/uploaded File can lose its FileReader event. Keep FileReader as fallback.
  if (typeof file.arrayBuffer === 'function' && typeof btoa === 'function') {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      const chunkSize = 0x8000;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + chunkSize));
      }
      return 'data:' + mimeType + ';base64,' + btoa(binary);
    } catch (_) {
      // Fall through to FileReader for older browser/file implementations.
    }
  }
  return new Promise((resolve, reject) => {
    let reader;
    try {
      reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Couldn’t read "' + (file.name || 'that file') + '". Try selecting it again.'));
      reader.onerror = () => reject(new Error('Couldn’t read "' + (file.name || 'that file') + '". Try selecting it again.'));
      reader.onabort = () => reject(new Error('Reading "' + (file.name || 'that file') + '" was cancelled.'));
      reader.readAsDataURL(file);
    } catch (_) {
      reject(new Error('Couldn’t read "' + (file.name || 'that file') + '". Try selecting it again.'));
    }
  });
}


const styles = {
  root: { height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', background: '#292929', color: '#eee', font: '12px Tahoma, Arial, sans-serif' },
  intro: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'linear-gradient(#444,#303030)', color: '#eee', borderBottom: '1px solid #111', flexShrink: 0 },
  portrait: { width: 58, height: 70, objectFit: 'contain', objectPosition: 'bottom', flexShrink: 0 },
  title: { fontWeight: 'bold', fontSize: 14, marginBottom: 5 },
  subtitle: { lineHeight: 1.45, color: '#ccc' },
  messages: { flex: 1, minHeight: 0, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, background: '#242424' },
  bubble: { position: 'relative', maxWidth: '92%', padding: '8px 10px', border: '6px solid transparent', borderRadius: 0, borderImageSlice: '12 fill', borderImageWidth: '6px', borderImageRepeat: 'stretch', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.45, color: '#fff', textShadow: '0 1px 1px #222' },
  user: { alignSelf: 'flex-end', background: '#6f1717', borderImageSource: `url(${(process.env.PUBLIC_URL || '').replace(/\/$/, '')}/images/roblox-dialog/chatBubble_botRed_bkg.png)`, marginRight: 7 },
  coy: { alignSelf: 'flex-start', background: '#174c19', borderImageSource: `url(${(process.env.PUBLIC_URL || '').replace(/\/$/, '')}/images/roblox-dialog/chatBubble_botGreen_bkg.png)`, marginLeft: 7 },
  form: { display: 'flex', gap: 6, padding: 8, borderTop: '1px solid #111', background: '#333', flexShrink: 0, alignItems: 'flex-end' },
  pendingAttachments: { display: 'flex', flexWrap: 'wrap', gap: 5, padding: '6px 8px', background: '#303030', color: '#eee', borderTop: '1px solid #444' },
  attachmentChip: { display: 'flex', alignItems: 'center', gap: 5, maxWidth: '100%', padding: '4px 6px', border: '1px solid #aaa', background: '#fff', overflowWrap: 'anywhere' },
  input: { flex: 1, minWidth: 0, height: 44, minHeight: 44, maxHeight: 100, boxSizing: 'border-box', resize: 'vertical', border: '1px solid #7f9db9', borderRadius: 0, padding: '7px 8px', font: '16px Tahoma, Arial', background: '#fff', color: '#111' },
  attachButton: { width: 44, height: 44, minWidth: 44, minHeight: 44, flex: '0 0 44px', boxSizing: 'border-box', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, lineHeight: 1 },
  button: { minHeight: 30, padding: '4px 12px', border: '1px solid #777', borderRadius: 0, color: '#eee', font: '12px Tahoma, Arial', background: 'linear-gradient(#555,#333)', cursor: 'pointer' },
  status: { padding: '5px 9px', background: '#303030', color: '#ccc', borderTop: '1px solid #444', fontSize: 10, flexShrink: 0 },
};

export default function CoyChat({ initialImage, initialText }) {
  const [messages, setMessages] = useState(() => {
    const saved = readCoyChatLog();
    // The first greeting is a real assistant message, so it stays in the transcript
    // when the user sends their first message and survives reopening the chat.
    return saved.length ? saved : (initialImage
      ? [{ role: 'assistant', content: 'Hey, wanna use this?', image: initialImage.src }]
      : [{ role: 'assistant', content: randomGreeting() }]);
  });
  const [draft, setDraft] = useState(typeof initialText === 'string' ? initialText : '');
  const [attachments, setAttachments] = useState([]);
  const attachmentsRef = useRef([]);
  const addFilesInProgressRef = useRef(false);
  const fileInputRef = useRef(null);
  const updateAttachments = next => {
    const value = typeof next === 'function' ? next(attachmentsRef.current) : next;
    attachmentsRef.current = value;
    setAttachments(value);
  };
  const [busy, setBusy] = useState(false);
  const sendLockRef = useRef(false);
  const lastSendRef = useRef({ message: '', at: 0 });
  const [error, setError] = useState('');
  const errorTimerRef = useRef(null);
  const showError = (msg) => {
    if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
    errorTimerRef.current = window.setTimeout(() => setError(msg), 600);
  };
  const clearError = () => {
    if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
    setError('');
  };
  const recognitionRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      try { recognitionRef.current?.stop(); } catch (_) {}
    };
  }, []);

  useEffect(() => {
    const onPrefill = event => {
      const text = typeof event.detail?.text === 'string' ? event.detail.text : '';
      setDraft(text);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    };
    window.addEventListener('coy:prefill-chat', onPrefill);
    return () => window.removeEventListener('coy:prefill-chat', onPrefill);
  }, []);


  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, busy, error]);

  useEffect(() => {
    writeCoyChatLog(messages);
  }, [messages]);

  async function addFiles(files) {
    const picked = Array.from(files || []).filter(file => file && typeof file.size === 'number' && typeof file.name === 'string');
    if (!picked.length) return;
    // Collapse duplicate clipboard entries by stable metadata. Clipboard APIs can
    // expose one pasted file as multiple distinct File objects.
    const uniquePicked = [];
    const seenPicked = new Set();
    for (const file of picked) {
      const key = [file.name || '', (file.type || '').toLowerCase(), file.size].join('|');
      if (seenPicked.has(key)) continue;
      seenPicked.add(key);
      uniquePicked.push(file);
    }
    const existingAttachments = attachmentsRef.current;
    const existingKeys = new Set(existingAttachments.map(item => [item.name || '', (item.type || '').toLowerCase(), item.size].join('|')));
    const freshPicked = uniquePicked.filter(file => !existingKeys.has([file.name || '', (file.type || '').toLowerCase(), file.size].join('|')));
    if (!freshPicked.length) return;
    const combined = [...existingAttachments, ...freshPicked];
    if (combined.length > 3) {
      setError('Attach up to 3 files at a time.');
      return;
    }

    const textExtensions = new Set(['txt','md','markdown','csv','tsv','json','jsonl','xml','html','htm','css','js','jsx','ts','tsx','mjs','cjs','py','java','c','h','cpp','hpp','cs','go','rs','php','rb','sql','log','yaml','yml','toml','ini','conf','sh','bash','bat','ps1','diff','patch','env','gitignore']);
    const documentExtensions = new Set(['pdf','docx']);
    const normalized = freshPicked.map(file => {
      const extension = (file.name.split('.').pop() || '').toLowerCase();
      let type = (file.type || '').toLowerCase();
      if (type === 'audio/x-m4a' || type === 'audio/m4a') type = 'audio/mp4';
      if (type === 'audio/x-wav') type = 'audio/wav';
      if (type === 'audio/mp3') type = 'audio/mpeg';
      const isText = textExtensions.has(extension) || type.startsWith('text/') ||
        ['application/json','application/xml','application/javascript','application/x-yaml'].includes(type);
      if (isText) return { file, type: type || 'text/plain', kind: 'text' };
      if (documentExtensions.has(extension)) return { file, type: extension === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kind: 'document' };
      const inferred = ({
        png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp', gif:'image/gif',
        heic:'image/heic', heif:'image/heif', bmp:'image/bmp', tif:'image/tiff', tiff:'image/tiff',
        mp3:'audio/mpeg', m4a:'audio/mp4', mp4:'audio/mp4', wav:'audio/wav', ogg:'audio/ogg',
        opus:'audio/opus', flac:'audio/flac', aac:'audio/aac', aif:'audio/aiff', aiff:'audio/aiff',
      })[extension] || '';
      if (!type || type === 'application/octet-stream') type = inferred;
      if (type === 'image/jpg') type = 'image/jpeg';
      if (type === 'audio/x-m4a' || type === 'audio/m4a') type = 'audio/mp4';
      if (type === 'audio/x-wav') type = 'audio/wav';
      if (type === 'audio/mp3') type = 'audio/mpeg';
      const allowedMediaTypes = new Set([
        'image/png','image/jpeg','image/webp','image/heic','image/heif','image/gif','image/bmp','image/tiff',
        'audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/mp4','audio/m4a','audio/x-m4a',
        'audio/aac','audio/x-aac','audio/ogg','audio/opus','audio/flac','audio/webm','audio/aiff',
        'audio/3gpp','audio/pcm','audio/l16','audio/alaw','audio/mulaw'
      ]);
      return { file, type, kind: allowedMediaTypes.has(type) ? 'media' : 'unsupported' };
    });

    if (normalized.some(item => item.kind === 'unsupported')) {
      setError('That file type isn’t supported yet. Try an image, audio file, PDF, DOCX, or text/code file.');
      return;
    }
    if (combined.some(file => file.size > 8 * 1024 * 1024) || combined.reduce((sum, file) => sum + file.size, 0) > 10 * 1024 * 1024) {
      setError('Keep each file under 8 MB and all attachments under 10 MB total.');
      return;
    }
    const textFiles = normalized.filter(item => item.kind === 'text');
    const existingTextBytes = existingAttachments.reduce((sum, item) => sum + (item.textContent ? new Blob([item.textContent]).size : 0), 0);
    const pickedTextBytes = textFiles.reduce((sum, item) => sum + item.file.size, 0);
    if (textFiles.some(item => item.file.size > 50 * 1024) || existingTextBytes + pickedTextBytes > 80 * 1024) {
      setError('Text/code files must be under 50 KB each and 80 KB total so Coy can read them reliably.');
      return;
    }

    try {
      const loaded = await Promise.all(normalized.map(async item => {
        const file = item.file;
        if (item.kind === 'text') {
          const textContent = await file.text();
          return { name: file.name, type: item.type, size: file.size, kind: 'text', textContent };
        }
        const normalizedFile = item.type && item.type !== file.type
          ? new File([file], file.name, { type: item.type, lastModified: file.lastModified })
          : file;
        const prepared = await prepareMediaFile(normalizedFile, item.type);
        return {
          name: prepared.file.name || file.name,
          type: prepared.mimeType || item.type,
          size: prepared.file.size,
          kind: 'media',
          dataUrl: await readFileAsDataUrl(prepared.file),
        };
      }));
      updateAttachments(previous => {
        const known = new Set(previous.map(item => [item.name || '', (item.type || '').toLowerCase(), item.size].join('|')));
        const merged = [...previous];
        for (const item of loaded) {
          const key = [item.name || '', (item.type || '').toLowerCase(), item.size].join('|');
          if (!known.has(key) && merged.length < 3) {
            known.add(key);
            merged.push(item);
          }
        }
        return merged;
      });
      setError('');
    } catch (err) {
      setError(err.message || 'Couldn’t read that file.');
    }
  }
  async function chooseFiles(event) {
    const picked = Array.from(event.target.files || []);
    event.target.value = '';
    await addFiles(picked);
  }

  async function pasteFiles(event) {
    const clipboard = event.clipboardData;
    if (!clipboard) return;
    // Chromium exposes the same pasted image through both clipboard.files and
    // clipboard.items, but as different File objects. Prefer items and dedupe
    // by stable file metadata instead of object identity.
    const fromItems = Array.from(clipboard.items || [])
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter(Boolean);
    const candidates = fromItems.length ? fromItems : Array.from(clipboard.files || []);
    const seen = new Set();
    const picked = candidates.filter(file => {
      const fingerprint = [file.name || '', file.type || '', file.size, file.lastModified || 0].join('|');
      if (seen.has(fingerprint)) return false;
      seen.add(fingerprint);
      return true;
    });
    if (!picked.length) return;
    event.preventDefault();
    // Ignore overlapping paste events while files are being read.
    if (addFilesInProgressRef.current) return;
    addFilesInProgressRef.current = true;
    try { await addFiles(picked); }
    finally { addFilesInProgressRef.current = false; }
  }


  async function send(event, forcedMessage) {
    event?.preventDefault?.();
    const message = (typeof forcedMessage === 'string' ? forcedMessage : draft).trim();
    const voiceInputTurn = typeof forcedMessage === 'string';
    // Start a call if the typed message asks for one.
    const callRequest = /\b(call|call me|call with me|let'?s call|start a call|can we call|wanna call|want to call|전화|통화|콜)\b/i.test(message);
    const stopRequest = /\b(stop|stop call|end call|hang up|end the call)\b/i.test(message);
    let voiceReply = '';
    // React state updates after this handler returns; use a synchronous lock so
    // Enter + click or rapid repeated events cannot launch duplicate requests.
    if (sendLockRef.current || (!message && !attachmentsRef.current.length) || busy) {
      if (voiceInputTurn) {
        voiceTurnRef.current = false;
}
      return;
    }
    // Ignore accidental rapid re-submits of the same text (e.g. Enter + click or a sticky button).
    const now = Date.now();
    const sendFingerprint = message + '|' + attachmentsRef.current.map(file => [file.name, file.type, file.size].join(':')).join(',');
    if (sendFingerprint && sendFingerprint === lastSendRef.current.message && now - lastSendRef.current.at < 1800) {
      if (voiceInputTurn) {
        voiceTurnRef.current = false;
}
      return;
    }
    lastSendRef.current = { message: sendFingerprint, at: now };
    sendLockRef.current = true;
    // Explicit, standalone desktop commands become real window-manager actions.
    // Ordinary conversation is never interpreted as a command.
    const desktopAction = parseCoyDesktopAction(message);
    if (desktopAction) {
      const appControlAction = ['click', 'fill', 'search', 'press'].includes(desktopAction.action);
      window.dispatchEvent(new CustomEvent(appControlAction ? 'coy:app-action' : 'coy:desktop-action', { detail: desktopAction }));
    }
    const filesToSend = attachmentsRef.current;
    const priorHistory = messages.slice(-16).map(({ role, content }) => ({ role, content }));
    // Remove the pending chips as soon as send starts. If the request fails,
    // put them back so the user can retry without re-attaching.
    updateAttachments([]);
    setMessages(previous => [...previous, {
      role: 'user',
      content: message,
      attachments: filesToSend.map(({ name, type, dataUrl, textContent }) => ({ name, type, dataUrl, textContent })),
    }].slice(-100));
    setDraft('');
    setBusy(true);
    setError('');
    try {
      // Fetch the authoritative total only when the message asks about the visitor count.
      let liveVisitorCount = null;
      if (/\b(visitor|visitors|visit|visits|counter|traffic)\b/i.test(message) && /\b(how many|how much|total|count|number|many people|visitor count|visitors?)\b/i.test(message)) {
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
              ...(file.textContent !== undefined ? { text: file.textContent } : { data: (file.dataUrl || '').split(',')[1] || '' }),
            })),
            websiteContext: {
              desktopApps: Array.from(document.querySelectorAll('[data-app-title]'))
                .map(node => node.getAttribute('data-app-title')).filter(Boolean),
              ...(desktopAction ? { requestedDesktopAction: desktopAction } : {}),
              ...(liveVisitorCount !== null ? { totalVisitorCount: liveVisitorCount } : {}),
            },
          }),
        });
      } finally {
        window.clearTimeout(timeout);
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'I’m tryna sleep dude.');
      const rawAnswer = typeof data.answer === 'string' && data.answer.trim() ? data.answer.trim() : '…';
      const answer = removeUnwantedCoyEmojis(rawAnswer);
      if (voiceInputTurn) voiceReply = answer;
      // Only deliberate blank-line-separated messages become separate bubbles.
      // Hard-cap each response at three bubbles to prevent accidental mass-sends;
      // any extra paragraphs are combined into the third bubble.
      const parts = answer
        .split(/\n\s*\n+/)
        .map(content => content.trim().replace(/^(?:(?:Coy|Cotto|Assistant|AI|You|User)\s*:\s*)+/i, '').replace(/(^|\n)\s*(?:(?:Coy|Cotto|Assistant|AI|You|User)\s*:\s*)+/gi, '$1'))
        .filter(Boolean);
      const boundedParts = parts.length > 3
        ? [...parts.slice(0, 2), parts.slice(2).join('\n\n')]
        : parts;
      const replyMessages = boundedParts.map(content => ({ role: 'assistant', content }));
      setMessages(previous => {
        // Avoid rendering a repeated response if a duplicate request or stale callback slips through.
        const tail = previous.slice(-replyMessages.length);
        const alreadyAppended = replyMessages.length > 0 && tail.length === replyMessages.length &&
          tail.every((item, index) => item.role === 'assistant' && item.content === replyMessages[index].content);
        return alreadyAppended ? previous : [...previous, ...replyMessages].slice(-100);
      });
    } catch (err) {
      if (filesToSend.length) updateAttachments(previous => previous.length ? previous : filesToSend);
      if (message) setDraft(previous => previous || message);
      // Safari often reports network/CORS failures as "Load failed" rather than
      // "Failed to fetch". Keep the message conversational; the green Coy bubble
      // makes clear that this is Coy's connection error, not a user message.
      const networkFailure = err.name === 'AbortError' ||
        /^(?:failed to fetch|load failed|network request failed)$/i.test(String(err.message || '').trim());
      setError(networkFailure
        ? 'Can’t reach the chat server rn.. sowwy. Try again in a moment.'
        : (err.message || 'Something went wrong.. sowwy'));
    } finally {
      sendLockRef.current = false;
      setBusy(false);
      if (voiceInputTurn) {
        voiceTurnRef.current = false;
      }
    }
  }

  return (
    <div style={styles.root} data-coy-chat-window="true">
      <div style={styles.messages} aria-live="polite">
        {messages.map((item, index) => (
          <div key={index} style={{ ...styles.bubble, ...(item.role === 'user' ? styles.user : styles.coy) }}>
            <img aria-hidden="true" alt="" src={(process.env.PUBLIC_URL || '').replace(/\/$/, '') + '/images/roblox-dialog/' + (item.role === 'user' ? 'chatBubble_botRed_tailRight.png' : 'chatBubble_botGreen_tailRight.png')} style={{ position: 'absolute', bottom: 1, ...(item.role === 'user' ? { right: -18 } : { left: -18, transform: 'scaleX(-1)' }), width: 22, height: 22, objectFit: 'contain', pointerEvents: 'none' }} />
            {item.content && renderCoyContent(item.content)}
            {Array.isArray(item.attachments) && item.attachments.map((attachment, attachmentIndex) => <div key={attachmentIndex} style={{ marginTop: 7 }}>
              {attachment.dataUrl && attachment.type?.startsWith('image/') && <img src={attachment.dataUrl} alt={attachment.name || 'Uploaded image'} style={{ display: 'block', maxWidth: '100%', maxHeight: 260, objectFit: 'contain', border: '1px solid #ccc', marginBottom: 4 }} />}
              {attachment.textContent !== undefined && <pre style={{ margin: '5px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 260, overflow: 'auto', font: '11px Consolas, monospace' }}>{attachment.textContent.slice(0, 12000)}{attachment.textContent.length > 12000 ? '\n… preview truncated' : ''}</pre>}
              {attachment.dataUrl && attachment.type?.startsWith('audio/') && <audio controls preload="metadata" src={attachment.dataUrl} style={{ display: 'block', maxWidth: '100%', width: 280 }} />}
              <span style={{ fontSize: 11, color: '#444' }}>📎 {attachment.name || 'Attachment'}</span>
            </div>)}
            {item.image && <img src={item.image} alt="Image Coy found on the site" style={{ display: 'block', maxWidth: '100%', maxHeight: 220, marginTop: 7, objectFit: 'contain' }} />}
          </div>
        ))}
        {busy && <div style={{ ...styles.bubble, ...styles.coy }}>
          <img aria-hidden="true" alt="" src={(process.env.PUBLIC_URL || '').replace(/\/$/, '') + '/images/roblox-dialog/chatBubble_botGreen_tailRight.png'} style={{ position: 'absolute', bottom: 1, left: -18, transform: 'scaleX(-1)', width: 22, height: 22, objectFit: 'contain', pointerEvents: 'none' }} />
          Typing...
        </div>}
        {error && <div role="alert" style={{ ...styles.bubble, ...styles.coy, color: '#fff' }}>
          <img aria-hidden="true" alt="" src={(process.env.PUBLIC_URL || '').replace(/\/$/, '') + '/images/roblox-dialog/chatBubble_botGreen_tailRight.png'} style={{ position: 'absolute', bottom: 1, left: -18, transform: 'scaleX(-1)', width: 22, height: 22, objectFit: 'contain', pointerEvents: 'none' }} />
          {error}
        </div>}
        <div ref={bottomRef} />
      </div>
      {attachments.length > 0 && <div style={styles.pendingAttachments} aria-label="Files ready to send">
        {attachments.map((file, index) => <div key={index} style={styles.attachmentChip}>
          <span>{file.type.startsWith('image/') ? '🖼️' : file.type.startsWith('audio/') ? '🔊' : '📄'} {file.name}</span>
          <button type="button" style={{ ...styles.button, minHeight: 22, padding: '1px 5px' }} aria-label={'Remove ' + file.name} onClick={() => updateAttachments(previous => previous.filter((_, i) => i !== index))}>×</button>
        </div>)}
      </div>}
      <form style={styles.form} onSubmit={send}>
        <input ref={fileInputRef} type="file" accept="image/*,audio/*,.heic,.heif,.m4a,.mp3,.wav,.ogg,.flac,.aac,.opus,.pdf,.docx,.txt,.md,.markdown,.csv,.tsv,.json,.jsonl,.xml,.html,.htm,.css,.js,.jsx,.ts,.tsx,.mjs,.cjs,.py,.java,.c,.h,.cpp,.hpp,.cs,.go,.rs,.php,.rb,.sql,.log,.yaml,.yml,.toml,.ini,.conf,.sh,.bash,.bat,.ps1,.diff,.patch,.env,.gitignore" multiple onChange={chooseFiles} disabled={busy} style={{ display: 'none' }} />
        <button type="button" style={{ ...styles.button, ...styles.attachButton }} onClick={() => fileInputRef.current?.click()} disabled={busy || attachments.length >= 3} aria-label="Attach a file" title="Attach images, audio, text, or code">+</button>
        <textarea
          ref={inputRef}
          aria-label="Message Coy"
          rows={2}
          maxLength={2000}
          placeholder="say something..."
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onPaste={pasteFiles}
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(event); } }}
          style={styles.input}
          disabled={busy}
        />
        <button type="submit" aria-label="Send message" title="Send message" style={{ ...styles.button, ...styles.attachButton, fontSize: 24, opacity: busy || (!draft.trim() && !attachments.length) ? 0.65 : 1 }} disabled={busy || (!draft.trim() && !attachments.length)}>{busy ? '…' : '>'}</button>
      </form>
    </div>
  );
}
