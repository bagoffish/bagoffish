import React, { useRef, useState } from "react";

const API_BASE = process.env.REACT_APP_API_BASE || "https://winxp-7yes.onrender.com";

const styles = {
  shell: { height: "100%", minHeight: 360, display: "flex", flexDirection: "column", background: "#f4f4f4", color: "#111", fontFamily: "Tahoma, Arial, sans-serif", fontSize: 12 },
  intro: { padding: "12px 14px", background: "linear-gradient(90deg,#fff,#eaf2ff)", borderBottom: "1px solid #b7c9e2" },
  title: { fontWeight: "bold", fontSize: 14, marginBottom: 5 },
  messages: { flex: 1, minHeight: 120, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 },
  bubble: { maxWidth: "88%", padding: "9px 11px", border: "1px solid #c8c8c8", borderRadius: 5, whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.5 },
  user: { alignSelf: "flex-end", background: "#e3edff", borderColor: "#9db9e7" },
  bot: { alignSelf: "flex-start", background: "#fff" },
  form: { display: "flex", gap: 7, padding: 10, borderTop: "1px solid #b8b8b8", background: "#ece9d8" },
  input: { flex: 1, minWidth: 0, resize: "none", border: "1px solid #7f9db9", padding: 9, font: "12px Tahoma, Arial", background: "#fff" },
  button: { padding: "0 14px", border: "1px solid #245edb", borderRadius: 3, color: "#fff", font: "bold 12px Tahoma, Arial", background: "linear-gradient(#4b91ff,#0754d8)", cursor: "pointer" },
  note: { fontSize: 10, color: "#555", padding: "0 12px 9px", background: "#ece9d8" },
};

export default function PersonalAI() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "안녕! hey! 이건 내 글과 기억을 바탕으로 만든 AI 버전이야. it might not know everything, but you can ask me stuff. 한국어와 English로 대화할 수 있어!" },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

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
      if (!response.ok) throw new Error(data.error || "Couldn't send the message.");
      setMessages(previous => [...previous, { role: "assistant", content: data.answer }]);
    } catch (err) {
      setError(err.message || "Couldn't connect to the chatbot.");
    } finally {
      setBusy(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 0);
    }
  }

  return (
    <div style={styles.shell}>
      <div style={styles.intro}>
        <div style={styles.title}>Talk to Coy</div>
        <div>한국어와 English만 지원해요. An AI representation based on Coy's own writing. It can make mistakes and isn't the person themselves.</div>
      </div>
      <div style={styles.messages} aria-live="polite">
        {messages.map((item, index) => (
          <div key={index} style={{ ...styles.bubble, ...(item.role === "user" ? styles.user : styles.bot) }}>
            <strong>{item.role === "user" ? "you" : "coy (AI)"}:</strong>{" "}{item.content}
          </div>
        ))}
        {busy && <div style={{ ...styles.bubble, ...styles.bot }}>생각 중… / thinking…</div>}
        <div ref={bottomRef} />
      </div>
      {error && <div role="alert" style={{ padding: "4px 12px", color: "#a00000" }}>{error}</div>}
      <form style={styles.form} onSubmit={send}>
        <textarea
          aria-label="Message / 메시지"
          rows={2}
          maxLength={2000}
          placeholder="한국어 또는 English로 입력해줘..."
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
      <div style={styles.note}>비밀번호나 개인정보를 공유하지 마세요. Don't share passwords or private information. Chats are not stored by this website's chatbot endpoint.</div>
    </div>
  );
}
