import React, { useEffect, useRef, useState } from 'react';

const API_BASE = (process.env.REACT_APP_API_BASE || 'https://bloxify-backend-sg.onrender.com').replace(/\/$/, '');

const styles = {
  root: { height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', background: '#ece9d8', color: '#111', font: '12px Tahoma, Arial, sans-serif' },
  intro: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'linear-gradient(#fff,#e7e4d6)', borderBottom: '1px solid #9b9b9b', flexShrink: 0 },
  closeButton: { marginLeft: 'auto', alignSelf: 'flex-start', width: 24, height: 22, padding: 0, border: '1px solid #003c74', borderRadius: 2, background: 'linear-gradient(#fff,#e1e1e1)', color: '#111', font: 'bold 15px Tahoma, Arial', lineHeight: '18px', cursor: 'pointer' },
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
  const [messages, setMessages] = useState(() => initialImage
    ? [{ role: 'assistant', content: 'look what i found:', image: initialImage.src }]
    : []);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onOutsidePointer = event => {
      const root = rootRef.current;
      if (!root) return;
      const windowElement = root.closest('.app__content')?.parentElement;
      if (windowElement?.contains(event.target)) return;
      if (event.target?.closest?.('[data-coy-ui]')) return;
      window.dispatchEvent(new CustomEvent('coy:close-chat'));
    };
    document.addEventListener('pointerdown', onOutsidePointer);
    return () => document.removeEventListener('pointerdown', onOutsidePointer);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, busy, error]);

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
    <div ref={rootRef} style={styles.root} data-coy-chat-window="true">
      <div style={styles.intro}>
        <img src={(process.env.PUBLIC_URL || '').replace(/\/$/, '') + '/images/coy.png'} alt="Coy" style={styles.portrait} />
        <div>
          <div style={styles.title}>Coy</div>
        </div>
        <button type="button" aria-label="Close Coy chat" title="Close" style={styles.closeButton} onClick={() => window.dispatchEvent(new CustomEvent('coy:close-chat'))}>×</button>
      </div>
      <div style={styles.messages} aria-live="polite">
        {!messages.length && <div style={{ ...styles.bubble, ...styles.coy }}><strong>Coy:</strong> hey. click the textbox and say something. im listening (probably)</div>}
        {messages.map((item, index) => (
          <div key={index} style={{ ...styles.bubble, ...(item.role === 'user' ? styles.user : styles.coy) }}>
            <strong>{item.role === 'user' ? 'You' : 'Coy'}:</strong>{' '}{item.content}
            {item.image && <img src={item.image} alt="Image Coy found on the site" style={{ display: 'block', maxWidth: '100%', maxHeight: 220, marginTop: 7, objectFit: 'contain' }} />}
          </div>
        ))}
        {busy && <div style={{ ...styles.bubble, ...styles.coy }}>typing…</div>}
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
      <div style={styles.status}>Coy stays on the desktop even when this window is closed.</div>
    </div>
  );
}
