import React, { useEffect, useRef, useState } from 'react';

const API_BASE = process.env.REACT_APP_API_BASE || 'https://winxp-7yes.onrender.com';
const IDLE_LINES = [
  'psst. you look busy :3',
  'i live here now btw',
  'have you had water today? or are we being mysterious again',
  'the desktop is quiet... suspiciously quiet.',
  'i have a joke. it is probably a terrible one.',
  'click me if you want to talk. or don’t. i’ll simply haunt this corner.',
  'status: silly',
];

// Replace these named slots with transparent OC sprites as they are drawn.
const SPRITE_ACTIONS = [
  { id: 'idle', label: 'Idle / neutral', mood: 'happy', line: 'just standing here. existing. :3' },
  { id: 'wave', label: 'Wave hello', mood: 'happy', line: 'oh hi!! you noticed me :3' },
  { id: 'laugh', label: 'Laughing', mood: 'mischief', line: 'LMAOOO okay wait' },
  { id: 'annoyed', label: 'Annoyed / deadpan', mood: 'mischief', line: 'i am judging you a normal amount.' },
  { id: 'sleep', label: 'Sleepy', mood: 'sleepy', line: 'five more minutes...' },
  { id: 'think', label: 'Thinking', mood: 'happy', line: 'hold on. brain loading...' },
  { id: 'surprised', label: 'Surprised', mood: 'happy', line: 'HUH??' },
  { id: 'talking', label: 'Talking', mood: 'talking', line: 'mhm mhm. i am saying words.' },
  { id: 'smug', label: 'Smug', mood: 'smug', line: 'i know something you don’t. probably.' },
  { id: 'embarrassed', label: 'Embarrassed', mood: 'embarrassed', line: 'w-wait. don’t look at me.' },
  { id: 'petting', label: 'Petting', mood: 'petting', line: '...okay that is actually nice.' },
  { id: 'flustered', label: 'Flustered petting', mood: 'flustered', line: 'i am NOT blushing. shut up.' },
  { id: 'sleeping', label: 'Sleeping', mood: 'sleeping', line: 'zzz...' },
  { id: 'cute', label: 'Cute pose / :3', mood: 'cute', line: 'behold. the creature.' },
];

const styles = {
  root: {
    position: 'fixed', right: 18, bottom: 42, zIndex: 10000,
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
    gap: 9, fontFamily: 'Tahoma, Arial, sans-serif', color: '#17243a',
    pointerEvents: 'none',
  },
  characterButton: {
    pointerEvents: 'auto', width: 104, height: 126, border: 0, padding: 0,
    background: 'transparent', cursor: 'pointer', filter: 'drop-shadow(0 5px 5px rgba(0,0,0,.2))',
    animation: 'coy-float 3.6s ease-in-out infinite', touchAction: 'manipulation',
  },
  bubble: {
    pointerEvents: 'auto', maxWidth: 250, padding: '9px 13px',
    border: '2px solid #555b63', borderRadius: 15, background: '#fff', color: '#202124',
    boxShadow: '1px 2px 0 rgba(0,0,0,.18)', fontSize: 12, lineHeight: 1.45,
    position: 'relative', cursor: 'pointer', textAlign: 'left', overflowWrap: 'anywhere',
  },
  panel: {
    pointerEvents: 'auto', width: 'min(340px, calc(100vw - 24px))',
    height: 'min(430px, calc(100dvh - 205px))', minHeight: 260,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    border: '2px solid #245edb', borderRadius: 9,
    background: '#f5f4e9', boxShadow: '0 12px 35px rgba(0,0,0,.35)',
  },
  titlebar: {
    display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px',
    color: '#fff', fontSize: 12, fontWeight: 'bold',
    background: 'linear-gradient(90deg,#0058e6,#3b9bff 55%,#0056df)',
  },
  close: {
    marginLeft: 'auto', border: '1px solid #fff8', borderRadius: 4,
    background: 'linear-gradient(#ffaaa0,#df3825)', color: '#fff',
    width: 23, height: 21, fontWeight: 'bold', cursor: 'pointer',
  },
  transcript: {
    flex: 1, minHeight: 0, overflowY: 'auto', padding: 10,
    display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12,
  },
  message: {
    maxWidth: '90%', padding: '8px 9px', border: '1px solid #c5cbd4',
    borderRadius: 8, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.45,
  },
  form: {
    display: 'flex', gap: 6, padding: 8, borderTop: '1px solid #c6c6bc',
    background: '#ece9d8',
  },
  input: {
    flex: 1, minWidth: 0, resize: 'none', border: '1px solid #7f9db9',
    borderRadius: 4, padding: 8, font: '12px Tahoma, Arial', background: '#fff',
  },
  send: {
    border: '1px solid #245edb', borderRadius: 4, padding: '0 12px',
    color: '#fff', background: 'linear-gradient(#4b91ff,#0754d8)',
    font: 'bold 12px Tahoma, Arial', cursor: 'pointer',
  },
};

