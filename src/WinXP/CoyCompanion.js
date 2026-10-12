import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import CoyAvatar3D from "./CoyAvatar3D";

const API_BASE = (process.env.REACT_APP_API_BASE || "https://fossils.onrender.com").replace(/\/$/, "");
const GREETINGS = ["Sup", "Hi", "Haii", "Hai", "Hey", "Heyy", "Hii", "Yo!"];
const randomGreeting = () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
const PAT_LINES = ["Hehe..", "Eek!", ":3c", "Again..!", "Thank you.."];
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
  ? <img key={index} src="/images/ono.png" onError={event => { event.currentTarget.replaceWith(document.createTextNode("😬")); }} alt="nervous, awkward, or startled" title="Nervous / awkward / startled" style={{ width: "1.6em", height: "1.6em", objectFit: "contain", verticalAlign: "-0.3em", display: "inline-block" }} />
  : part);


function renderCoyLine(value) {
  const lines = String(value ?? "").split("\n");
  return lines.map((line, index) => {
    const heading = line.match(/^#\s+(.+)$/);
    return <React.Fragment key={index}>
      {heading
        ? <span style={{ fontSize: "1.6em", fontWeight: "bold" }}>{renderCoyEmoji(heading[1])}</span>
        : renderCoyEmoji(line)}
      {index < lines.length - 1 ? "\n" : ""}
    </React.Fragment>;
  });
}

const formatCoyText = value => {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
};

const COY_APP_ALIASES = {
  "about": "About Me", "about me": "About Me", "profile": "About Me",
  "letters": "Winter_Letter", "winter letter": "Winter_Letter", "winterletter": "Winter_Letter",
  "poem": "Poems", "poems": "Poems",
  "renderer": "Renderer", "roblox renderer": "Renderer", "avatar renderer": "Renderer",
  "bloxify": "Bloxify", "music ai": "Bloxify", "music generator": "Bloxify",
  "paint": "Paint", "ms paint": "Paint", "minesweeper": "Minesweeper",
  "mine sweeper": "Minesweeper", "winamp": "Winamp", "music player": "Winamp",
  "coy": "Coy", "coy chat": "Coy"
};

function parseCoyRequestedAction(message) {
  let text = String(message || "").trim()
    .replace(/^(?:hey\s+coy[,! ]*|coy[,! ]*)/i, "")
    .replace(/^(?:(?:please|kindly)\s+|(?:can|could|would|will)\s+you\s+(?:(?:please)\s+)?|i\s+(?:want|need)\s+you\s+to\s+)/i, "")
    .trim();
  const clean = value => String(value || "").trim().replace(/^["']|["']$/g, "")
    .replace(/[.!?]+$/, "").replace(/\s+(?:for me|please|thanks|thank you)$/i, "").trim();
  const appName = value => COY_APP_ALIASES[clean(value).toLowerCase()
    .replace(/[_-]+/g, " ").replace(/\s+(?:app|window)$/i, "").replace(/\s+/g, " ")] || null;

  // One message can both open Renderer and run its search.
  let match = text.match(/^(?:open|launch|start|show)\s+(?:the\s+)?(?:roblox\s+|avatar\s+)?renderer(?:\s+app|\s+window)?\s+(?:and|then)\s+(?:look\s+up|lookup|search(?:\s+for)?|find)\s+(.+?)[.!?]*$/i);
  if (match) return { action: "search", name: "Renderer", target: "search", value: clean(match[1]) };
  match = text.match(/^(?:look\s+up|lookup|find|search(?:\s+for)?)\s+(.+?)\s+in\s+(?:the\s+)?(.+?)[.!?]*$/i);
  if (match) {
    const name = appName(match[2]);
    if (name) return { action: "search", name, target: "search", value: clean(match[1]).replace(/^for\s+/i, "") };
  }
  match = text.match(/^(click|press)\s+(?:on\s+)?(?:the\s+)?(.+?)\s+(?:button\s+)?in\s+(?:the\s+)?(.+?)[.!?]*$/i);
  if (match) {
    const name = appName(match[3]);
    if (name && match[1].toLowerCase() === "click") return { action: "click", name, target: clean(match[2]).replace(/\s+button$/i, "") };
    if (name && match[1].toLowerCase() === "press") return { action: "press", name, key: clean(match[2]) };
  }
  match = text.match(/^(?:type|enter)\s+(.+?)\s+into\s+(?:the\s+)?(.+?)\s+in\s+(?:the\s+)?(.+?)[.!?]*$/i);
  if (match) {
    const name = appName(match[3]);
    if (name) return { action: "fill", name, value: clean(match[1]), target: clean(match[2]) };
  }
  match = text.match(/^(open|launch|start|show|focus|switch to|maximize|minimize|restore|close|hide)(?:\s+up)?\s+(?:the\s+)?(.+?)[.!?]*$/i);
  if (match) {
    const name = appName(clean(match[2]));
    if (name) {
      const word = match[1].toLowerCase();
      return { action: ["launch", "start"].includes(word) ? "open" : ["show", "switch to"].includes(word) ? "focus" : word === "hide" ? "minimize" : word, name };
    }
  }
  // Generic lookups happen inside this site's Renderer app, never in a new browser tab.
  match = text.match(/^(?:look\s+up|lookup|search\s+for|find|search)\s+(.+?)[.!?]*$/i);
  if (match) return { action: "search", name: "Renderer", target: "search", value: clean(match[1]) };
  return null;
}

function executeCoyRequestedAction(action) {
  if (!action) return;
  const eventName = ["click", "fill", "search", "press"].includes(action.action)
    ? "coy:app-action" : "coy:desktop-action";
  window.dispatchEvent(new CustomEvent(eventName, { detail: action }));
}

export default function CoyCompanion() {
  const [showBubble, setShowBubble] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [underAppWindows, setUnderAppWindows] = useState(false);
  const [line, setLine] = useState("");
  const [chatGreeting, setChatGreeting] = useState(randomGreeting);
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState(() => readCompanionChatCookie());
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const lastActivity = useRef(0);
  const openAppsRef = useRef([]);
  const fullTabActiveRef = useRef(false);
  const clickTimer = useRef(null);
  const dragState = useRef(null);
  const suppressClickAfterDrag = useRef(false);
  // 3D avatar state: pose drives the R6 animation, the refs feed it without re-rendering.
  const [pose, setPose] = useState("wave");
  const [dir, setDir] = useState(1);
  const dirRef = useRef(1);
  const velRef = useRef({ vx: 0 });
  const lookRef = useRef({ x: 0, y: 0 });
  const posRef = useRef({ left: 0, top: 0 });
  const fallRaf = useRef(0);
  const poseTimer = useRef(0);
  // Render Coy at one quarter of the source image width, independent of viewport size.
  const [spriteSize, setSpriteSize] = useState(92);

  const [position, setPosition] = useState(() => ({
    left: Math.max(0, window.innerWidth - 40),
    top: Math.max(0, window.innerHeight - 30 - 40)
  }));
  const lastDesktopReaction = useRef(0);
  posRef.current = position;

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
    const readingTime = Math.min(14000, Math.max(5000, 3000 + line.length * 50));
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
    // Keep Coy out of the way of maximized apps on desktop, and behind open
    // app windows on mobile (where windows fill the usable screen).
    const syncMobileAppVisibility = () => {
      const isMobile = window.matchMedia("(max-width: 700px)").matches;
      const visibleAppHeader = Array.from(document.querySelectorAll(".app__header"))
        .some(header => {
          const rect = header.getBoundingClientRect();
          const style = getComputedStyle(header);
          return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
        });
      const fullscreenSurface = Boolean(document.fullscreenElement) ||
        document.body.classList.contains("app-fullscreen") ||
        document.body.classList.contains("fullscreen");
      const hasOpenApp = openAppsRef.current.length > 0 || visibleAppHeader;
      setUnderAppWindows((isMobile && hasOpenApp) || (!isMobile && (fullTabActiveRef.current || fullscreenSurface)));
    };
    const onActivity = event => {
      const detail = event.detail || {};
      if (detail.type !== "app-state") return;
      openAppsRef.current = Array.isArray(detail.openApps) ? detail.openApps : [];
      fullTabActiveRef.current = Boolean(detail.fullTabActive);
      syncMobileAppVisibility();
    };
    const onCoyAppAction = event => {
      const detail = event.detail || {};
      if (String(detail.action || "").toLowerCase() !== "search") return;
      const target = String(detail.value || "").trim();
      if (!/^(?:https?:\/\/www\.roblox\.com\/users\/)?37753591(?:\/profile)?\/?$/i.test(target)) return;
      setLine("Searching me up?");
      setShowBubble(true);
      lastActivity.current = Date.now();
    };
    window.addEventListener("coy:activity", onActivity);
    window.addEventListener("coy:app-action", onCoyAppAction);
    // Keep the companion state correct if the viewport rotates/resizes, and
    // catch the initial app-state event even if it fired before this listener.
    const onResize = syncMobileAppVisibility;
    window.addEventListener("resize", onResize);
    document.addEventListener("fullscreenchange", onResize);
    const appWindowObserver = new MutationObserver(syncMobileAppVisibility);
    appWindowObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "data-app-title"] });
    syncMobileAppVisibility();
    window.dispatchEvent(new CustomEvent("coy:request-app-state"));

    return () => {
      window.removeEventListener("coy:activity", onActivity);
      window.removeEventListener("coy:app-action", onCoyAppAction);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("fullscreenchange", onResize);
      window.removeEventListener("coy:close-chat", onCloseChat);
      appWindowObserver.disconnect();
    };
  }, []);

  // Coy occasionally comments on desktop controls, media, and app-window activity.
  useEffect(() => {
    const onDesktopClick = event => {
      const target = event.target?.closest?.('button, [role="button"], [data-app-title], .app__header, .desktop-icon, audio, video, canvas');
      if (!target || target.closest('[data-coy-ui="true"]')) return;
      const tag = String(target.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag) || target.isContentEditable) return;
      const now = Date.now();
      if (now - lastDesktopReaction.current < 14000 || now - lastActivity.current < 9000 || Math.random() > 0.24) return;
      lastDesktopReaction.current = now;
      lastActivity.current = now;
      const label = String(target.getAttribute('aria-label') || target.getAttribute('title') || target.getAttribute('data-app-title') || target.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 48);
      const media = tag === 'audio' || tag === 'video';
      const windowControl = target.matches('.app__header') || Boolean(target.closest('.app-window, [data-app-title]'));
      const lines = media ? ["oh, media", "what are we watching", "lemme listen"]
        : windowControl ? ["moving windows around?", "which window now", "desktop's busy today"]
        : label ? ["oh, " + label, "what's that", "hm, clicking around"]
        : ["what was that", "hm?", "you clicked something"];
      setLine(formatCoyText(randomLine(lines)));
      setShowBubble(true);
    };
    document.addEventListener('click', onDesktopClick, true);
    return () => document.removeEventListener('click', onDesktopClick, true);
  }, []);

  // ---- 3D avatar behaviour: wave on load, wander the taskbar, pick-up and fall ----
  function showPose(name, ms) {
    window.clearTimeout(poseTimer.current);
    setPose(name);
    poseTimer.current = window.setTimeout(() => setPose("idle"), ms);
  }
  function playEmote(name) { showPose(name, name === "wave" ? 2600 : 5000); }

  useEffect(() => {
    showPose("wave", 2600);                                    // greets the visitor
    const onMove = e => { lookRef.current.x = e.clientX; lookRef.current.y = e.clientY; };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.clearTimeout(poseTimer.current);
      window.cancelAnimationFrame(fallRaf.current);
    };
  }, []);

  useEffect(() => {
    if (chatOpen || showBubble || busy || underAppWindows) return;
    if (pose !== "idle" && pose !== "walk") return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, last = performance.now(), walking = pose === "walk";
    let until = last + (walking ? 2000 + Math.random() * 4000 : 1500 + Math.random() * 3500);
    const step = now => {
      raf = window.requestAnimationFrame(step);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (now > until) {
        if (walking) { setPose("idle"); return; }
        dirRef.current = Math.random() < 0.5 ? -1 : 1;
        setDir(dirRef.current);
        setPose("walk");
        return;
      }
      if (walking && wasTaskbarAligned.current) {
        const maxLeft = Math.max(0, window.innerWidth - spriteSize);
        let left = posRef.current.left + dirRef.current * 55 * dt;
        if (left < 0 || left > maxLeft) {
          left = Math.min(Math.max(left, 0), maxLeft);
          dirRef.current *= -1;
          setDir(dirRef.current);
        }
        setPosition(p => ({ left, top: p.top }));
      }
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [pose, chatOpen, showBubble, busy, underAppWindows, spriteSize]);

  function startFall() {
    window.cancelAnimationFrame(fallRaf.current);
    const maxTop = Math.max(0, getTaskbarTop() - getCoyHeight());
    let top = posRef.current.top;
    if (maxTop - top < 3) { wasTaskbarAligned.current = true; setPose("idle"); return; }
    // Throw: keep the sideways speed from just before release (zero if the pointer paused).
    const fresh = performance.now() - (velRef.current.t || 0) < 80;
    let vx = fresh ? Math.max(-1500, Math.min(1500, velRef.current.vx)) : 0;
    velRef.current.vx = 0;
    let left = posRef.current.left;
    const maxLeft = Math.max(0, window.innerWidth - spriteSize);
    let vy = 0, last = performance.now();
    setPose("fall");
    const step = now => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      vy += 1800 * dt;
      top += vy * dt;
      left += vx * dt;
      if (left < 0 || left > maxLeft) { left = Math.max(0, Math.min(maxLeft, left)); vx *= -0.5; }  // bounce off the edges
      if (top >= maxTop) {
        wasTaskbarAligned.current = true;
        setPosition({ left, top: maxTop });
        if (vy > 700) showPose("land", 350); else setPose("idle");
        return;
      }
      setPosition({ left, top });
      fallRaf.current = window.requestAnimationFrame(step);
    };
    fallRaf.current = window.requestAnimationFrame(step);
  }

  function onCoyPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: position.left,
      originTop: position.top,
      moved: false
    };
    suppressClickAfterDrag.current = false;
    window.cancelAnimationFrame(fallRaf.current);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) {}
  }

  function onCoyPointerMove(event) {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    if (!drag.moved) { window.clearTimeout(poseTimer.current); setPose("held"); }
    drag.moved = true;
    velRef.current.vx = (event.movementX || 0) * 24 + velRef.current.vx * 0.6;
    velRef.current.t = performance.now();
    suppressClickAfterDrag.current = true;
    wasTaskbarAligned.current = false;
    const maxLeft = Math.max(0, window.innerWidth - spriteSize);
    const taskbarTop = getTaskbarTop();
    const maxTop = Math.max(0, taskbarTop - getCoyHeight());
    setPosition({
      left: Math.max(0, Math.min(maxLeft, drag.originLeft + dx)),
      top: Math.max(0, Math.min(maxTop, drag.originTop + dy))
    });
  }

  function onCoyPointerUp(event) {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      suppressClickAfterDrag.current = true;
      // Keep the click suppression through the browser's synthesized click.
      window.setTimeout(() => { suppressClickAfterDrag.current = false; }, 0);
      startFall();
    }
    dragState.current = null;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch (_) {}
  }

  function onCoyClick() {
    if (suppressClickAfterDrag.current) {
      suppressClickAfterDrag.current = false;
      return;
    }
    // A single click opens chat; a double click is a simple headpat reaction.
    if (clickTimer.current) {
      window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
      setLine(formatCoyText(randomLine(PAT_LINES)));
      setShowBubble(true);
      showPose("pat", 1200);
    } else {
      clickTimer.current = window.setTimeout(() => {
        clickTimer.current = null;
        openChat();
      }, 280);
    }
  }

  function openChat() {
    window.dispatchEvent(new CustomEvent("coy:open-chat"));
  }

  async function send(event, overrideMessage) {
    if (event && event.preventDefault) event.preventDefault();
    const message = (overrideMessage || draft).trim();
    if (!message || busy) return;
    const emote = message.toLowerCase().replace(/\s+/g, " ").match(/^\/e (wave|dance)\s?([123])?$/);
    if (emote) {                                   // /e wave, /e dance, /e dance2, /e dance 3
      setDraft("");
      playEmote(emote[1] === "dance" && emote[2] && emote[2] !== "1" ? "dance" + emote[2] : emote[1]);
      return;
    }
    setDraft("");
    setBusy(true);
    const nextHistory = [...history, { role: "user", content: message }];
    setHistory(nextHistory);
    // Execute clear desktop/app requests from the floating Coy chat too. The
    // in-window Coy app and companion should share the same practical behavior.
    try { executeCoyRequestedAction(parseCoyRequestedAction(message)); } catch (_) {}
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
      setLine("Busy rn.. Hold on");
      setShowBubble(true);
    } finally {
      setBusy(false);
    }
  }

  const styles = {
    root: {
      position: "fixed",
      left: position.left,
      top: position.top,
      zIndex: chatOpen ? 10001 : underAppWindows ? 0 : 1,
      visibility: underAppWindows && !chatOpen ? "hidden" : "visible",
      pointerEvents: "none",
      userSelect: "none",
      touchAction: "none"
    },
    sprite: {
      width: spriteSize,
      height: "auto",
      display: "block",
      cursor: "pointer",
      pointerEvents: "auto",
      // Keep Coy completely still until custom expression sprites are added.
      filter: "none",
      animation: "none",
      transform: "none"
    },
    bubbleWrap: {
      position: "absolute",
      top: "2%",
      marginBottom: 0,
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
      maxHeight: 110,
      padding: "8px 12px",
      background: "#0a0a0a",
      border: "2px solid #00ff41",
      borderRadius: 0,
      color: "#00ff41",
      fontSize: 13,
      fontWeight: 400,
      lineHeight: "18px",
      overflow: "visible",
      overflowWrap: "break-word",
      wordBreak: "normal",
      whiteSpace: "pre-wrap",
      textShadow: "0 0 2px #00ff41",
      fontFamily: "Consolas, 'Courier New', monospace"
    },
    // Outer green triangle = border; inner black triangle = fill. Points at Coy.
    tail: bubblePlacement.side === "right"
      ? { position: "absolute", left: -12, top: "50%", transform: "translateY(-50%)", width: 0, height: 0, borderTop: "10px solid transparent", borderBottom: "10px solid transparent", borderRight: "12px solid #00ff41", pointerEvents: "none", zIndex: 1 }
      : { position: "absolute", right: -12, top: "50%", transform: "translateY(-50%)", width: 0, height: 0, borderTop: "10px solid transparent", borderBottom: "10px solid transparent", borderLeft: "12px solid #00ff41", pointerEvents: "none", zIndex: 1 },
    tailInner: bubblePlacement.side === "right"
      ? { position: "absolute", left: -8, top: "50%", transform: "translateY(-50%)", width: 0, height: 0, borderTop: "7px solid transparent", borderBottom: "7px solid transparent", borderRight: "9px solid #0a0a0a", pointerEvents: "none", zIndex: 2 }
      : { position: "absolute", right: -8, top: "50%", transform: "translateY(-50%)", width: 0, height: 0, borderTop: "7px solid transparent", borderBottom: "7px solid transparent", borderLeft: "9px solid #0a0a0a", pointerEvents: "none", zIndex: 2 },
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

  return createPortal(
    <div ref={rootRef} style={styles.root} data-coy-ui="true">
      <button
        type="button"
        aria-label="Coy companion"
        onClick={onCoyClick}
        onPointerDown={onCoyPointerDown}
        onPointerMove={onCoyPointerMove}
        onPointerUp={onCoyPointerUp}
        onPointerCancel={onCoyPointerUp}
        style={{ background: "none", border: "none", padding: 0, margin: 0, cursor: "grab", touchAction: "none", pointerEvents: "auto" }}
      >
        <CoyAvatar3D size={spriteSize} pose={pose} dir={dir} vx={velRef.current.vx} look={lookRef.current} getPos={() => posRef.current} />
      </button>

      {showBubble && (
        <div ref={bubbleWrapRef} style={styles.bubbleWrap}>
          <div style={styles.bubble}>
            {renderCoyLine(line)}
            <div style={styles.tail} />
            <div style={styles.tailInner} />
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
