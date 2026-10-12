import React, { useEffect, useRef, useState } from "react";

const API_BASE = (process.env.REACT_APP_API_BASE || "https://backend-z081.onrender.com").replace(/\/$/, "");

const styles = {
  shell: { height: "100%", minHeight: 360, display: "flex", flexDirection: "column", background: "#f4f4f4", color: "#111", fontFamily: "Tahoma, Arial, sans-serif", fontSize: 12 },
  page: { height: "100dvh", minHeight: 420, boxSizing: "border-box", padding: "clamp(0px, 3vw, 28px)", background: "linear-gradient(145deg, #dbe9ff 0%, #f5f7fc 52%, #e8efff 100%)", color: "#111", fontFamily: "Tahoma, Arial, sans-serif" },
  standaloneShell: { width: "100%", maxWidth: 920, height: "100%", minHeight: 360, margin: "0 auto", display: "flex", flexDirection: "column", overflow: "hidden", background: "#f4f4f4", color: "#111", border: "1px solid #8ba7cf", borderRadius: 8, boxShadow: "0 16px 48px rgba(28, 54, 94, .18)", fontFamily: "Tahoma, Arial, sans-serif", fontSize: 13 },
  intro: { padding: "18px 20px", background: "linear-gradient(100deg,#fff,#eaf2ff)", borderBottom: "1px solid #b7c9e2" },
  title: { fontWeight: "bold", fontSize: 19, marginBottom: 7, color: "#153e79" },
  subtitle: { lineHeight: 1.55, color: "#34445d" },
  messages: { flex: 1, minHeight: 120, overflowY: "auto", padding: "18px clamp(12px, 3vw, 26px)", display: "flex", flexDirection: "column", gap: 12 },
  bubble: { maxWidth: "88%", padding: "11px 13px", border: "1px solid #c8c8c8", borderRadius: 8, whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.6 },
  user: { alignSelf: "flex-end", background: "#e3edff", borderColor: "#9db9e7" },
  bot: { alignSelf: "flex-start", background: "#fff" },
  form: { display: "flex", gap: 8, padding: 12, borderTop: "1px solid #b8b8b8", background: "#ece9d8" },
  input: { flex: 1, minWidth: 0, resize: "none", border: "1px solid #7f9db9", borderRadius: 5, padding: 12, font: "14px Tahoma, Arial", background: "#fff", outlineColor: "#2c6bd9" },
  button: { padding: "0 18px", minHeight: 42, border: "1px solid #245edb", borderRadius: 5, color: "#fff", font: "bold 13px Tahoma, Arial", background: "linear-gradient(#4b91ff,#0754d8)", cursor: "pointer" },
  note: { fontSize: 10, color: "#555", padding: "9px 14px 12px", background: "#ece9d8", lineHeight: 1.5 },
};

export default function PersonalAI({ standalone = false }) {
  const STORAGE_KEY = "bagof-fish-personal-ai-chat-v1";
  const [messages, setMessages] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.slice(-100) : [];
    } catch {
      return [];
    }
  });
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-100))); } catch (e) {}
  }, [messages]);

  useEffect(() => {
    if (!standalone) return undefined;
    const oldTitle = document.title;
    document.title = "Coy";
    return () => { document.title = oldTitle; };
  }, [standalone]);

  async function send(event) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    const history = messages.slice(-16).map(({ role, content }) => ({ role, content }));
    setMessages(previous => [...previous, { role: "user", content: message }]);
    setDraft("");
    setBusy(true);
    setError("");
    try {
      const response = await fetch(API_BASE + "/personal-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ message, history: history.slice(-16) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "couldn't send that just now.");
      setMessages(previous => [...previous, { role: "assistant", content: data.answer }]);
    } catch (err) {
      setError("");
      setMessages(previous => [...previous, { role: "assistant", content: "Busy rn.. Hold on" }]);
    } finally {
      setBusy(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 0);
    }
  }

  const content = (
    <div style={standalone ? styles.standaloneShell : styles.shell}>
      <div style={styles.intro}>
        <div style={styles.title}>Coy</div>
      </div>
      <div style={styles.messages} aria-live="polite">
        {messages.map((item, index) => (
          <div key={index} style={{ ...styles.bubble, ...(item.role === "user" ? styles.user : styles.bot) }}>
            <strong>{item.role === "user" ? "you" : "coy"}:</strong>{" "}{item.content}
          </div>
        ))}
        {busy && <div style={{ ...styles.bubble, ...styles.bot }}>Thinking…</div>}
        <div ref={bottomRef} />
      </div>
      <form style={styles.form} onSubmit={send}>
        <textarea
          aria-label="Message"
          rows={2}
          maxLength={2000}
          placeholder="Type a message..."
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(event); } }}
          style={styles.input}
          disabled={busy}
        />
        <button type="submit" disabled={busy || !draft.trim()} style={{ ...styles.button, opacity: busy || !draft.trim() ? 0.65 : 1 }}>
          {busy ? "..." : "Send"}
        </button>
      </form>
      <div style={styles.note}>Don’t share passwords or private information. Your chat is saved on this device and stays here when you close Coy or this browser tab.</div>
    </div>
  );

  return standalone ? <main style={styles.page}>{content}</main> : content;
}
