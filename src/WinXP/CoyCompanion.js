import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const API_BASE = (process.env.REACT_APP_API_BASE || "https://bloxify-backend-sg.onrender.com").replace(/\/$/, "");
const COY_SPRITE = (process.env.PUBLIC_URL || "").replace(/\/$/, "") + "/images/coy.png";
const GREETINGS = ["Sup", "Hi", "Hello", "Haii", "Hai", "Yo"];
const randomGreeting = () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
const PICKUP_LINES = ["HEY— where are we going?", "Oh! You’re moving me?", "Wheee— wait, put me down somewhere nice.", "Eep! Got me.", "Okay okay, I’m coming.", "Oh, we’re relocating now?"];
const PAT_LINES = ["Hehe, again.", "…okay that’s kinda nice.", "Heyy. :3", "You’re messing up my hair.", "*happy little wiggle*", "Hm? Oh. hi.", "Eep— didn’t expect that.", "Okay, you can stay."];
const randomLine = lines => lines[Math.floor(Math.random() * lines.length)];
const COY_COMPANION_COOKIE = 'coy_companion_chat';
function readCompanionChatCookie() {
  try {
    const match = document.cookie.split('; ').find(part => part.startsWith(COY_COMPANION_COOKIE + '='));
    if (!match) return [];
    const parsed = JSON.parse(decodeURIComponent(match.slice(COY_COMPANION_COOKIE.length + 1)));
    return Array.isArray(parsed) ? parsed.filter(item => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string').slice(-12) : [];
  } catch (_) { return []; }
}
function writeCompanionChatCookie(messages) {
  try {
    let kept = messages.slice(-12);
    let encoded = encodeURIComponent(JSON.stringify(kept));
    while (encoded.length > 3500 && kept.length > 2) {
      kept = kept.slice(1);
      encoded = encodeURIComponent(JSON.stringify(kept));
    }
    document.cookie = COY_COMPANION_COOKIE + '=' + encoded + '; Max-Age=2592000; Path=/; SameSite=Lax';
  } catch (_) {}
}
const renderCoyEmoji = value => String(value ?? "").split(/(:ono:)/gi).map((part, index) => part.toLowerCase() === ":ono:"
  ? <img key={index} src="/images/ono.png" onError={event => { event.currentTarget.replaceWith(document.createTextNode("😬")); }} alt="nervous, awkward, or startled" title="Nervous / awkward / startled" style={{ width: "1.2em", height: "1.2em", objectFit: "contain", verticalAlign: "-0.25em", display: "inline-block" }} />
  : part);

const formatCoyText = value => String(value ?? "").replace(/\p{L}/u, letter => letter.toLocaleUpperCase());

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
  const [hideForMobileApp, setHideForMobileApp] = useState(false);
  const [line, setLine] = useState(randomGreeting);
  const [chatGreeting, setChatGreeting] = useState(randomGreeting);
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState(() => readCompanionChatCookie());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [foundImage, setFoundImage] = useState(null);
  const [holdingImage, setHoldingImage] = useState(false);
  const inputRef = useRef(null);
  const seenImages = useRef(new Set());
  const lastActivity = useRef(0);
  const openAppsRef = useRef([]);
  const fullTabActiveRef = useRef(false);
  const lastPickupAttempt = useRef(0);
  const hasHeldImage = useRef(false);
  const dragState = useRef(null);
  const dragged = useRef(false);
  const clickTimer = useRef(null);
  const [spriteSize, setSpriteSize] = useState(() => window.innerWidth <= 700 ? 124 : 160);
  useEffect(() => {
    const updateSpriteSize = () => setSpriteSize(window.innerWidth <= 700 ? 124 : 160);
    window.addEventListener("resize", updateSpriteSize);
    return () => window.removeEventListener("resize", updateSpriteSize);
  }, []);

  const [position, setPosition] = useState(() => ({
    // Position tracks Coy's visible sprite, not a wide invisible chat-sized wrapper.
    left: Math.max(8, window.innerWidth - (window.innerWidth <= 700 ? 124 : 160) - 8),
    top: Math.max(8, window.innerHeight - 80 - 170 - 8)
  }));
  const [isDragging, setIsDragging] = useState(false);
  const rootRef = useRef(null);

  // Keep Coy fully above the XP taskbar, including after the image loads.
  useEffect(() => {
    // Reserve the taskbar plus a small gap. The sprite's height may be zero
    // on first render, so observe its real dimensions and clamp again.
    const TASKBAR_RESERVED_HEIGHT = 76;
    const getTaskbarTop = () => window.innerHeight - TASKBAR_RESERVED_HEIGHT;
    const clampToDesktop = () => {
      const node = rootRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
      const maxTop = Math.max(8, getTaskbarTop() - rect.height);
      setPosition(previous => {
        const left = Math.min(maxLeft, Math.max(8, previous.left));
        const top = Math.min(maxTop, Math.max(8, previous.top));
        return left === previous.left && top === previous.top ? previous : { left, top };
      });
    };
    clampToDesktop();
    window.addEventListener("resize", clampToDesktop);
    const node = rootRef.current;
    const observer = node && typeof ResizeObserver !== "undefined" ? new ResizeObserver(clampToDesktop) : null;
    if (node && observer) observer.observe(node);
    const sprite = node?.querySelector("img[alt='Coy']");
    sprite?.addEventListener("load", clampToDesktop);
    return () => {
      window.removeEventListener("resize", clampToDesktop);
      observer?.disconnect();
      sprite?.removeEventListener("load", clampToDesktop);
    };
  }, []);

  useEffect(() => {
    if (!showBubble || chatOpen) return undefined;
    const readingTime = Math.min(10000, Math.max(2500, 1800 + line.length * 45));
    const timer = window.setTimeout(() => setShowBubble(false), readingTime);
    return () => window.clearTimeout(timer);
  }, [showBubble, chatOpen, line]);

  useEffect(() => {
    writeCompanionChatCookie(history);
  }, [history]);

  useEffect(() => {
    if (chatOpen) inputRef.current?.focus();
  }, [chatOpen]);

  // Press / anywhere on the desktop to open Coy chat. Never steal the key
  // while the user is already typing into a field or an editable element.
  useEffect(() => {
    const onShortcut = event => {
      if (event.key !== "/" || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      const target = event.target;
      const tag = String(target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) return;
      event.preventDefault();
      openChat();
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    const announce = (text, options = {}) => {
      setLine(formatCoyText(text));
      setShowBubble(true);
      if (options.image) setFoundImage(options.image);
    };
    const onCloseChat = () => setChatOpen(false);
    window.addEventListener("coy:close-chat", onCloseChat);

    // Use both the app-state event and the rendered window DOM. The DOM check
    // is a fallback for app windows opened by another launcher/tab that doesn't
    // publish coy:activity, and MutationObserver keeps it in sync on mobile.
    const isMobileViewport = () => window.matchMedia("(max-width: 700px)").matches;
    const hasVisibleAppWindow = () => {
      try {
        return Array.from(document.querySelectorAll("[data-app-title]")).some(node => {
          if (!node.getClientRects().length) return false;
          const style = window.getComputedStyle(node);
          return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
        });
      } catch (_) { return false; }
    };
    const syncMobileAppVisibility = () => {
      const anyAppOpen = openAppsRef.current.length > 0 || hasVisibleAppWindow();
      // Full-tab/maximized windows hide the desktop companion on every device.
      setHideForMobileApp(fullTabActiveRef.current || (isMobileViewport() && anyAppOpen));
    };
    const onActivity = event => {
      const detail = event.detail || {};
      if (detail.type === "app-state") {
        openAppsRef.current = Array.isArray(detail.openApps) ? detail.openApps : [];
        fullTabActiveRef.current = Boolean(detail.fullTabActive);
        syncMobileAppVisibility();
        return;
      }
      if (detail.type === "app-open" && String(detail.name || "").toLowerCase() === "coy") return;
      const now = Date.now();
      if (now - lastActivity.current < 18000) return;
      lastActivity.current = now;
      if (detail.type === "app-open") {
        const quips = {
          Winamp: ["Oh, music.", "What are we listening to?", "Music time.", "Ooh, song time."],
          Renderer: ["Making an avatar?", "Avatar time?", "Ohh, rendering something?", "Lemme see the avatar later."],
          Bloxify: ["Making music again?", "Songmaking time.", "Ooh, music stuff.", "Cooking up a track?"],
          Winter_Letter: ["Back to Winter Letter?", "Ooh, writing time.", "Winter Letter again :3"],
          Paint: ["Drawing something?", "Ooh, art time.", "Whatcha making?"],
          Minesweeper: ["Good luck with this one.", "Don't explode :p", "Minesweeper time."]
        };
        const options = quips[detail.name] || [
          "Oh, " + (detail.name || "an app") + ".",
          "Whatcha doing in " + (detail.name || "there") + "?",
          "Ooh, checking this out?"
        ];
        announce(options[Math.floor(Math.random() * options.length)]);
      } else if (detail.type === "music") announce("music is playing.");
      else if (detail.type === "error") announce("looks like something went wrong.");
      else if (detail.type === "image" && detail.src && !hasHeldImage.current && now - lastPickupAttempt.current > 30000 && Math.random() <= 0.06) {
        lastPickupAttempt.current = now;
        hasHeldImage.current = true;
        setFoundImage({ src: detail.src, alt: detail.alt || "A visible image" });
        setHoldingImage(true);
        announce("oh, an image.", { image: detail.src });
      }
    };
    window.addEventListener("coy:activity", onActivity);
    // Keep the companion state correct if the viewport rotates/resizes, and
    // catch the initial app-state event even if it fired before this listener.
    const onResize = syncMobileAppVisibility;
    window.addEventListener("resize", onResize);
    const appWindowObserver = new MutationObserver(syncMobileAppVisibility);
    appWindowObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "data-app-title"] });
    syncMobileAppVisibility();
    window.dispatchEvent(new CustomEvent("coy:request-app-state"));

    // Coy can notice images rendered inside this website, especially the avatar renderer.
    // He never reads outside the page or tries to access private browser data.
    const scanImages = () => {
      // Coy only occasionally picks up one image, and won't look for another while holding it.
      if (hasHeldImage.current) return;
      const now = Date.now();
      if (now - lastPickupAttempt.current < 30000) return;
      lastPickupAttempt.current = now;
      const candidates = Array.from(document.querySelectorAll(".avatar-container img, .old-avatar-thumb, img"))
        .filter(img => img.complete && img.naturalWidth > 100 && img.naturalHeight > 100)
        .filter(img => !img.closest("[data-coy-ui]"))
        .filter(img => img.matches(".avatar-container img, .old-avatar-thumb") || /renderer|avatar|render|thumbnail|roblox/i.test(
          [img.alt, img.className, img.closest("[class]")?.className, img.src].join(" ")
        ))
        .filter(img => img.src && !seenImages.current.has(img.src) && img.style.visibility !== "hidden");
      // Keep this genuinely rare even on pages with lots of avatar thumbnails.
      if (!candidates.length || Math.random() > 0.06) return;
      const img = candidates[Math.floor(Math.random() * candidates.length)];
      seenImages.current.add(img.src);
      // Coy carries a copy of the image. Never hide, move, or mutate the original page image.
      hasHeldImage.current = true;
      setFoundImage({ src: img.src, alt: img.alt || "Roblox avatar render" });
      setHoldingImage(true);
      if (now - lastActivity.current > 9000) {
        lastActivity.current = now;
        announce("Ohh, an avatar render. Wanna use it in chat?");
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
      window.removeEventListener("resize", onResize);
      window.removeEventListener("coy:close-chat", onCloseChat);
      appWindowObserver.disconnect();
      document.removeEventListener("load", scanImages, true);
      observer.disconnect();
    };
  }, []);

  function startDrag(event) {
    if (event.button !== 0) return;
    const spriteRect = event.currentTarget.getBoundingClientRect();
    const rootRect = event.currentTarget.parentElement?.getBoundingClientRect() || spriteRect;
    dragState.current = {
      x: event.clientX, y: event.clientY,
      left: rootRect.left, top: rootRect.top,
      width: rootRect.width, height: rootRect.height,
      movedCharacter: false,
      pointerId: event.pointerId
    };
    dragged.current = false;
    setIsDragging(false);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function moveDrag(event) {
    if (!dragState.current) return;
    const state = dragState.current;
    const deltaX = event.clientX - state.x;
    const deltaY = event.clientY - state.y;
    const distance = Math.max(Math.abs(deltaX), Math.abs(deltaY));
    // Headpats are double-click only. Any actual pointer movement is reserved
    // for dragging so tiny strokes never get mistaken for a pat.
    if (distance >= 5) {
      state.movedCharacter = true;
      dragged.current = true;
      setIsDragging(true);
    }
    if (!state.movedCharacter) return;

    // Keep the wrapper's starting dimensions for the entire gesture. Measuring
    // it again mid-drag made the character jump when its speech bubble changed.
    const maxRight = Math.max(8, window.innerWidth - state.width - 8);
    // Always leave a visible gap above the taskbar, even if the taskbar's
    // DOM selector differs between desktop and mobile layouts.
    const taskbarTop = window.innerHeight - 76;
    const maxBottom = Math.max(8, taskbarTop - state.height);
    setPosition({
      left: Math.max(0, Math.min(maxRight, state.left + deltaX)),
      top: Math.max(0, Math.min(maxBottom, state.top + deltaY))
    });
  }

  function endDrag() {
    const state = dragState.current;
    dragState.current = null;
    setIsDragging(false);
    if (state?.movedCharacter) {
      setLine(formatCoyText(randomLine(PICKUP_LINES)));
      setShowBubble(true);
    }
    window.setTimeout(() => { dragged.current = false; }, 250);
  }

  function patCoy() {
    setLine(formatCoyText(randomLine(PAT_LINES)));
    setShowBubble(true);
    setShowMenu(false);
  }

  function openChat(image = null) {
    if (history.length === 0) setChatGreeting(randomGreeting());
    setChatOpen(true);
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
      const answer = formatCoyText(typeof data.answer === "string" && data.answer.trim() ? data.answer.trim() : "…");
      setHistory(previous => [...previous, { role: "assistant", content: answer }].slice(-16));
      setLine(answer);
    } catch (err) {
      setError(err.name === "AbortError" ? "Hold on, I’m busy..." : (err.message === "Failed to fetch" ? randomLine(["Hold on, I’m busy...", "I’m tryna sleep dude."]) : (err.message || "Something went wrong.")));
    } finally {
      setBusy(false);
    }
  }

  function addImageToChat() {
    if (!foundImage?.src) return;
    const image = foundImage;
    setLine(formatCoyText(randomGreeting()));
    hasHeldImage.current = false;
    setFoundImage(null);
    setHoldingImage(false);
    openChat(image);
  }

  const styles = {
    root: { position: "fixed", left: position.left, top: position.top, width: spriteSize, boxSizing: "border-box", zIndex: window.innerWidth <= 700 ? 10 : 2147483000, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, fontFamily: "Tahoma, Arial, sans-serif", pointerEvents: "none" },
    imageButton: { position: "relative", pointerEvents: "auto", display: "block", border: 0, padding: 0, background: "transparent", cursor: "grab", width: spriteSize, touchAction: "none", userSelect: "none", WebkitUserSelect: "none", WebkitUserDrag: "none" },
    image: { display: "block", width: spriteSize, height: "auto", objectFit: "contain", objectPosition: "bottom", filter: "drop-shadow(0 2px 2px rgba(0,0,0,.22))" },
    heldRender: { position: "absolute", left: "50%", top: "58%", width: "38%", height: "auto", maxHeight: "20vh", objectFit: "contain", transform: "translate(-50%,-50%) rotate(-7deg)", border: "3px solid #fff", outline: "1px solid #555", boxShadow: "1px 3px 5px rgba(0,0,0,.35)", borderRadius: 2, pointerEvents: "none", zIndex: 2 },
    bubbleWrap: { position: "absolute", right: 0, bottom: "calc(100% + 8px)", pointerEvents: "auto", width: "min(78vw, 300px)", marginBottom: 0, transformOrigin: "bottom right", animation: "coyBubbleIn 140ms ease-out" },
    bubble: { position: "relative", boxSizing: "border-box", width: "100%", padding: "9px 13px", border: "2px solid #222", borderRadius: 12, background: "#fff", color: "#111", boxShadow: "1px 2px 0 rgba(0,0,0,.18)", fontFamily: "Arial, Helvetica, sans-serif", fontSize: 16, fontWeight: 400, lineHeight: 1.25, overflowWrap: "anywhere", whiteSpace: "pre-wrap" },
    tail: { position: "absolute", right: spriteSize / 2 - 9, bottom: -11, width: 0, height: 0, borderLeft: "9px solid transparent", borderRight: "9px solid transparent", borderTop: "11px solid #222", pointerEvents: "none" },
    tailInner: { position: "absolute", left: -7, top: -11, width: 0, height: 0, borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderTop: "9px solid #fff" },
    form: { display: "flex", gap: 5, marginTop: 8 },
    input: { flex: 1, minWidth: 0, border: "1px solid #777", borderRadius: 2, padding: "7px 8px", fontSize: 13, color: "#111", background: "#fff" },
    button: { border: "1px solid #777", borderRadius: 2, background: "#eee", color: "#111", padding: "5px 9px", fontSize: 12, cursor: "pointer" },
    menu: { pointerEvents: "auto", maxWidth: 240, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, padding: 7, background: "#fff", border: "2px solid #222", borderRadius: 3, boxShadow: "2px 3px 0 rgba(0,0,0,.18)" },
    chat: { pointerEvents: "auto", width: "min(90vw, 410px)", maxHeight: "min(64vh, 560px)", display: "flex", flexDirection: "column", overflow: "hidden", background: "#ece9d8", border: "2px solid #0054e3", boxShadow: "3px 4px 0 rgba(0,0,0,.3)", color: "#111", fontSize: 12 },
    titlebar: { background: "linear-gradient(90deg,#0058e6,#3a93ff)", color: "#fff", fontWeight: "bold", padding: "7px 9px", display: "flex", justifyContent: "space-between", alignItems: "center" },
    messages: { padding: 10, overflowY: "auto", minHeight: 110, maxHeight: 300, background: "#fff", display: "flex", flexDirection: "column", gap: 8 },
    message: { padding: "7px 9px", border: "1px solid #d1d1d1", borderRadius: 3, whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxWidth: "92%" }
  };

  return createPortal(<div ref={rootRef} style={{ ...styles.root, display: hideForMobileApp ? "none" : "flex" }} data-coy-ui="true">
    {!chatOpen && showBubble && <div style={styles.bubbleWrap} role="status" aria-live="polite">
      <button type="button" onClick={() => setShowBubble(false)} aria-label="Dismiss Coy's speech bubble" title="Click to dismiss" style={{ ...styles.bubble, display: "block", textAlign: "left", font: "inherit", cursor: "pointer" }}>{renderCoyEmoji(line)}</button>
      <span aria-hidden="true" style={styles.tail}><i style={styles.tailInner} /></span>
    </div>}

    {showMenu && <div role="menu" aria-label="Coy expressions" style={styles.menu}>
      {EXPRESSIONS.map(([label, text]) => <button key={label} type="button" role="menuitem" onClick={() => { setLine(formatCoyText(text)); setShowBubble(true); setShowMenu(false); }} style={{ ...styles.button, padding: "6px 5px" }}>{label}</button>)}
      
    </div>}
    <button type="button" style={{ ...styles.imageButton, cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onClick={event => { if (dragged.current) { event.preventDefault(); event.stopPropagation(); return; } if (clickTimer.current) window.clearTimeout(clickTimer.current); clickTimer.current = window.setTimeout(() => { clickTimer.current = null; openChat(); }, 230); }} onDoubleClick={() => { if (dragged.current) return; if (clickTimer.current) { window.clearTimeout(clickTimer.current); clickTimer.current = null; } patCoy(); }} onContextMenu={e => { e.preventDefault(); setShowMenu(v => !v); }} aria-label="Coy">
      <img src={COY_SPRITE} alt="Coy" draggable={false} style={styles.image} />
      {holdingImage && foundImage && <img src={foundImage.src} alt="Roblox avatar render Coy is holding" style={styles.heldRender} />
      }
    </button>
  </div>, document.body);
}
