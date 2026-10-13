import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import CoyAvatar3D from "./CoyAvatar3D";

const API_BASE = (process.env.REACT_APP_API_BASE || "https://winxp-7yes.onrender.com").replace(/\/$/, "");
const ROBLOX_DIALOG_ASSET_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "") + "/images/roblox-dialog/";
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
  const [impact, setImpact] = useState(0);
  const [dir, setDir] = useState(1);
  const dirRef = useRef(1);
  const velRef = useRef({ vx: 0 });
  const lookRef = useRef({ x: 0, y: 0 });
  const posRef = useRef({ left: 0, top: 0 });
  const fallRaf = useRef(0);
  const poseTimer = useRef(0);
  // Render Coy at one quarter of the source image width, independent of viewport size.
  const [spriteSize, setSpriteSize] = useState(148);

  const [position, setPosition] = useState(() => ({
    left: Math.max(0, window.innerWidth - 40),
    top: Math.max(0, window.innerHeight - 30 - 40)
  }));
  const lastDesktopReaction = useRef(0);
  posRef.current = position;

  const rootRef = useRef(null);
  const bubbleWrapRef = useRef(null);
  const hasInitialPlacement = useRef(false);
  const wasStandingAligned = useRef(true);
  const standingSurfaceRef = useRef({ kind: "taskbar", minLeft: 0, maxLeft: 0, top: 0, zIndex: -1 });

  // Find the real surface Coy should perch on. Visible XP app title bars take
  // priority over the taskbar; the nearest title bar keeps him on the windows again.
  const getTaskbarTop = () => {
    const taskbar = document.querySelector('[data-xp-taskbar="true"]');
    const rect = taskbar?.getBoundingClientRect();
    return rect && rect.height > 0 ? rect.top : Math.max(0, window.innerHeight - 30);
  };

  const getCoyHeight = () => {
    const root = rootRef.current;
    const canvas = root?.querySelector('canvas[aria-label="Coy"]');
    const rootHeight = root?.getBoundingClientRect().height || 0;
    const canvasHeight = canvas?.getBoundingClientRect().height || 0;
    return rootHeight || canvasHeight || spriteSize;
  };

  const clampValue = (value, min, max) => Math.max(min, Math.min(max, value));

  const getTaskbarSurface = () => {
    const viewportMaxLeft = Math.max(0, window.innerWidth - spriteSize);
    const taskbarTop = getTaskbarTop();
    return {
      kind: "taskbar",
      minLeft: 0,
      maxLeft: viewportMaxLeft,
      top: Math.max(0, taskbarTop - getCoyHeight()),
      zIndex: -1
    };
  };

  const readRect = element => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  };

  // Coy can only use a blue title bar as a platform when his entire width fits
  // on the visible bar. Never let half of him hang over a window edge.
  const getAppbarFitRange = rect => {
    if (!rect || rect.width + 0.5 < spriteSize) return null;
    const viewportMaxLeft = Math.max(0, window.innerWidth - spriteSize);
    const minLeft = Math.max(0, rect.left);
    const maxLeft = Math.min(viewportMaxLeft, rect.right - spriteSize);
    if (maxLeft < minLeft - 0.5) return null;
    return { minLeft, maxLeft: Math.max(minLeft, maxLeft) };
  };

  const getAppbarAnchorRatio = (left, range) =>
    clampValue((left - range.minLeft) / Math.max(1, range.maxLeft - range.minLeft), 0, 1);

  const isVisibleAppbar = (header, windowNode) => {
    if (!header?.isConnected || !windowNode?.isConnected) return false;
    const rect = header.getBoundingClientRect();
    const hs = window.getComputedStyle(header);
    const ws = window.getComputedStyle(windowNode);
    return hs.display !== "none" && hs.visibility !== "hidden" && Number(hs.opacity) !== 0 &&
      ws.display !== "none" && ws.visibility !== "hidden" && Number(ws.opacity) !== 0 &&
      rect.width > 0 && rect.height >= 8 && rect.bottom > 0 && rect.top < window.innerHeight;
  };

  // Only use a title bar when the user releases Coy directly on it. Being near
  // an open app must never pull him away from his taskbar home automatically.
  const findAppbarLanding = (left, top) => {
    const height = getCoyHeight();
    const dropBottomY = top + height;
    const candidates = Array.from(document.querySelectorAll(".app__header"))
      .map(header => {
        const windowNode = header.closest("[data-app-window-id][data-app-title]");
        if (!windowNode || !isVisibleAppbar(header, windowNode)) return null;
        const rect = header.getBoundingClientRect();
        const fitRange = getAppbarFitRange(rect);
        // The whole avatar must fit inside the blue bar at the exact release position.
        if (!fitRange || left < fitRange.minLeft - 0.5 || left > fitRange.maxLeft + 0.5) return null;
        // When a window is near the desktop's top edge, Coy may be clamped
        // to y=0 and his feet can sit slightly above the title bar. Still allow
        // a deliberate drop onto that bar instead of sending him back to taskbar.
        const landingTolerance = Math.max(64, height * 0.45);
        const overlapsVertically = dropBottomY >= rect.top - landingTolerance &&
          top <= rect.bottom + 12;
        if (!overlapsVertically) return null;
        return {
          kind: "appbar",
          minLeft: fitRange.minLeft,
          maxLeft: fitRange.maxLeft,
          top: Math.max(0, rect.top - height),
          anchorRatio: getAppbarAnchorRatio(left, fitRange),
          zIndex: Number.parseInt(window.getComputedStyle(windowNode).zIndex, 10) || 0,
          element: header,
          windowNode,
          headerRect: readRect(header),
          windowRect: readRect(windowNode)
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.zIndex - a.zIndex);
    return candidates[0] || null;
  };

  // A falling Coy can hit a title bar even when the pointer was released far
  // above it. Test the swept vertical interval each physics frame, not just the
  // final pointer-release rectangle.
  const findAppbarCollision = (left, fromTop, toTop, taskbarTop) => {
    const height = getCoyHeight();
    const candidates = Array.from(document.querySelectorAll(".app__header"))
      .map(header => {
        const windowNode = header.closest("[data-app-window-id][data-app-title]");
        if (!windowNode || !isVisibleAppbar(header, windowNode)) return null;
        const rect = header.getBoundingClientRect();
        const fitRange = getAppbarFitRange(rect);
        // Falling past a narrow title bar is not a landing: Coy must fit entirely on it.
        if (!fitRange || left < fitRange.minLeft - 0.5 || left > fitRange.maxLeft + 0.5) return null;
        const landingTop = Math.max(0, rect.top - height);
        // Taskbar is also a solid landing surface. Ignore title bars below it.
        if (landingTop > taskbarTop) return null;
        if (fromTop > landingTop + 0.5 || toTop < landingTop) return null;
        return {
          kind: "appbar",
          minLeft: fitRange.minLeft,
          maxLeft: fitRange.maxLeft,
          top: landingTop,
          anchorRatio: getAppbarAnchorRatio(left, fitRange),
          zIndex: Number.parseInt(window.getComputedStyle(windowNode).zIndex, 10) || 0,
          element: header,
          windowNode,
          headerRect: readRect(header),
          windowRect: readRect(windowNode)
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.top - b.top || b.zIndex - a.zIndex);
    return candidates[0] || null;
  };

  // Coy's home surface is always the taskbar unless he is explicitly dropped
  // onto an app title bar. While perched on a title bar, remember that exact
  // window and fall if it closes, minimizes, moves, or resizes out from under him.
  useEffect(() => {
    let frame = 0;
    const placeCoy = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (!rootRef.current || dragState.current || !wasStandingAligned.current) return;
        // Observe every eligible window and title bar, including windows created
        // after Coy was mounted. A resize can change geometry without a style mutation.
        document.querySelectorAll(".app__header").forEach(header => {
          const windowNode = header.closest("[data-app-window-id][data-app-title]");
          if (windowNode) {
            resizeObserver?.observe(header);
            resizeObserver?.observe(windowNode);
          }
        });
        const current = standingSurfaceRef.current;

        if (current?.kind === "appbar") {
          const header = current.element;
          const windowNode = current.windowNode;
          if (!isVisibleAppbar(header, windowNode)) {
            startFall();
            return;
          }

          // Moving/resizing the window moves the support surface, not Coy off
          // it. Preserve his relative horizontal spot on the title bar and
          // update the standing coordinates to the new header rectangle.
          const rect = header.getBoundingClientRect();
          const fitRange = getAppbarFitRange(rect);
          if (!fitRange) {
            // The window was narrowed or moved so Coy no longer fits; let him fall.
            startFall();
            return;
          }
          const ratio = clampValue(Number.isFinite(current.anchorRatio) ? current.anchorRatio : 0.5, 0, 1);
          const next = {
            left: fitRange.minLeft + (fitRange.maxLeft - fitRange.minLeft) * ratio,
            top: Math.max(0, rect.top - getCoyHeight())
          };
          const updated = {
            ...current,
            minLeft: fitRange.minLeft,
            maxLeft: fitRange.maxLeft,
            top: next.top,
            anchorRatio: getAppbarAnchorRatio(next.left, fitRange),
            headerRect: readRect(header),
            windowRect: readRect(windowNode)
          };
          standingSurfaceRef.current = updated;
          if (Math.abs(next.left - posRef.current.left) > 0.5 ||
              Math.abs(next.top - posRef.current.top) > 0.5) {
            posRef.current = next;
            setPosition(next);
          }
          return;
        }

        // Taskbar is the persistent default. Do not search for nearby app bars.
        const taskbarSurface = getTaskbarSurface();
        standingSurfaceRef.current = taskbarSurface;
        const viewportMaxLeft = Math.max(0, window.innerWidth - spriteSize);
        const next = {
          left: clampValue(posRef.current.left, 0, viewportMaxLeft),
          top: taskbarSurface.top
        };
        if (next.left !== posRef.current.left || next.top !== posRef.current.top) {
          posRef.current = next;
          setPosition(next);
        }
      });
    };

    const taskbar = document.querySelector('[data-xp-taskbar="true"]');
    const root = rootRef.current;
    const canvas = root?.querySelector('canvas[aria-label="Coy"]');
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(placeCoy) : null;
    if (taskbar) resizeObserver?.observe(taskbar);
    if (root) resizeObserver?.observe(root);
    if (canvas) resizeObserver?.observe(canvas);

    const layoutObserver = new MutationObserver(records => {
      const relevant = records.some(record => {
        const target = record.target?.nodeType === 1 ? record.target : record.target?.parentElement;
        return !target?.closest?.('[data-coy-ui="true"]');
      });
      if (relevant) placeCoy();
    });
    layoutObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "data-app-title", "data-app-window-id"]
    });

    // Initial placement is deliberately on the taskbar, even if an app window
    // happens to be open or directly above Coy at startup.
    const placeInitial = () => {
      if (!rootRef.current || hasInitialPlacement.current) return;
      hasInitialPlacement.current = true;
      wasStandingAligned.current = true;
      const surface = getTaskbarSurface();
      standingSurfaceRef.current = surface;
      const next = {
        left: clampValue(posRef.current.left, surface.minLeft, surface.maxLeft),
        top: surface.top
      };
      posRef.current = next;
      setPosition(next);
    };
    placeInitial();
    window.addEventListener("resize", placeCoy);
    window.addEventListener("orientationchange", placeCoy);
    window.visualViewport?.addEventListener("resize", placeCoy);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      layoutObserver.disconnect();
      window.removeEventListener("resize", placeCoy);
      window.removeEventListener("orientationchange", placeCoy);
      window.visualViewport?.removeEventListener("resize", placeCoy);
    };
  }, [spriteSize]);

  // Keep the classic Roblox dialog centered above Coy's head.\n\n


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
  function playEmote(name) { showPose(name, name === "wave" ? 1650 : name === "sit" ? 8000 : 5000); }

  useEffect(() => {
    showPose("wave", 1650);                                    // return to idle just after the 1.5s Roblox clip
    const onMove = e => { lookRef.current.x = e.clientX; lookRef.current.y = e.clientY; };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.clearTimeout(poseTimer.current);
      window.cancelAnimationFrame(fallRaf.current);
    };
  }, []);

  // Occasionally dance or sit on his own when the desktop is quiet.
  // Cancel the timer whenever Coy becomes busy, so he won't interrupt chat or reactions.
  useEffect(() => {
    if (chatOpen || showBubble || busy || underAppWindows || pose !== "idle") return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => {
      if (Math.random() < 0.22) {
        showPose("sit", 6500 + Math.random() * 3500);
      } else {
        const dance = ["dance", "dance2", "dance3"][Math.floor(Math.random() * 3)];
        showPose(dance, 4000 + Math.random() * 2500);
      }
    }, 12000 + Math.random() * 18000);
    return () => window.clearTimeout(timer);
  }, [pose, chatOpen, showBubble, busy, underAppWindows]);

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
      if (!walking || !wasStandingAligned.current) return;

      const surface = standingSurfaceRef.current || getTaskbarSurface();
      const viewportMaxLeft = Math.max(0, window.innerWidth - spriteSize);
      const minLeft = clampValue(Number.isFinite(surface.minLeft) ? surface.minLeft : 0, 0, viewportMaxLeft);
      const maxLeft = clampValue(
        Number.isFinite(surface.maxLeft) ? surface.maxLeft : viewportMaxLeft,
        minLeft,
        viewportMaxLeft
      );
      let left = posRef.current.left + dirRef.current * 55 * dt;
      if (left < minLeft || left > maxLeft) {
        if (surface.kind === "appbar") {
          // Walking off a window title bar is a real edge: step to its rim,
          // then fall to the taskbar instead of turning around unnaturally.
          left = clampValue(left, minLeft, maxLeft);
          const next = { left, top: Number.isFinite(surface.top) ? surface.top : posRef.current.top };
          posRef.current = next;
          setPosition(next);
          startFall();
          return;
        }
        // The taskbar is his home platform, so its screen edges turn him around.
        left = clampValue(left, minLeft, maxLeft);
        dirRef.current *= -1;
        setDir(dirRef.current);
      }
      if (surface.kind === "appbar" && surface.element?.isConnected) {
        const rect = surface.element.getBoundingClientRect();
        const fitRange = getAppbarFitRange(rect);
        if (!fitRange) {
          startFall();
          return;
        }
        left = clampValue(left, fitRange.minLeft, fitRange.maxLeft);
        standingSurfaceRef.current = {
          ...surface,
          minLeft: fitRange.minLeft,
          maxLeft: fitRange.maxLeft,
          anchorRatio: getAppbarAnchorRatio(left, fitRange),
          top: Math.max(0, rect.top - getCoyHeight()),
          headerRect: readRect(surface.element),
          windowRect: readRect(surface.windowNode)
        };
      }
      const activeSurface = standingSurfaceRef.current || surface;
      const next = {
        left,
        top: Number.isFinite(activeSurface.top) ? activeSurface.top : posRef.current.top
      };
      posRef.current = next;
      setPosition(next);
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [pose, chatOpen, showBubble, busy, underAppWindows, spriteSize]);


  function startFall() {
    window.cancelAnimationFrame(fallRaf.current);
    const maxTop = Math.max(0, getTaskbarTop() - getCoyHeight());
    let top = posRef.current.top;
    wasStandingAligned.current = false;
    if (maxTop - top < 3) {
      const landed = {
        left: clampValue(posRef.current.left, 0, Math.max(0, window.innerWidth - spriteSize)),
        top: maxTop
      };
      posRef.current = landed;
      setPosition(landed);
      standingSurfaceRef.current = getTaskbarSurface();
      standingSurfaceRef.current.top = maxTop;
      wasStandingAligned.current = true;
      setPose("idle");
      return;
    }
    // Throw: keep the sideways speed from just before release (zero if the pointer paused).
    const fresh = performance.now() - (velRef.current.t || 0) < 80;
    let vx = fresh ? Math.max(-1500, Math.min(1500, velRef.current.vx)) : 0;
    velRef.current.vx = 0;
    let left = posRef.current.left;
    const maxLeft = Math.max(0, window.innerWidth - spriteSize);
    let vy = 0, last = performance.now();
    setPose("fall");
    const startTop = top;
    const landOn = (surface, landingLeft) => {
      const viewportMaxLeft = Math.max(0, window.innerWidth - spriteSize);
      const nextLeft = surface.kind === "appbar"
        ? clampValue(surface.minLeft + (surface.maxLeft - surface.minLeft) * surface.anchorRatio, surface.minLeft, surface.maxLeft)
        : clampValue(landingLeft, 0, viewportMaxLeft);
      const landed = { left: nextLeft, top: surface.top };
      posRef.current = landed;
      setPosition(landed);
      standingSurfaceRef.current = surface;
      wasStandingAligned.current = true;
      // Preserve the downward speed at the exact collision frame so the landing
      // squash reflects how hard Coy hit the surface.
      setImpact(Math.max(0, vy));
      showPose("land", 520);
    };
    const step = now => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      vy += 1800 * dt;
      const previousTop = top;
      const nextTop = top + vy * dt;
      left += vx * dt;
      if (left < 0 || left > maxLeft) { left = Math.max(0, Math.min(maxLeft, left)); vx *= -0.5; }  // bounce off the edges
      const appbar = findAppbarCollision(left, previousTop, nextTop, maxTop);
      if (appbar) {
        landOn(appbar, left);
        return;
      }
      top = nextTop;
      if (top >= maxTop) {
        landOn({ ...getTaskbarSurface(), top: maxTop, kind: "taskbar" }, left);
        return;
      }
      posRef.current = { left, top };
      setPosition(posRef.current);
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
    wasStandingAligned.current = false;
    const maxLeft = Math.max(0, window.innerWidth - spriteSize);
    const taskbarTop = getTaskbarTop();
    // Let Coy be dragged over app title bars; only landing logic decides whether
    // he perches on a bar or falls back to the taskbar.
    const maxTop = Math.max(0, window.innerHeight - getCoyHeight());
    const next = {
      left: Math.max(0, Math.min(maxLeft, drag.originLeft + dx)),
      top: Math.max(0, Math.min(maxTop, drag.originTop + dy))
    };
    posRef.current = next;
    setPosition(next);
  }

  function onCoyPointerUp(event) {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      suppressClickAfterDrag.current = true;
      window.setTimeout(() => { suppressClickAfterDrag.current = false; }, 0);
      const maxLeft = Math.max(0, window.innerWidth - spriteSize);
      // Do not clamp to the taskbar while dragging: that made title bars above
      // the taskbar impossible to reach with the pointer.
      const maxTop = Math.max(0, window.innerHeight - getCoyHeight());
      const released = {
        left: Math.max(0, Math.min(maxLeft, drag.originLeft + (event.clientX - drag.startX))),
        top: Math.max(0, Math.min(maxTop, drag.originTop + (event.clientY - drag.startY)))
      };
      posRef.current = released;
      setPosition(released);
      const appbar = findAppbarLanding(released.left, released.top);
      if (appbar) {
        const perched = {
          left: clampValue(
            appbar.minLeft + (appbar.maxLeft - appbar.minLeft) * appbar.anchorRatio,
            appbar.minLeft,
            appbar.maxLeft
          ),
          top: appbar.top
        };
        posRef.current = perched;
        setPosition(perched);
        standingSurfaceRef.current = appbar;
        wasStandingAligned.current = true;
        setImpact(0); // A gentle landing when released directly onto a title bar.
        showPose("land", 520);
      } else {
        wasStandingAligned.current = false;
        startFall();
      }
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
    // Single-click pats; double-click opens the chat. Delay the pat just
    // long enough to distinguish a double-click, and cancel it if the second click arrives.
    if (clickTimer.current) {
      window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
      openChat();
    } else {
      clickTimer.current = window.setTimeout(() => {
        clickTimer.current = null;
        // A single click pats Coy; the pat pose restores his little squish.
        showPose("pat", 650);
        setLine(formatCoyText(randomLine(PAT_LINES)));
        setShowBubble(true);
        lastActivity.current = Date.now();
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
    const emote = message.toLowerCase().replace(/\s+/g, " ").match(/^\/e (wave|sit|dance)\s?([123])?$/);
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
      if (!response.ok) throw new Error(data.error || ("Chat failed (HTTP " + response.status + ")"));
      if (!data || typeof data !== "object") throw new Error("Invalid chat response");
      const answer = typeof data.answer === "string" ? data.answer.trim() : "";
      if (answer) {
        setHistory(h => [...h, { role: "assistant", content: answer }]);
        setLine(formatCoyText(answer));
        setShowBubble(true);
      }
    } catch (err) {
      console.error("Coy chat request failed:", err);
      setLine("Can’t reach me rn.. sowwy");
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
      zIndex: chatOpen ? 10001 : underAppWindows ? 0 : 9999,
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
    // Original 2013 Roblox ChatGreen textures downloaded into public during prebuild.
    // Authentic 2013 dialog textures, positioned close to the head and sized like
    // the original compact balloon rather than the large UGC item thumbnail.
    bubbleWrap: {
      position: "absolute",
      // The sprite sheet's 64px square corners stay intact; only its middle
      // stretches with the text. The tail sits behind the frame at the bottom.
      left: "50%",
      bottom: "calc(100% + 10px)",
      transform: "translateX(-50%)",
      width: "max-content",
      minWidth: 64,
      maxWidth: "min(236px, calc(100vw - 20px))",
      height: "auto",
      overflow: "visible",
      pointerEvents: "none",
      zIndex: 3
    },
    dialogBody: {
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxSizing: "border-box",
      width: "max-content",
      minWidth: 64,
      maxWidth: "min(236px, calc(100vw - 20px))",
      minHeight: 56,
      border: "8px solid transparent",
      // Preserve the original 2013 green border/corners and stretch only the
      // dark-green center, rather than resizing the entire square texture.
      borderImageSource: `url(${ROBLOX_DIALOG_ASSET_BASE}chatBubble_botGreen_bkg.png)`,
      borderImageSlice: "12 fill",
      borderImageWidth: "8px",
      borderImageRepeat: "stretch",
      zIndex: 1
    },
    dialogTail: {
      position: "absolute",
      // Layer the tail over the background/frame so its base covers the
      // border where the arrow joins the bubble, avoiding a connecting seam.
      left: "50%",
      top: "calc(100% - 10px)",
      width: 32,
      height: 32,
      transform: "translateX(-50%)",
      objectFit: "contain",
      display: "block",
      pointerEvents: "none",
      zIndex: 2
    },
    dialogText: {
      position: "relative",
      display: "-webkit-box",
      WebkitBoxOrient: "vertical",
      WebkitLineClamp: 4,
      width: "max-content",
      minWidth: 32,
      maxWidth: 208,
      boxSizing: "border-box",
      padding: "3px 4px 2px",
      overflow: "hidden",
      color: "#fff",
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: 13,
      fontWeight: 600,
      lineHeight: "15px",
      textAlign: "center",
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
      wordBreak: "normal",
      textShadow: "none",
      pointerEvents: "none"
    },
    chatBox: {
      position: "absolute",
      bottom: "100%",
      marginBottom: 12,
      left: "50%",
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
        style={{ position: "relative", display: "block", width: spriteSize, height: getCoyHeight(), background: "transparent", border: 0, outline: "none", padding: 0, margin: 0, overflow: "visible", cursor: "grab", touchAction: "none", pointerEvents: "auto" }}
      >
        <CoyAvatar3D size={spriteSize} pose={pose} dir={dir} vx={velRef.current.vx} impact={impact} look={lookRef.current} getPos={() => ({ x: posRef.current.left, y: posRef.current.top })} />
      </button>

      <button
        type="button"
        aria-label="Open Coy chat"
        title="Chat with Coy"
        onClick={event => { event.stopPropagation(); openChat(); }}
        style={{
          position: "absolute",
          left: spriteSize - 5,
          top: Math.round(spriteSize * 0.38),
          width: 30,
          height: 30,
          padding: 0,
          border: 0,
          background: "transparent",
          cursor: "pointer",
          pointerEvents: "auto",
          display: pose === "wave" ? "none" : "block",
          zIndex: 4
        }}
        onMouseEnter={event => {
          const image = event.currentTarget.querySelector("img");
          if (image) image.src = "https://archive.roblonium.com/Client/Windows/RobloxStudio/main%20%28roblox.com%29/2013/1.2013/January%2017%20%282013.1.16.4%29/version-bff7a07361c84c3c/content/textures/Chat_ovr.png";
        }}
        onMouseLeave={event => {
          const image = event.currentTarget.querySelector("img");
          if (image) image.src = "https://archive.roblonium.com/Client/Windows/RobloxStudio/main%20%28roblox.com%29/2013/1.2013/January%2017%20%282013.1.16.4%29/version-bff7a07361c84c3c/content/textures/Chat_ds.png";
        }}
      >
        <img
          src="https://archive.roblonium.com/Client/Windows/RobloxStudio/main%20%28roblox.com%29/2013/1.2013/January%2017%20%282013.1.16.4%29/version-bff7a07361c84c3c/content/textures/Chat_ds.png"
          alt=""
          draggable={false}
          style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
        />
      </button>

      {showBubble && (
        <div ref={bubbleWrapRef} style={styles.bubbleWrap}>
          <img
            src={ROBLOX_DIALOG_ASSET_BASE + "chatBubble_botGreen_tail.png"}
            alt=""
            aria-hidden="true"
            draggable={false}
            style={styles.dialogTail}
          />
          <div style={styles.dialogBody}>
            <div style={styles.dialogText}>{renderCoyLine(line)}</div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
