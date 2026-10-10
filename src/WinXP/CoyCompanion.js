import React, { useEffect, useRef, useState } from "react";

const API_BASE = process.env.REACT_APP_API_BASE || "https://winxp-7yes.onrender.com";
const EXPRESSIONS = [
  ["Normal", "Just hanging out."],
  ["Slightly happy", "oh, hi."],
  ["Annoyed", "im judging u a normal amount"],
  ["Sleepy", "five more minutes…"],
  ["Surprised", "WAIT WHAT"],
  ["Smug", "i know something u dont"],
  ["Embarrassed", "dont look at me"],
  ["Thinking", "hold on. thinking."],
  ["Waving", "heyy"],
  ["Cute pose", "behold. the creature."]
];

const styles = {
  root: { position: "fixed", right: 14, bottom: 18, zIndex: 10000, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, fontFamily: "Tahoma, Arial, sans-serif", pointerEvents: "none" },
  imageButton: { pointerEvents: "auto", display: "block", border: 0, padding: 0, background: "transparent", cursor: "pointer", width: "min(42vw, 280px)", maxWidth: 280, maxHeight: "62vh", touchAction: "manipulation" },
  image: { display: "block", width: "100%", height: "auto", maxHeight: "62vh", objectFit: "contain", objectPosition: "bottom", filter: "drop-shadow(0 2px 2px rgba(0,0,0,.22))" },
  bubble: { position: "relative", boxSizing: "border-box", width: "100%", padding: "10px 12px", border: "2px solid #222", borderRadius: 12, background: "#fff", color: "#111", boxShadow: "0 2px 0 rgba(0,0,0,.12)", fontSize: 13, lineHeight: 1.35, overflowWrap: "anywhere", whiteSpace: "pre-wrap" },
  panel: { pointerEvents: "auto", width: "min(360px, calc(100vw - 24px))", height: "min(440px, calc(100dvh - 170px))", minHeight: 260, display: "flex", flexDirection: "column", overflow: "hidden", border: "2px solid #245edb", borderRadius: 9, background: "#f5f4e9", color: "#17243a", boxShadow: "0 12px 35px rgba(0,0,0,.35)" },
  titlebar: { display: "flex", alignItems: "center", gap: 7, padding: "8px 10px", color: "#fff", fontSize: 12, fontWeight: "bold", background: "linear-gradient(90deg,#0058e6,#3b9bff 55%,#0056df)" },
  close: { marginLeft: "auto", border: "1px solid #fff8", borderRadius: 4, background: "linear-gradient(#ffaaa0,#df3825)", color: "#fff", width: 23, height: 21, fontWeight: "bold", cursor: "pointer" },
  transcript: { flex: 1, minHeight: 0, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8, fontSize: 12 },
  message: { maxWidth: "90%", padding: "8px 9px", border: "1px solid #c5cbd4", borderRadius: 8, whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.45 },
  form: { display: "flex", gap: 6, padding: 8, borderTop: "1px solid #c6c6bc", background: "#ece9d8" },
  input: { flex: 1, minWidth: 0, resize: "none", border: "1px solid #7f9db9", borderRadius: 4, padding: 8, font: "12px Tahoma, Arial", background: "#fff", color: "#111" },
  send: { border: "1px solid #245edb", borderRadius: 4, padding: "0 12px", color: "#fff", background: "linear-gradient(#4b91ff,#0754d8)", font: "bold 12px Tahoma, Arial", cursor: "pointer" },
  menu: { pointerEvents: "auto", maxWidth: 240, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, padding: 7, background: "#fff", border: "2px solid #222", borderRadius: 7, boxShadow: "2px 3px 0 rgba(0,0,0,.18)" }
};

export default function CoyCompanion() {
  const [open, setOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [bubble, setBubble] = useState("hey. click me if u wanna talk");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "hey!! i'm Coy. click me whenever u wanna talk." }
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, open, busy]);

  async function send(event) {
    event?.preventDefault();
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
        body: JSON.stringify({ message, history })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Couldn't reach Coy right now.");
      const answer = typeof data.answer === "string" && data.answer.trim() ? data.answer.trim() : "…";
      setMessages(previous => [...previous, { role: "assistant", content: answer }]);
      setBubble(answer.length > 100 ? answer.slice(0, 97) + "…" : answer);
    } catch (err) {
      setError(err.message || "Connection failed");
      setMessages(previous => [...previous, { role: "assistant", content: "i can't connect right now. try again in a bit" }]);
    } finally {
      setBusy(false);
    }
  }

  return <div style={styles.root}>
    {open && <section style={styles.panel} aria-label="Chat with Coy">
      <div style={styles.titlebar}>
        <span aria-hidden="true">✦</span>
        <span>Coy</span>
        <button type="button" style={styles.close} onClick={() => setOpen(false)} aria-label="Close chat">×</button>
      </div>
      <div style={styles.transcript} aria-live="polite">
        {messages.map((item, index) => <div key={index} style={{ ...styles.message, alignSelf: item.role === "user" ? "flex-end" : "flex-start", background: item.role === "user" ? "#e4efff" : "#fffdf7" }}>
          <strong>{item.role === "user" ? "you" : "coy"}:</strong>{" "}{item.content}
        </div>)}
        {busy && <div style={{ ...styles.message, background: "#fffdf7" }}>typing…</div>}
        <div ref={bottomRef} />
      </div>
      {error && <div role="alert" style={{ padding: "7px 10px", color: "#a00000", fontSize: 11 }}>{error}</div>}
      <form style={styles.form} onSubmit={send}>
        <textarea ref={inputRef} aria-label="Message Coy" rows={2} maxLength={2000} placeholder="say something..." value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(event); } }} style={styles.input} disabled={busy} />
        <button type="submit" disabled={busy || !draft.trim()} style={{ ...styles.send, opacity: busy || !draft.trim() ? .6 : 1 }}>{busy ? "…" : "Send"}</button>
      </form>
      <div style={{ padding: "5px 9px 7px", fontSize: 10, color: "#626262", background: "#ece9d8" }}>Your chat is kept for this visit only.</div>
    </section>}
    {!open && <div style={{ ...styles.bubble, pointerEvents: "auto", width: "min(78vw, 300px)", marginBottom: 4 }}>
      <div>{bubble}</div>
      <div style={{ ...styles.form, marginTop: 8, padding: 0, borderTop: 0, background: "transparent" }}>
        <button type="button" style={{ ...styles.send, padding: "5px 9px" }} onClick={() => setOpen(true)}>Chat with Coy</button>
      </div>
      <div style={{ position: "absolute", right: 24, bottom: -9, width: 14, height: 14, background: "#fff", borderRight: "2px solid #222", borderBottom: "2px solid #222", transform: "rotate(45deg)" }} />
    </div>}
    {showMenu && <div role="menu" aria-label="Coy expressions" style={styles.menu}>
      {EXPRESSIONS.map(([label, text]) => <button key={label} type="button" role="menuitem" onClick={() => { setBubble(text); setShowMenu(false); }} style={{ fontSize: 11, padding: "6px 5px", background: "#f7f7f7", border: "1px solid #bbb", borderRadius: 3 }}>{label}</button>)}
    </div>}
    <button type="button" style={styles.imageButton} onClick={() => setOpen(value => !value)} onContextMenu={event => { event.preventDefault(); setShowMenu(value => !value); }} aria-label={open ? "Hide Coy chat" : "Talk to Coy"} title="Click Coy to chat; right-click for expressions">
      <img src="/images/ds.png" alt="Coy" style={styles.image} />
    </button>
  </div>;
}
