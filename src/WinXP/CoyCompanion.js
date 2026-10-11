import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const API_BASE = (process.env.REACT_APP_API_BASE || "https://bloxify-backend-sg.onrender.com").replace(/\/$/, "");
const COY_SPRITE = (process.env.PUBLIC_URL || "").replace(/\/$/, "") + "/images/coy.png";
const GREETINGS = ["Sup", "Hru", "Hi", "Hello", "Haii", "Hai", "Hey", "Heyy", "Hii", "Haiii"];
const randomGreeting = () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
const PICKUP_LINES = [
  "Where we going",
  "Oh you moving me",
  "Okay okay",
  "Eep",
  "Put me down somewhere nice",
  "Relocating huh"
];
const PAT_LINES = [
  "Hehe",
  "Again?",
  "Heyy",
  "Messing up my hair",
  "Hm",
  "Didn't expect that",
  "Okay you can stay",
  "Eep"
];
const APP_QUIPS = {
  Winamp: ["Oh music", "What we listening to", "Song time", "Ooh"],
  Renderer: ["Looking someone up?", "Avatar check", "Who's that", "Found the account?"],
  Bloxify: ["Making music again", "Songmaking", "Cooking something", "Ooh music stuff"],
  Winter_Letter: ["Back to Winter Letter", "Writing time", "Winter Letter again"],
  Paint: ["Drawing something", "Art time", "Whatcha making"],
  Minesweeper: ["Good luck", "Don't explode", "Minesweeper time"]
};
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