function CoyGhost({ mood = 'happy' }) {
  const eyes = mood === 'sleepy'
    ? <><path d="M35 51q5 4 10 0" /><path d="M62 51q5 4 10 0" /></>
    : mood === 'mischief'
    ? <><path d="M34 48l11 3" /><path d="M62 51l11 -3" /><circle cx="41" cy="52" r="2.4" fill="#28334e" stroke="none" /><circle cx="67" cy="52" r="2.4" fill="#28334e" stroke="none" /></>
    : <><ellipse cx="41" cy="51" rx="4.4" ry="6.5" fill="#28334e" stroke="none" /><ellipse cx="67" cy="51" rx="4.4" ry="6.5" fill="#28334e" stroke="none" /><circle cx="42.5" cy="49" r="1.7" fill="#fff" stroke="none" /><circle cx="68.5" cy="49" r="1.7" fill="#fff" stroke="none" /></>;
  return (
    <svg viewBox="0 0 104 126" width="100%" height="100%" role="img" aria-label="Coy, your little website ghost">
      <defs>
        <linearGradient id="coy-hair" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c9e6ff" />
          <stop offset="1" stopColor="#7da6e8" />
        </linearGradient>
        <linearGradient id="coy-body" x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#fffefa" />
          <stop offset="1" stopColor="#d9e8ff" />
        </linearGradient>
      </defs>
      <ellipse cx="52" cy="116" rx="24" ry="5" fill="#1a2946" opacity=".2" />
      <path d="M20 61C15 38 26 18 49 15C69 12 85 28 84 48L81 78C78 88 72 91 66 84C59 96 52 91 48 84C40 95 31 89 29 81C22 85 16 76 20 61Z" fill="url(#coy-body)" stroke="#557bb5" strokeWidth="2" />
      <path d="M21 50C13 26 32 8 52 12C69 7 88 24 82 45L76 38L70 25L62 37L53 22L42 37L32 30L28 50Z" fill="url(#coy-hair)" stroke="#557bb5" strokeWidth="2" strokeLinejoin="round" />
      <path d="M28 29Q22 42 28 56M72 28Q81 40 76 54" fill="none" stroke="#557bb5" strokeWidth="2" strokeLinecap="round" />
      <path d="M31 43Q41 39 48 44M60 44Q68 39 76 43" fill="none" stroke="#557bb5" strokeWidth="2" strokeLinecap="round" />
      {eyes}
      <path d={mood === 'mischief' ? 'M48 64Q56 72 66 62' : 'M47 63Q54 69 61 63'} fill="none" stroke="#b95d83" strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="31" cy="61" rx="6" ry="3" fill="#f5a6bf" opacity=".65" />
      <ellipse cx="76" cy="61" rx="6" ry="3" fill="#f5a6bf" opacity=".65" />
      <path d="M16 74Q8 68 11 61M87 69Q97 65 94 56" fill="none" stroke="#7197d1" strokeWidth="2" strokeLinecap="round" />
      <path d="M75 14l2 -5 2 5 5 2 -5 2 -2 5 -2 -5 -5 -2Z" fill="#ffe38b" stroke="#c89b40" strokeWidth=".8" />
      <text x="78" y="104" fontSize="12" fill="#4e7bc2" fontWeight="bold">:3</text>
    </svg>
  );
}

