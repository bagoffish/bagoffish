import React, { useEffect, useRef, useState } from "react";

const API_BASE = process.env.REACT_APP_API_BASE || "https://winxp-7yes.onrender.com";
const EXPRESSIONS = [
  ["Normal", "Just hanging out."], ["Slightly happy", "oh, hi."],
  ["Annoyed", "im judging u a normal amount"], ["Sleepy", "five more minutes…"],
  ["Surprised", "WAIT WHAT"], ["Smug", "i know something u dont"],
  ["Embarrassed", "dont look at me"], ["Thinking", "hold on. thinking."],
  ["Waving", "heyy"], ["Cute pose", "behold. the creature."]
];

export default function CoyCompanion() {
  const [showMenu, setShowMenu] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [line, setLine] = useState("hey. click me if u wanna talk");
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (showBubble) inputRef.current?.focus();
  }, [showBubble]);

  async function send(event) {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    const nextHistory = [...history, { role: "user", content: message }].slice(-16);
    setHistory(nextHistory);
    setDraft("");
    setLine("…");
    setShowBubble(true);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(API_BASE + "/personal-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ message, history: history.slice(-16) })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Couldn't reach Coy right now.");
      const answer = typeof data.answer === "string" && data.answer.trim() ? data.answer.trim() : "…";
      setLine(answer);
      setHistory(previous => [...previous, { role: "assistant", content: answer }].slice(-16));
    } catch (err) {
      setLine("I can't connect right now. try again in a bit");
      setError(err.message || "Connection failed");
    } finally {
      setBusy(false);
    }
  }

  const styles = {
    root: { position: "fixed", right: 14, bottom: 18, zIndex: 10000, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, fontFamily: "Arial, Helvetica, sans-serif", pointerEvents: "none" },
    imageButton: { pointerEvents: "auto", display: "block", border: 0, padding: 0, background: "transparent", cursor: "pointer", width: "min(42vw, 280px)", maxWidth: 280, maxHeight: "62vh", touchAction: "manipulation" },
    image: { display: "block", width: "100%", height: "auto", maxHeight: "62vh", objectFit: "contain", objectPosition: "bottom", filter: "drop-shadow(0 2px 2px rgba(0,0,0,.22))" },
    bubbleWrap: { position: "relative", pointerEvents: "auto", width: "min(78vw, 310px)", marginBottom: 4 },
    bubble: { position: "relative", boxSizing: "border-box", width: "100%", padding: "10px 12px", border: "2px solid #222", borderRadius: 12, background: "#fff", color: "#111", boxShadow: "0 2px 0 rgba(0,0,0,.12)", fontSize: 13, lineHeight: 1.35, overflowWrap: "anywhere", whiteSpace: "pre-wrap" },
    tail: { position: "absolute", right: 24, bottom: -9, width: 14, height: 14, background: "#fff", borderRight: "2px solid #222", borderBottom: "2px solid #222", transform: "rotate(45deg)", borderBottomRightRadius: 2 },
    form: { display: "flex", gap: 5, marginTop: 8 },
    input: { flex: 1, minWidth: 0, border: "1px solid #777", borderRadius: 4, padding: "7px 8px", fontSize: 13, color: "#111", background: "#fff", outlineOffset: 1 },
    send: { border: "1px solid #555", borderRadius: 4, background: "#eee", color: "#111", padding: "5px 9px", fontSize: 12, cursor: "pointer" },
    menu: { pointerEvents: "auto", maxWidth: 240, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, padding: 7, background: "#fff", border: "2px solid #222", borderRadius: 7, boxShadow: "2px 3px 0 rgba(0,0,0,.18)" }
  };

  return <div style={styles.root}>
    {showBubble && <div style={styles.bubbleWrap}>
      <div role="status" aria-live="polite" style={styles.bubble}>
        <div>{line}</div>
        {error && <div style={{ fontSize: 10, color: "#8b1b1b", marginTop: 5 }}>{error}</div>}
        <form style={styles.form} onSubmit={send}>
          <input ref={inputRef} style={styles.input} aria-label="Message Coy" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Say something..." maxLength={2000} />
          <button style={styles.send} type="submit" disabled={busy || !draft.trim()}>{busy ? "…" : "Send"}</button>
        </form>
        <div style={styles.tail} />
      </div>
    </div>}
    {showMenu && <div role="menu" aria-label="Coy expressions" style={styles.menu}>
      {EXPRESSIONS.map(([label, text]) => <button key={label} type="button" role="menuitem" onClick={() => { setLine(text); setShowBubble(true); setShowMenu(false); }} style={{ fontSize: 11, padding: "6px 5px", background: "#f7f7f7", border: "1px solid #bbb", borderRadius: 3 }}>{label}</button>)}
    </div>}
    <button type="button" style={styles.imageButton} onClick={() => setShowBubble(v => !v)} onContextMenu={e => { e.preventDefault(); setShowMenu(v => !v); }} aria-label="Coy" title="Click Coy to talk; right-click for expressions">
      <img src="/images/ds.png" alt="Coy" style={styles.image} />
    </button>
  </div>;
}
