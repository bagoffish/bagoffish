import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const API_BASE = (process.env.REACT_APP_API_BASE || "https://bloxify-backend-sg.onrender.com").replace(/\/$/, "");
const COY_SPRITE = (process.env.PUBLIC_URL || "").replace(/\/$/, "") + "/images/coy.png";
const GREETINGS = ["Sup", "Hi", "Hello", "Haii", "Hai", "Yo", "Hey"];
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


async function fetchAiQuip(context) {
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 4500);
    const response = await fetch(API_BASE + "/personal-ai/chat", {
      signal: controller.signal,
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        message: "Reply as Coy in one short natural chat message (under 40 characters if possible). Context: " + context + ". Do not ask a question unless it fits. No quotes, no labels.",
        history: [],
        websiteContext: { source: "companion-bubble" }
      })
    });
    window.clearTimeout(timer);
    if (!response.ok) return null;
    const data = await response.json().catch(() => ({}));
    const answer = typeof data.answer === "string" ? data.answer.trim() : "";
    if (!answer || answer.length > 80) return null;
    return answer;
  } catch (_) {
    return null;
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
      if (now - lastActivity.current < 18000) return;
      lastActivity.current = now;
      if (detail.type === "app-open") {
        const options = APP_QUIPS[detail.name] || [
          "Oh " + (detail.name || "an app"),
          "Whatcha doing",
          "Ooh"
        ];
        const fallback = randomLine(options);
        announce(fallback);
        if (Math.random() < 0.45) {
          fetchAiQuip("User just opened the " + (detail.name || "an app") + " app on the desktop").then(ai => {
            if (ai) announce(ai);
          });
        }
      } else if (detail.type === "music") announce("music is playing.");
      else if (detail.type === "error") announce("looks like something went wrong.");
      else if (detail.type === "image" && detail.src && !hasHeldImage.current && now - lastPickupAttempt.current > 30000 && Math.random() <= 0.1) {
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
      if (justPickedUp) {
        const fallback = randomLine(PICKUP_LINES);
        setLine(formatCoyText(fallback));
        setShowBubble(true);
        if (Math.random() < 0.4) {
          fetchAiQuip("User just picked up and started dragging Coy around the desktop. React short.").then(ai => {
            if (ai) {
              setLine(formatCoyText(ai));
              setShowBubble(true);
            }
          });
        }
      }
    }
    if (!state.movedCharacter) return;

    // Keep the wrapper's starting dimensions for the entire gesture. Measuring
    // it again mid-drag made the character jump when its speech bubble changed.
    const maxRight = Math.max(8, window.innerWidth - state.width - 8);
    // Match the real taskbar edge. Coy may be dragged all the way down until
    // his feet touch the taskbar; never impose the old 56px artificial gap.
    const coyHeight = state.height || getCoyHeight();
    const maxBottom = Math.max(0, getTaskbarTop() - coyHeight);
    const nextTop = Math.max(0, Math.min(maxBottom, state.top + deltaY));
    wasTaskbarAligned.current = Math.abs(nextTop - maxBottom) <= 1;
    setPosition({
      left: Math.max(0, Math.min(maxRight, state.left + deltaX)),
      top: nextTop
    });
  }

  function endDrag() {
    const state = dragState.current;
    dragState.current = null;
    setIsDragging(false);
    window.setTimeout(() => { dragged.current = false; }, 250);
  }

  function patCoy() {
    const fallback = randomLine(PAT_LINES);
    setLine(formatCoyText(fallback));
    setShowBubble(true);
    if (Math.random() < 0.55) {
      fetchAiQuip("User just headpatted Coy (double-click). React short and natural, a little soft or playful.").then(ai => {
        if (ai) {
          setLine(formatCoyText(ai));
          setShowBubble(true);
        }
      });
    }
  }

  function openChat(image = null) {
    if (history.length === 0) setChatGreeting(randomGreeting());
    setChatOpen(true);
    setShowBubble(false);
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
      const requestTimeout = window.setTimeout(() => controller.abort(), 90000);
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
      if (!response.ok) throw new Error(data.error || "I’m tryna sleep dude.");
      const answer = formatCoyText(typeof data.answer === "string" && data.answer.trim() ? data.answer.trim() : "…");
      setHistory(previous => [...previous, { role: "assistant", content: answer }].slice(-16));
      setLine(answer);
    } catch (err) {
      setError(err.name === "AbortError" ? "Hold on, I’m busy..." : (err.message === "Failed to fetch" ? randomLine(["I’m tryna sleep dude.", "I’m tryna sleep dude."]) : (err.message || "Something went wrong.")));
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

  // Coy has one base sprite, so idle moods use restrained body language while
  // the speech bubble changes naturally. No manual expression menu is needed.
  const idleMoodStyles = {
    normal: { filter: "drop-shadow(0 2px 2px rgba(0,0,0,.22))" },
    curious: { filter: "drop-shadow(0 2px 2px rgba(0,0,0,.22))" },
    happy: { filter: "drop-shadow(0 2px 3px rgba(0,0,0,.2)) brightness(1.025)" },
    sleepy: { filter: "drop-shadow(0 2px 2px rgba(0,0,0,.22)) brightness(.96)" },
    surprised: { filter: "drop-shadow(0 2px 2px rgba(0,0,0,.22)) brightness(1.035)" },
    annoyed: { filter: "drop-shadow(0 2px 2px rgba(0,0,0,.22)) saturate(.92)" }
  };

  useEffect(() => {
    const moods = ["normal", "curious", "happy", "sleepy", "surprised", "annoyed"];
    let timer;
    const scheduleMood = () => {
      timer = window.setTimeout(() => {
        setIdleMood(moods[Math.floor(Math.random() * moods.length)]);
        scheduleMood();
      }, 9000 + Math.random() * 17000);
    };
    scheduleMood();
    return () => window.clearTimeout(timer);
  }, []);

  const styles = {
    root: { position: "fixed", left: position.left, top: position.top, width: spriteSize, boxSizing: "border-box", zIndex: 2147483000, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, fontFamily: "Tahoma, Arial, sans-serif", pointerEvents: "none" },
    imageButton: { position: "relative", pointerEvents: "auto", display: "block", border: 0, padding: 0, background: "transparent", cursor: "grab", width: spriteSize, touchAction: "none", userSelect: "none", WebkitUserSelect: "none", WebkitUserDrag: "none" },
    image: { display: "block", width: spriteSize, height: "auto", objectFit: "contain", objectPosition: "bottom", filter: "drop-shadow(0 2px 2px rgba(0,0,0,.22))", transition: "filter 450ms ease" },
    heldRender: { position: "absolute", left: "50%", top: "58%", width: "38%", height: "auto", maxHeight: "20vh", objectFit: "contain", transform: "translate(-50%,-50%) rotate(-7deg)", border: "3px solid #fff", outline: "1px solid #555", boxShadow: "1px 3px 5px rgba(0,0,0,.35)", borderRadius: 2, pointerEvents: "none", zIndex: 2 },
    bubbleWrap: { position: "absolute", left: bubblePlacement.left, bottom: "calc(100% - 70px)", pointerEvents: "auto", width: "max-content", maxWidth: "min(92vw, 280px)", minWidth: 110, marginBottom: 0, transform: bubblePlacement.transform, transformOrigin: "center center", animation: "coyBubbleIn 160ms ease-out", cursor: "default", filter: "drop-shadow(2px 2px 0 rgba(0,0,0,.6))" },
    bubbleFrame: { position: "relative", background: "#0a0a0a", border: "1px solid #00ff41", borderRadius: 0, fontFamily: "Consolas, 'Courier New', monospace", padding: 0 },
    bubbleTitle: { display: "none" },
    bubbleTitleText: { display: "none" },
    bubbleClose: { position: "absolute", top: 2, right: 4, width: 12, height: 12, border: 0, background: "transparent", color: "#00aa00", fontSize: 10, lineHeight: "12px", textAlign: "center", cursor: "pointer", padding: 0, zIndex: 2 },
    bubble: { position: "relative", boxSizing: "border-box", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 6, width: "max-content", minWidth: 90, maxWidth: "min(88vw, 260px)", maxHeight: 100, padding: "8px 12px", background: "#0a0a0a", color: "#00ff41", fontSize: 13, fontWeight: 400, lineHeight: "18px", overflow: "hidden", overflowWrap: "break-word", wordBreak: "normal", whiteSpace: "pre-wrap", textShadow: "0 0 2px #00ff41" },
    tail: bubblePlacement.side === "right"
      ? { position: "absolute", left: -10, top: "50%", transform: "translateY(-50%)", width: 0, height: 0, borderTop: "8px solid transparent", borderBottom: "8px solid transparent", borderRight: "10px solid #00ff41", pointerEvents: "none", zIndex: 1 }
      : { position: "absolute", right: -10, top: "50%", transform: "translateY(-50%)", width: 0, height: 0, borderTop: "8px solid transparent", borderBottom: "8px solid transparent", borderLeft: "10px solid #00ff41", pointerEvents: "none", zIndex: 1 },
    tailInner: bubblePlacement.side === "right"
      ? { position: "absolute", left: 2, top: -6, width: 0, height: 0, borderTop: "6px solid transparent", borderBottom: "6px solid transparent", borderRight: "8px solid #0a0a0a" }
      : { position: "absolute", right: 2, top: -6, width: 0, height: 0, borderTop: "6px solid transparent", borderBottom: "6px solid transparent", borderLeft: "8px solid #0a0a0a" },
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
    {(showBubble || busy) && <div
      ref={bubbleWrapRef}
      style={styles.bubbleWrap}
      role={busy ? "status" : "dialog"}
      tabIndex={-1}
      aria-label={busy ? "Coy is typing" : "Coy speech balloon"}
      aria-live="polite"
    >
      <div style={styles.bubbleFrame}>
        <div style={styles.bubbleTitle}>
          <span style={styles.bubbleTitleText}>Coy</span>
          <button type="button" style={styles.bubbleClose} aria-label="Close balloon" onClick={event => { event.stopPropagation(); setShowBubble(false); }}>×</button>
        </div>
        <div style={{ ...styles.bubble, textAlign: "left" }}>{busy ? "Typing..." : renderCoyEmoji(line)}</div>
      </div>
      <span aria-hidden="true" style={styles.tail}><i style={styles.tailInner} /></span>
    </div>}

    <button type="button" style={{ ...styles.imageButton, cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onClick={event => { if (dragged.current) { event.preventDefault(); event.stopPropagation(); return; } if (clickTimer.current) window.clearTimeout(clickTimer.current); clickTimer.current = window.setTimeout(() => { clickTimer.current = null; openChat(); }, 230); }} onDoubleClick={() => { if (dragged.current) return; if (clickTimer.current) { window.clearTimeout(clickTimer.current); clickTimer.current = null; } patCoy(); }} aria-label="Coy">
      <img src={COY_SPRITE} alt="Coy" draggable={false} onLoad={event => { const nativeWidth = event.currentTarget.naturalWidth; if (nativeWidth > 0) setSpriteSize(Math.max(1, nativeWidth / 4)); }} style={{ ...styles.image, ...idleMoodStyles[idleMood] }} />
      {holdingImage && foundImage && <img src={foundImage.src} alt="Roblox avatar render Coy is holding" style={styles.heldRender} />
      }
    </button>
  </div>, document.body);
}
