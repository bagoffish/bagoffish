import React, { useEffect, useRef, useState } from "react";

const API_BASE = (process.env.REACT_APP_API_BASE || "https://bloxify-backend-sg.onrender.com").replace(/\/$/, "");
const COY_SPRITE = (process.env.PUBLIC_URL || "").replace(/\/$/, "") + "/images/coy.png";
const GREETINGS = ["Sup", "Hi", "Hello", "Haii", "Hai", "Yo"];
const randomGreeting = () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)];

const EXPRESSIONS = [
  ["Normal", "just hanging out."], ["Slightly happy", "oh, hi."],
  ["Annoyed", "im a little annoyed."], ["Sleepy", "five more minutes…"],
  ["Surprised", "oh, didnt expect that."], ["Smug", "i might know something."],
  ["Embarrassed", "okay, dont look at me."], ["Thinking", "hold on, thinking."],
  ["Waving", "heyy"], ["Cute pose", "hi :3"]
];

export default function CoyCompanion() {
  const [showMenu, setShowMenu] = useState(false);
  const [showBubble, setShowBubble] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [line, setLine] = useState(randomGreeting);
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [foundImage, setFoundImage] = useState(null);
  const [holdingImage, setHoldingImage] = useState(false);
  const inputRef = useRef(null);
  const seenImages = useRef(new Set());
  const lastActivity = useRef(0);
  const lastPickupAttempt = useRef(0);
  const hasHeldImage = useRef(false);

  useEffect(() => {
    if (chatOpen) inputRef.current?.focus();
  }, [chatOpen]);

  useEffect(() => {
    const announce = (text, options = {}) => {
      setLine(text);
      setShowBubble(true);
      if (options.image) setFoundImage(options.image);
    };
    const onActivity = event => {
      const detail = event.detail || {};
      if (detail.type === "app-open" && String(detail.name || "").toLowerCase() === "coy") return;
      const now = Date.now();
      if (now - lastActivity.current < 18000) return;
      lastActivity.current = now;
      if (detail.type === "app-open") {
        const quips = {
          Winamp: "oh, music.",
          Renderer: "checking out an avatar?",
          Bloxify: "working on music again.",
          Winter_Letter: "oh, Winter Letter.",
          Paint: "doing some drawing?",
          Minesweeper: "good luck with this one."
        };
        announce(quips[detail.name] || ("oh, you opened " + (detail.name || "an app") + "."));
      } else if (detail.type === "music") announce("music is playing.");
      else if (detail.type === "error") announce("looks like something went wrong.");
      else if (detail.type === "image" && detail.src && !hasHeldImage.current && now - lastPickupAttempt.current > 45000 && Math.random() <= 0.015) {
        lastPickupAttempt.current = now;
        hasHeldImage.current = true;
        setFoundImage({ src: detail.src, alt: detail.alt || "A visible image" });
        setHoldingImage(true);
        announce("oh, an image.", { image: detail.src });
      }
    };
    window.addEventListener("coy:activity", onActivity);

    // Coy can notice images rendered inside this website, especially the avatar renderer.
    // He never reads outside the page or tries to access private browser data.
    const scanImages = () => {
      // Coy only occasionally picks up one image, and won't look for another while holding it.
      if (hasHeldImage.current) return;
      const now = Date.now();
      if (now - lastPickupAttempt.current < 45000) return;
      lastPickupAttempt.current = now;
      const candidates = Array.from(document.querySelectorAll(".avatar-container img, .old-avatar-thumb, img"))
        .filter(img => img.complete && img.naturalWidth > 100 && img.naturalHeight > 100)
        .filter(img => !img.closest("[data-coy-ui]"))
        .filter(img => img.matches(".avatar-container img, .old-avatar-thumb") || /renderer|avatar|render|thumbnail|roblox/i.test(
          [img.alt, img.className, img.closest("[class]")?.className, img.src].join(" ")
        ))
        .filter(img => img.src && !seenImages.current.has(img.src) && img.style.visibility !== "hidden");
      // Keep this genuinely rare even on pages with lots of avatar thumbnails.
      if (!candidates.length || Math.random() > 0.015) return;
      const img = candidates[Math.floor(Math.random() * candidates.length)];
      seenImages.current.add(img.src);
      const original = img.closest(".old-avatar-thumb") || img;
      original.style.visibility = "hidden";
      hasHeldImage.current = true;
      setFoundImage({ src: img.src, alt: img.alt || "Roblox avatar render" });
      setHoldingImage(true);
      if (now - lastActivity.current > 9000) {
        lastActivity.current = now;
        announce("i found an avatar render. want to use it in chat?");
      }
    };
    const observer = new MutationObserver(scanImages);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "alt"] });
    // The renderer often inserts an <img> before the image bytes finish loading.
    // Re-scan on load so Coy actually picks up the completed avatar render.
    document.addEventListener("load", scanImages, true);
    scanImages();
    return () => {
      window.removeEventListener("coy:activity", onActivity);
      document.removeEventListener("load", scanImages, true);
      observer.disconnect();
    };
  }, []);

  function openChat(image = null) {
    setShowBubble(false);
    setShowMenu(false);
    window.dispatchEvent(new CustomEvent("coy:open-chat", {
      detail: image ? { image } : {}
    }));
  }

  async function send(event) {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    const priorHistory = history.slice(-16);
    setHistory(previous => [...previous, { role: "user", content: message }].slice(-16));
    setDraft("");
    setBusy(true);
    setError("");
    try {
      const controller = new AbortController();
      const requestTimeout = window.setTimeout(() => controller.abort(), 25000);
      let response;
      try {
        response = await fetch(API_BASE + "/personal-ai/chat", { signal: controller.signal,
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          message,
          history: priorHistory,
          websiteContext: {
            currentLocalTime: new Date().toString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
            desktopApps: Array.from(document.querySelectorAll("[data-app-title]")).map(node => node.getAttribute("data-app-title")).filter(Boolean),
            coyMood: line,
            imageAvailable: Boolean(foundImage)
          }
        })
      });
      } finally { window.clearTimeout(requestTimeout); }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Couldn't reach Coy right now.");
      const answer = typeof data.answer === "string" && data.answer.trim() ? data.answer.trim() : "…";
      setHistory(previous => [...previous, { role: "assistant", content: answer }].slice(-16));
      setLine(answer);
    } catch (err) {
      setError(err.name === "AbortError" ? "Coy took too long to answer. Try again in a moment." : (err.message === "Failed to fetch" ? "Coy’s chat server could not be reached. The server may be waking up; try again shortly." : (err.message || "Connection failed")));
    } finally {
      setBusy(false);
    }
  }

  function addImageToChat() {
    if (!foundImage?.src) return;
    const image = foundImage;
    setLine(randomGreeting());
    hasHeldImage.current = false;
    setFoundImage(null);
    setHoldingImage(false);
    openChat(image);
  }

  const styles = {
    root: { position: "fixed", right: 14, bottom: 48, zIndex: 10000, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, fontFamily: "Tahoma, Arial, sans-serif", pointerEvents: "none" },
    imageButton: { position: "relative", pointerEvents: "auto", display: "block", border: 0, padding: 0, background: "transparent", cursor: "pointer", width: "clamp(120px, 14vw, 170px)", maxWidth: 170, maxHeight: "42vh", touchAction: "manipulation" },
    image: { display: "block", width: "100%", height: "auto", maxHeight: "42vh", objectFit: "contain", objectPosition: "bottom", filter: "drop-shadow(0 2px 2px rgba(0,0,0,.22))" },
    heldRender: { position: "absolute", left: "50%", top: "58%", width: "38%", height: "auto", maxHeight: "20vh", objectFit: "contain", transform: "translate(-50%,-50%) rotate(-7deg)", border: "3px solid #fff", outline: "1px solid #555", boxShadow: "1px 3px 5px rgba(0,0,0,.35)", borderRadius: 2, pointerEvents: "none", zIndex: 2 },
    bubbleWrap: { position: "relative", pointerEvents: "auto", width: "min(78vw, 310px)", marginBottom: 4 },
    bubble: { position: "relative", boxSizing: "border-box", width: "100%", padding: "10px 12px", border: "2px solid #222", borderRadius: 12, background: "#fff", color: "#111", boxShadow: "0 2px 0 rgba(0,0,0,.12)", fontSize: 13, lineHeight: 1.35, overflowWrap: "anywhere", whiteSpace: "pre-wrap" },
    tail: { position: "absolute", right: "calc(clamp(120px, 14vw, 170px) / 2 - 7px)", bottom: -9, width: 14, height: 14, background: "#fff", borderRight: "2px solid #222", borderBottom: "2px solid #222", transform: "rotate(45deg)", borderBottomRightRadius: 2 },
    form: { display: "flex", gap: 5, marginTop: 8 },
    input: { flex: 1, minWidth: 0, border: "1px solid #777", borderRadius: 2, padding: "7px 8px", fontSize: 13, color: "#111", background: "#fff" },
    button: { border: "1px solid #777", borderRadius: 2, background: "#eee", color: "#111", padding: "5px 9px", fontSize: 12, cursor: "pointer" },
    menu: { pointerEvents: "auto", maxWidth: 240, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, padding: 7, background: "#fff", border: "2px solid #222", borderRadius: 3, boxShadow: "2px 3px 0 rgba(0,0,0,.18)" },
    chat: { pointerEvents: "auto", width: "min(90vw, 410px)", maxHeight: "min(64vh, 560px)", display: "flex", flexDirection: "column", overflow: "hidden", background: "#ece9d8", border: "2px solid #0054e3", boxShadow: "3px 4px 0 rgba(0,0,0,.3)", color: "#111", fontSize: 12 },
    titlebar: { background: "linear-gradient(90deg,#0058e6,#3a93ff)", color: "#fff", fontWeight: "bold", padding: "7px 9px", display: "flex", justifyContent: "space-between", alignItems: "center" },
    messages: { padding: 10, overflowY: "auto", minHeight: 110, maxHeight: 300, background: "#fff", display: "flex", flexDirection: "column", gap: 8 },
    message: { padding: "7px 9px", border: "1px solid #d1d1d1", borderRadius: 3, whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxWidth: "92%" }
  };

  return <div style={styles.root} data-coy-ui="true">
    {!chatOpen && showBubble && <div style={styles.bubbleWrap} role="status" aria-live="polite">
      <div style={styles.bubble}>{line}</div>
      <span aria-hidden="true" style={styles.tail} />
    </div>}
    {chatOpen && <section style={styles.chat} aria-label="Chat with Coy">
      <div style={styles.titlebar}><span>Coy</span></div>
      <div style={styles.messages} aria-live="polite">
        {!history.length && <div style={{ color: "#555" }}>{line}</div>}
        {history.map((item, index) => <div key={index} style={{ ...styles.message, alignSelf: item.role === "user" ? "flex-end" : "flex-start", background: item.role === "user" ? "#e7f0ff" : "#f7f5eb" }}>
          <div style={{ fontWeight: "bold", marginBottom: 3 }}>{item.role === "user" ? "You" : "Coy"}</div>
          {item.content}
          {item.image && <img src={item.image} alt="Image Coy found" style={{ display: "block", maxWidth: "100%", maxHeight: 220, marginTop: 6, objectFit: "contain" }} />}
        </div>)}
        {busy && <div style={styles.message}>Coy is typing…</div>}
        {error && <div role="alert" style={{ color: "#9b1c1c" }}>{error}</div>}
        {foundImage && <div style={{ border: "1px dashed #777", padding: 7, background: "#fffbe8" }}>
          <div>psst. i found an image</div>
          <img src={foundImage.src} alt={foundImage.alt} style={{ maxWidth: "100%", maxHeight: 100, display: "block", margin: "5px 0" }} />
          <button style={styles.button} type="button" onClick={addImageToChat}>Add image to chat</button>
          <button style={styles.button} type="button" onClick={() => { hasHeldImage.current = false; setFoundImage(null); setHoldingImage(false); }}>Leave it</button>
        </div>}
      </div>
      <form style={{ ...styles.form, padding: 8, marginTop: 0 }} onSubmit={send}>
        <input ref={inputRef} style={styles.input} aria-label="Message Coy" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Say something..." maxLength={2000} />
        <button style={styles.button} type="submit" disabled={busy || !draft.trim()}>{busy ? "…" : "Send"}</button>
      </form>
    </section>}
    {showMenu && <div role="menu" aria-label="Coy expressions" style={styles.menu}>
      {EXPRESSIONS.map(([label, text]) => <button key={label} type="button" role="menuitem" onClick={() => { setLine(text); setShowBubble(true); setShowMenu(false); }} style={{ ...styles.button, padding: "6px 5px" }}>{label}</button>)}
      
    </div>}
    <button type="button" style={styles.imageButton} onClick={openChat} onDoubleClick={() => { setLine("pat pat pat"); setShowBubble(true); }} onContextMenu={e => { e.preventDefault(); setShowMenu(v => !v); }} aria-label="Coy" title="Click Coy to chat; double-click to pat; right-click for expressions">
      <img src={COY_SPRITE} alt="Coy" style={styles.image} />
      {holdingImage && foundImage && <img src={foundImage.src} alt="Roblox avatar render Coy is holding" style={styles.heldRender} />
      }
    </button>
  </div>;
}
