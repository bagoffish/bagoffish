import React, { useEffect, useRef, useState } from "react";

const API_BASE = process.env.REACT_APP_API_BASE || "https://winxp-7yes.onrender.com";

const styles = {
  shell: { height: "100%", minHeight: 360, display: "flex", flexDirection: "column", background: "#f4f4f4", color: "#111", fontFamily: "Tahoma, Arial, sans-serif", fontSize: 12 },
  page: { minHeight: "100dvh", boxSizing: "border-box", padding: "clamp(0px, 3vw, 28px)", background: "linear-gradient(145deg, #dbe9ff 0%, #f5f7fc 52%, #e8efff 100%)", color: "#111", fontFamily: "Tahoma, Arial, sans-serif" },
  standaloneShell: { width: "100%", maxWidth: 920, height: "min(88dvh, 900px)", minHeight: 360, margin: "0 auto", display: "flex", flexDirection: "column", overflow: "hidden", background: "#f4f4f4", color: "#111", border: "1px solid #8ba7cf", borderRadius: 8, boxShadow: "0 16px 48px rgba(28, 54, 94, .18)", fontFamily: "Tahoma, Arial, sans-serif", fontSize: 13 },
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

export default function CoyPage() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "안녕! hey! :3 이건 내 글과 기억을 바탕으로 만든 AI 버전이야. it might not know everything, but you can ask me stuff. 한국어와 English로 대화할 수 있어!" },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    const oldTitle = document.title;
    document.title = "Talk to Coy :3";
    return () => { document.title = oldTitle; };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

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
        body: JSON.stringify({ message, history }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Couldn't send the message.");
      if (typeof data.answer !== "string") throw new Error("The chatbot returned an unexpected response.");
      setMessages(previous => [...previous, { role: "assistant", content: data.answer }]);
    } catch (err) {
      setError(err.message || "Couldn't connect to the chatbot.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.standaloneShell} aria-label="Talk to Coy chat">
        <header style={styles.intro}>
          <div style={styles.title}>Talk to Coy :3</div>
          <div style={styles.subtitle}>한국어와 English만 지원해요. An AI representation based on Coy's own writing — not the actual person.</div>
        </header>
        <div style={styles.messages} aria-live="polite" aria-relevant="additions">
          {messages.map((item, index) => (
            <div key={index} style={{ ...styles.bubble, ...(item.role === "user" ? styles.user : styles.bot) }}>
              <strong>{item.role === "user" ? "you" : "coy (AI)"}:</strong>{" "}{item.content}
            </div>
          ))}
          {busy && <div style={{ ...styles.bubble, ...styles.bot }}>생각 중… / thinking… :3</div>}
          <div ref={bottomRef} />
        </div>
        {error && <div role="alert" style={{ padding: "8px 12px", color: "#a00000", background: "#fff0f0" }}>{error}</div>}
        <form style={styles.form} onSubmit={send}>
          <textarea
            aria-label="Message / 메시지"
            rows={2}
            maxLength={2000}
            placeholder="한국어 또는 English로 입력해줘... :3"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (!busy && draft.trim()) send(event);
              }
            }}
            style={styles.input}
            disabled={busy}
          />
          <button type="submit" disabled={busy || !draft.trim()} style={{ ...styles.button, opacity: busy || !draft.trim() ? 0.65 : 1 }}>
            {busy ? "..." : "Send"}
          </button>
        </form>
        <footer style={styles.note}>비밀번호나 개인정보를 공유하지 마세요. Don't share passwords or private information. This chat page currently does not save conversations between visits.</footer>
      </section>
    </main>
  );
}