export default function CoyCompanion() {
  const [open, setOpen] = useState(false);
  const [bubble, setBubble] = useState('psst... hi :3');
  const [mood, setMood] = useState('happy');
  const [poseMenu, setPoseMenu] = useState(false);
  const [spriteAction, setSpriteAction] = useState('idle');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'haiii :3 i’m Coy, your tiny desktop ghost. click me whenever you wanna chat.' },
  ]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (open) return;
      const line = IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)];
      setBubble(line);
      setMood(Math.random() > 0.65 ? 'mischief' : 'happy');
    }, 36000);
    return () => window.clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, open, busy]);

  async function send(event) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    const history = messages.slice(-16).map(({ role, content }) => ({ role, content }));
    setMessages(previous => [...previous, { role: 'user', content: message }]);
    setDraft('');
    setBusy(true);
    setError('');
    setMood('mischief');
    try {
      const response = await fetch(API_BASE + '/personal-ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ message, history }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not send that message.');
      const answer = typeof data.answer === 'string' && data.answer.trim()
        ? data.answer : '...my brain did a tiny Windows error noise. try again?';
      setMessages(previous => [...previous, { role: 'assistant', content: answer }]);
      setBubble(answer.length > 75 ? answer.slice(0, 72) + '…' : answer);
      setMood('happy');
    } catch (err) {
      setError(err.message || 'Could not connect to CoyBot right now.');
      setMood('sleepy');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes coy-float { 0%,100% { transform: translateY(0) rotate(-1deg); } 50% { transform: translateY(-7px) rotate(1deg); } }
        @keyframes coy-pop { from { opacity: 0; transform: translateY(7px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @media (max-width: 480px) { .coy-companion-root { right: 8px !important; bottom: 38px !important; } .coy-companion-character { width: 82px !important; height: 101px !important; } }
        @media (prefers-reduced-motion: reduce) { .coy-companion-character { animation: none !important; } }
      `}</style>
      <div className="coy-companion-root" style={styles.root}>
        {open && (
          <section style={{ ...styles.panel, animation: 'coy-pop .16s ease-out' }} aria-label="Chat with Coy">
            <div style={styles.titlebar}>
              <span aria-hidden="true">✦</span>
              <span>Coy.exe (but just a website :3)</span>
              <button type="button" style={styles.close} onClick={() => setOpen(false)} aria-label="Close chat">×</button>
            </div>
            <div style={styles.transcript} aria-live="polite">
              {messages.map((item, index) => (
                <div key={index} style={{ ...styles.message, alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start', background: item.role === 'user' ? '#e4efff' : '#fffdf7' }}>
                  <strong>{item.role === 'user' ? 'you' : 'coy'}:</strong>{' '}{item.content}
                </div>
              ))}
              {busy && <div style={{ ...styles.message, background: '#fffdf7' }}>thinking… :3</div>}
              <div ref={bottomRef} />
            </div>
            {error && <div role="alert" style={{ padding: '7px 10px', color: '#a00000', fontSize: 11 }}>{error}</div>}
            <form style={styles.form} onSubmit={send}>
              <textarea
                aria-label="Message Coy"
                rows={2}
                maxLength={2000}
                placeholder="say something... :3"
                value={draft}
                onChange={event => setDraft(event.target.value)}
                onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(event); } }}
                style={styles.input}
                disabled={busy}
              />
              <button type="submit" disabled={busy || !draft.trim()} style={{ ...styles.send, opacity: busy || !draft.trim() ? .6 : 1 }}>Send</button>
            </form>
            <div style={{ padding: '5px 9px 7px', fontSize: 10, color: '#626262', background: '#ece9d8' }}>Don’t share passwords or private information. Chats aren’t saved between visits.</div>
          </section>
        )}
        {poseMenu && (
          <div role="menu" aria-label="Coy sprite placeholder actions" style={{
            pointerEvents: 'auto', width: 205, padding: 7, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5,
            background: '#fffdf5', border: '2px solid #5276ad', borderRadius: 8, boxShadow: '2px 3px 0 rgba(18,49,102,.25)',
          }}>
            <div style={{ gridColumn: '1 / -1', fontSize: 10, color: '#52617a', padding: '2px 3px' }}>
              14 EXPRESSIONS · right-click Coy to open
            </div>
            {SPRITE_ACTIONS.map(action => (
              <button key={action.id} type="button" role="menuitem" onClick={() => {
                setSpriteAction(action.id);
                setMood(action.mood);
                setBubble(action.line);
                setPoseMenu(false);
              }} style={{
                padding: '6px 5px', fontSize: 10, textAlign: 'left', cursor: 'pointer',
                border: action.id === spriteAction ? '1px solid #245edb' : '1px solid #c5cbd4',
                borderRadius: 4, background: action.id === spriteAction ? '#e4efff' : '#fff',
              }}>{action.label}</button>
            ))}
          </div>
        )}
        {!open && (
          <button
            type="button"
            style={styles.bubble}
            onClick={() => setOpen(true)}
            aria-label="Open a chat with Coy"
          >
            {bubble}
            <span style={{ position: 'absolute', right: 25, bottom: -7, width: 11, height: 11, background: '#fff', borderRight: '2px solid #555b63', borderBottom: '2px solid #555b63', transform: 'rotate(45deg)' }} />
          </button>
        )}
        <button
          type="button"
          className="coy-companion-character"
          style={styles.characterButton}
          onContextMenu={event => { event.preventDefault(); setPoseMenu(value => !value); }}
          onClick={() => { setPoseMenu(false); setOpen(value => !value); setBubble('hehe hi :3'); }}
          aria-label={open ? 'Hide Coy chat' : 'Talk to Coy'}
          title="Click to chat · double-click to pet · right-click for expressions"
        >
          <CoyGhost mood={mood} />
        </button>
      </div>
    </>
  );
}