async function fetchAiQuip(context, openApps = [], recentHistory = []) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 6000);
  try {
    const apps = openApps.length ? "Open apps: " + openApps.join(", ") + ". " : "";
    const response = await fetch(API_BASE + "/personal-ai/chat", {
      signal: controller.signal,
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        message: "You are Coy on the desktop. Reply in ONE short natural message (under 40 chars preferred, max 70). React to this: " + apps + context + ". Match your real Discord style. No quotes, no labels, no question marks unless rare.",
        history: recentHistory.slice(-6),
        websiteContext: { source: "companion-bubble", openApps }
      })
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => ({}));
    const answer = typeof data.answer === "string" ? data.answer.trim() : "";
    if (!answer || answer.length > 90) return null;
    return answer;
  } catch (_) {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

const formatCoyText = value => {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
};

export default function CoyCompanion() {
  const [showBubble, setShowBubble] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [hideForMobileApp, setHideForMobileApp] = useState(false);
  const [line, setLine] = useState(randomGreeting);
  const [idleMood, setIdleMood] = useState("normal");
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
  // Render Coy at one quarter of the source image width, independent of viewport size.
  const [spriteSize, setSpriteSize] = useState(76);

  const [position, setPosition] = useState(() => ({
    left: Math.max(0, window.innerWidth - 40),
    top: Math.max(0, window.innerHeight - 30 - 40)
  }));
  const [isDragging, setIsDragging] = useState(false);
  const rootRef = useRef(null);
  const bubbleWrapRef = useRef(null);
  const [bubblePlacement, setBubblePlacement] = useState({ left: "50%", arrowLeft: "50%", transform: "translateX(-50%)" });
  const hasInitialPlacement = useRef(false);
  const wasTaskbarAligned = useRef(true);

  // Select the actual XP shell taskbar, never an unrelated footer inside an app.
  const getTaskbarTop = () => {
    const taskbar = document.querySelector('[data-xp-taskbar="true"]');
    const rect = taskbar?.getBoundingClientRect();
    return rect && rect.height > 0 ? rect.top : Math.max(0, window.innerHeight - 30);
  };

  const getCoyHeight = () => {
    const root = rootRef.current;
    const sprite = root?.querySelector('img[alt="Coy"]');
    const rootHeight = root?.getBoundingClientRect().height || 0;
    const spriteHeight = sprite?.getBoundingClientRect().height ||
      (sprite?.naturalWidth && sprite?.naturalHeight
        ? spriteSize * sprite.naturalHeight / sprite.naturalWidth
        : 0);
    return rootHeight || spriteHeight || spriteSize;
  };

  // Align Coy's wrapper bottom to the measured top edge of the real taskbar.
  // There is no guessed gap and no generic footer selector.
  useEffect(() => {
    let frame = 0;
    const placeCoy = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (!rootRef.current) return;
        const taskbarTop = getTaskbarTop();
        const coyHeight = getCoyHeight();
        const maxLeft = Math.max(0, window.innerWidth - spriteSize);
        const exactTop = Math.max(0, taskbarTop - coyHeight);

        setPosition(previous => {
          if (!hasInitialPlacement.current) {
            hasInitialPlacement.current = true;
            wasTaskbarAligned.current = true;
            return { left: maxLeft, top: exactTop };
          }
          const left = Math.max(0, Math.min(maxLeft, previous.left));
          const stayedAtTaskbar = wasTaskbarAligned.current ||
            Math.abs(previous.top - exactTop) <= 2;
          const top = stayedAtTaskbar ? exactTop : Math.max(0, Math.min(exactTop, previous.top));
          wasTaskbarAligned.current = Math.abs(top - exactTop) <= 1;
          return left === previous.left && top === previous.top ? previous : { left, top };
        });
      });
    };

    placeCoy();
    const taskbar = document.querySelector('[data-xp-taskbar="true"]');
    const root = rootRef.current;
    const sprite = root?.querySelector('img[alt="Coy"]');
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(placeCoy) : null;
    if (taskbar) observer?.observe(taskbar);
    if (root) observer?.observe(root);
    if (sprite) {
      observer?.observe(sprite);
      sprite.addEventListener("load", placeCoy);
    }
    window.addEventListener("resize", placeCoy);
    window.addEventListener("orientationchange", placeCoy);
    window.visualViewport?.addEventListener("resize", placeCoy);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      sprite?.removeEventListener("load", placeCoy);
      window.removeEventListener("resize", placeCoy);
      window.removeEventListener("orientationchange", placeCoy);
      window.visualViewport?.removeEventListener("resize", placeCoy);
    };
  }, [spriteSize]);

  // Place the balloon on the side opposite Coy so it never clips off-screen.
  // Coy on the left half → balloon to the right of Coy.
  // Coy on the right half → balloon to the left of Coy.
  // Tail points back toward Coy from whichever side the balloon sits.
  useEffect(() => {
    const placeBubble = () => {
      const root = rootRef.current;
      const bubble = bubbleWrapRef.current;
      if (!root || !bubble) return;
      const bubbleWidth = bubble.getBoundingClientRect().width;
      if (!bubbleWidth) return;
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const margin = 8;
      const coyCenter = position.left + spriteSize / 2;
      const coyOnLeft = coyCenter < viewportWidth / 2;

      let bubbleLeft;
      if (coyOnLeft) {
        // Balloon to the right of Coy
        bubbleLeft = position.left + spriteSize + 12;
        if (bubbleLeft + bubbleWidth > viewportWidth - margin) {
          bubbleLeft = Math.max(margin, viewportWidth - bubbleWidth - margin);
        }
      } else {
        // Balloon to the left of Coy
        bubbleLeft = position.left - bubbleWidth - 12;
        if (bubbleLeft < margin) {
          bubbleLeft = margin;
        }
      }

      // side: "right" means balloon is to the right of Coy (tail on left edge)
      // side: "left" means balloon is to the left of Coy (tail on right edge)
      setBubblePlacement({
        left: bubbleLeft - position.left,
        side: coyOnLeft ? "right" : "left",
        transform: "none"
      });
    };
    placeBubble();
    window.addEventListener("resize", placeBubble);
    window.visualViewport?.addEventListener("resize", placeBubble);
    return () => {
      window.removeEventListener("resize", placeBubble);
      window.visualViewport?.removeEventListener("resize", placeBubble);
    };
  }, [position.left, spriteSize, line, showBubble, busy, chatOpen]);

  useEffect(() => {
    if (!showBubble || busy) return undefined;
    // Give longer lines more reading time, but don't leave a bubble hanging around.
    const readingTime = Math.min(9000, Math.max(2200, 1400 + line.length * 55));
    const timer = window.setTimeout(() => setShowBubble(false), readingTime);
    return () => window.clearTimeout(timer);
  }, [showBubble, busy, line]);

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
    // Coy stays visible and interactive above app windows on every viewport.
    const syncMobileAppVisibility = () => setHideForMobileApp(false);
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
      if (now - lastActivity.current < 12000) return;
      lastActivity.current = now;
      if (detail.type === "app-open") {
        const name = detail.name || "an app";
        const options = APP_QUIPS[name] || ["Oh " + name, "Whatcha doing", "Ooh"];
        const fallback = randomLine(options);
        const context = "User just opened the " + name + " app";
        fetchAiQuip(context, openAppsRef.current, history).then(ai => {
          announce(ai || fallback);
        }).catch(() => announce(fallback));
      } else if (detail.type === "music") {
        const context = detail.title ? "Music started: " + detail.title : "Music is playing";
        fetchAiQuip(context, openAppsRef.current, history).then(ai => announce(ai || "Music time"));
      } else if (detail.type === "error") {
        fetchAiQuip("Something went wrong on the desktop", openAppsRef.current, history).then(ai => announce(ai || "Looks like something broke"));
      } else if (detail.type === "app-event") {
        const context = (detail.name || "App") + ": " + (detail.event || detail.message || "something happened");
        fetchAiQuip(context, openAppsRef.current, history).then(ai => { if (ai) announce(ai); });
      } else if (detail.type === "image" && detail.src && !hasHeldImage.current && now - lastPickupAttempt.current > 30000 && Math.random() <= 0.1) {
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
      if (!candidates.length || Math.random() > 0.1) return;
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
      const justPickedUp = !state.movedCharacter;
      state.movedCharacter = true;
      dragged.current = true;
      setIsDragging(true);
      if (justPickedUp && Date.now() - lastPickupAttempt.current > 8000) {
        lastPickupAttempt.current = Date.now();
        const fallback = randomLine(PICKUP_LINES);
        fetchAiQuip("User just picked up and started dragging Coy around the desktop. React short.").then(ai => {
          setLine(formatCoyText(ai || fallback));
          setShowBubble(true);
        }).catch(() => {
          setLine(formatCoyText(fallback));
          setShowBubble(true);
        });
      }
      const maxLeft = Math.max(0, window.innerWidth - state.width);
      const taskbarTop = getTaskbarTop();
      const maxTop = Math.max(0, taskbarTop - state.height);
      setPosition({
        left: Math.max(0, Math.min(maxLeft, state.left + deltaX)),
        top: Math.max(0, Math.min(maxTop, state.top + deltaY))
      });
      wasTaskbarAligned.current = false;
    }
  }

  function endDrag(event) {
    if (!dragState.current) return;
    event.currentTarget.releasePointerCapture?.(dragState.current.pointerId);
    const wasDrag = dragState.current.movedCharacter;
    dragState.current = null;
    setIsDragging(false);
    if (!wasDrag) {
      // Double-click for headpat
      if (clickTimer.current) {
        window.clearTimeout(clickTimer.current);
        clickTimer.current = null;
        const fallback = randomLine(PAT_LINES);
        fetchAiQuip("User just headpatted Coy (double-click). React short and natural, a little soft or playful.").then(ai => {
          setLine(formatCoyText(ai || fallback));
          setShowBubble(true);
          setIdleMood("happy");
          window.setTimeout(() => setIdleMood("normal"), 1800);
        }).catch(() => {
          setLine(formatCoyText(fallback));
          setShowBubble(true);
        });
      } else {
        clickTimer.current = window.setTimeout(() => {
          clickTimer.current = null;
          openChat();
        }, 280);
      }
    }
  }

  function openChat() {
    setChatOpen(true);
    setChatGreeting(randomGreeting());
    setShowBubble(false);
    window.dispatchEvent(new CustomEvent("coy:open-chat"));
  }

  async function send(event, overrideMessage) {
    if (event && event.preventDefault) event.preventDefault();
    const message = (overrideMessage || draft).trim();
    if (!message || busy) return;
    setDraft("");
    setBusy(true);
    setError("");
    const nextHistory = [...history, { role: "user", content: message }];
    setHistory(nextHistory);
    try {
      const response = await fetch(API_BASE + "/personal-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          message,
          history: nextHistory.slice(-8),
          websiteContext: { source: "companion-chat", openApps: openAppsRef.current }
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Chat failed");
      const answer = typeof data.answer === "string" ? data.answer.trim() : "";
      if (answer) {
        setHistory(h => [...h, { role: "assistant", content: answer }]);
        setLine(formatCoyText(answer));
        setShowBubble(true);
      }
    } catch (err) {
      setError(err.message || "Couldn't reach Coy");
    } finally {
      setBusy(false);
    }
  }

  const styles = {
    root: {
      position: "fixed",
      left: position.left,
      top: position.top,
      zIndex: 9999,
      pointerEvents: "none",
      userSelect: "none",
      touchAction: "none"
    },
    sprite: {
      width: spriteSize,
      height: "auto",
      display: "block",
      cursor: isDragging ? "grabbing" : "grab",
      pointerEvents: "auto",
      filter: idleMood === "happy" ? "brightness(1.08)" : "none",
      transition: "filter 0.2s"
    },
    bubbleWrap: {
      position: "absolute",
      bottom: "100%",
      marginBottom: 8,
      left: bubblePlacement.left,
      transform: bubblePlacement.transform,
      pointerEvents: "auto",
      zIndex: 1
    },
    bubble: {
      position: "relative",
      boxSizing: "border-box",
      display: "-webkit-box",
      WebkitBoxOrient: "vertical",
      WebkitLineClamp: 6,
      width: "max-content",
      minWidth: 90,
      maxWidth: "min(88vw, 260px)",
      maxHeight: 100,
      padding: "8px 12px",
      background: "#0a0a0a",
      borderRadius: 0,
      color: "#00ff41",
      fontSize: 13,
      fontWeight: 400,
      lineHeight: "18px",
      overflow: "hidden",
      overflowWrap: "break-word",
      wordBreak: "normal",
      whiteSpace: "pre-wrap",
      textShadow: "0 0 2px #00ff41",
      fontFamily: "Consolas, 'Courier New', monospace"
    },
    tail: bubblePlacement.side === "right"
      ? { position: "absolute", left: -10, top: "50%", transform: "translateY(-50%)", width: 0, height: 0, borderTop: "8px solid transparent", borderBottom: "8px solid transparent", borderRight: "10px solid #00ff41", pointerEvents: "none", zIndex: 1 }
      : { position: "absolute", right: -10, top: "50%", transform: "translateY(-50%)", width: 0, height: 0, borderTop: "8px solid transparent", borderBottom: "8px solid transparent", borderLeft: "10px solid #00ff41", pointerEvents: "none", zIndex: 1 },
    tailInner: bubblePlacement.side === "right"
      ? { position: "absolute", left: 2, top: -6, width: 0, height: 0, borderTop: "6px solid transparent", borderBottom: "6px solid transparent", borderRight: "8px solid #0a0a0a" }
      : { position: "absolute", right: 2, top: -6, width: 0, height: 0, borderTop: "6px solid transparent", borderBottom: "6px solid transparent", borderLeft: "8px solid #0a0a0a" },
    chatBox: {
      position: "absolute",
      bottom: "100%",
      marginBottom: 12,
      left: bubblePlacement.left,
      width: 240,
      background: "#ece9d8",
      border: "2px solid #000",
      padding: 8,
      font: "12px Tahoma, Arial, sans-serif",
      zIndex: 2,
      pointerEvents: "auto"
    },
    heldRender: {
      position: "absolute",
      bottom: spriteSize * 0.6,
      left: spriteSize * 0.15,
      width: spriteSize * 0.7,
      height: "auto",
      border: "1px solid #666",
      background: "#fff",
      pointerEvents: "none"
    }
  };

  if (hideForMobileApp) return null;

  return createPortal(
    <div ref={rootRef} style={styles.root} data-coy-ui="true">
      <button
        type="button"
        aria-label="Coy companion"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ background: "none", border: "none", padding: 0, margin: 0, cursor: "inherit" }}
      >
        <img src={COY_SPRITE} alt="Coy" style={styles.sprite} />
        {holdingImage && foundImage && <img src={foundImage.src} alt="Roblox avatar render Coy is holding" style={styles.heldRender} />}
      </button>

      {showBubble && !chatOpen && (
        <div ref={bubbleWrapRef} style={styles.bubbleWrap}>
          <div style={styles.bubble}>
            {renderCoyEmoji(line)}
            <div style={styles.tail} />
            <div style={styles.tailInner} />
          </div>
        </div>
      )}

      {chatOpen && (
        <div style={styles.chatBox}>
          {error && <div style={{ color: "#c00", fontSize: 11, marginBottom: 4 }}>{error}</div>}
          <form onSubmit={send} style={{ display: "flex", gap: 4 }}>
            <input
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="say something..."
              style={{ flex: 1, font: "12px Tahoma", padding: "3px 5px", border: "1px solid #7f9db9" }}
              disabled={busy}
            />
            <button type="submit" disabled={busy || !draft.trim()} style={{ font: "12px Tahoma", padding: "3px 8px" }}>{busy ? "…" : ">"}</button>
          </form>
          <button type="button" onClick={() => setChatOpen(false)} style={{ marginTop: 4, font: "11px Tahoma" }}>Close</button>
        </div>
      )}

      {showBubble && chatOpen && (
        <div ref={bubbleWrapRef} style={{ ...styles.bubbleWrap, bottom: "calc(100% + 70px)" }}>
          <div style={styles.bubble}>
            {renderCoyEmoji(line)}
            <div style={styles.tail} />
            <div style={styles.tailInner} />
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
