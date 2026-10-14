import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import CoyAvatar3D from "./CoyAvatar3D";

const API_BASE = (process.env.REACT_APP_API_BASE || "https://fossils.onrender.com").replace(/\/$/, "");
const ROBLOX_DIALOG_ASSET_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "") + "/images/roblox-dialog/";
const GREETINGS = ["Sup", "Hi", "Haii", "Hai", "Hey", "Heyy", "Hii", "Yo!"];
const randomGreeting = () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
const randomLine = lines => lines[Math.floor(Math.random() * lines.length)];

// ---- Coy's autonomous behaviour (tune here) ----
const ACTION_MIN_MS = 18000;      // less frequent random actions: sword / sit / grapple
const ACTION_MAX_MS = 32000;
const WALL_CONTACT_PX = 14;       // how far his body centre hangs off the wall while climbing
const CLIMB_SPEED = 85;           // px/s
const HOOK_TRAVEL_S = 0.7;        // keep the travelling hook visible long enough to follow
const WALL_ROPE_REACH = 560;      // farthest wall he will fire at, px
const lerp = (a, b, k) => a + (b - a) * k;
const easeInOut = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
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
  const [avatarReady, setAvatarReady] = useState(false);
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
  const gearHeldRef = useRef(false);
  // Autonomous grapple / climb routines. grappleRef is shared with the avatar: while
  // active, the arm aims at (ax, ay) and the avatar writes the muzzle position to (mx, my).
  const grappleRef = useRef({ active: false, ax: 0, ay: 0, mx: NaN, my: NaN, travel: 0 });
  const actionRef = useRef(null);
  const actionsRef = useRef({});
  const poseRef = useRef("wave");
  const uiRef = useRef({});
  const lastPointerAt = useRef(0);
  const ropeSvgRef = useRef(null);
  const ropeLineRef = useRef(null);
  const ropeRaf = useRef(0);
  // Render Coy at one quarter of the source image width, independent of viewport size.
  const [spriteSize, setSpriteSize] = useState(148);

  const [position, setPosition] = useState(() => ({
    left: Math.max(0, window.innerWidth - 40),
    top: Math.max(0, window.innerHeight - 30 - 40)
  }));
  const lastDesktopReaction = useRef(0);
  posRef.current = position;
  poseRef.current = pose;
  uiRef.current = { chatOpen, busy, underAppWindows };

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
        // A bar too close to the viewport top cannot support Coy without clipping him.
        if (rect.top < height) return null;
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
        // A title bar above Coy cannot be used as a platform; keep falling to the taskbar.
        if (rect.top < height) return null;
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
          if (rect.top < getCoyHeight() || !fitRange) {
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
    poseRef.current = name;
    setPose(name);
    poseTimer.current = window.setTimeout(() => {
      const nextPose = gearHeldRef.current ? "gearhold" : "idle";
      poseRef.current = nextPose;
      setPose(nextPose);
    }, ms);
  }

  function startSwordAction(move, duration) {
    window.clearTimeout(poseTimer.current);
    poseRef.current = "swordequip";
    setPose("swordequip");
    poseTimer.current = window.setTimeout(() => {
      if (poseRef.current === "swordequip") showPose(move, duration);
    }, 300);
  }

  // Developer console test hooks for checking every custom and imported move.
  useEffect(() => {
    const names = ["idle", "wave", "dance", "dance2", "dance3", "walk", "swordslash", "swordlunge", "gearhold", "grapple", "climbing", "fall", "sit"];  // plus coyMoves.wall(), .cursor(), .random()
    const durations = { swordslash: 900, swordlunge: 900, grapple: 2100, climbing: 3500, gearhold: 2500, wave: 1800, dance: 4500, dance2: 4500, dance3: 4500 };
    const api = {
      moves: names,
      play(name, ms) {
        const move = String(name || "").toLowerCase();
        if (!names.includes(move)) { console.warn("Unknown Coy move. Available:", names.join(", ")); return false; }
        const duration = Math.max(250, Number(ms) || durations[move] || 1800);
        if (move === "swordslash" || move === "swordlunge") startSwordAction(move, duration);
        else showPose(move, duration);
        console.info("Coy move:", move);
        if (move === "gearhold") gearHeldRef.current = true;
        if (move === "swordslash" || move === "swordlunge") gearHeldRef.current = false;
        return true;
      },
      // Keep the grapple gun equipped between shots. gearhold is the idle pose
      // while equipped; releaseGear() returns Coy to his normal idle/wandering.
      holdGear() {
        gearHeldRef.current = true;
        window.clearTimeout(poseTimer.current);
        poseRef.current = "gearhold";
        setPose("gearhold");
        console.info("Coy is holding the grapple gun. Use coyMoves.play('grapple') to shoot, or coyMoves.releaseGear() to put it away.");
        return true;
      },
      releaseGear() {
        gearHeldRef.current = false;
        window.clearTimeout(poseTimer.current);
        poseRef.current = "idle";
        setPose("idle");
        return true;
      },
      grappleGear(mode) {
        if (!["grapple+gun", "grapplegun"].includes(String(mode || "").toLowerCase())) {
          console.warn("Choose 'grapple+gun' or 'grapplegun'.");
          return false;
        }
        window.__coyGear = { ...window.__coyGear, mode: String(mode).toLowerCase() };
        return true;
      },
      stop() {
        actionsRef.current.cancel?.();
        window.clearTimeout(poseTimer.current);
        const nextPose = gearHeldRef.current ? "gearhold" : "idle";
        poseRef.current = nextPose;
        setPose(nextPose);
      },
      // Run the real autonomous routines on demand. side: "left" | "right" | undefined (any).
      wall(side) { const ok = actionsRef.current.wall?.(side); if (!ok) console.warn("Coy: no wall in reach" + (side ? " on the " + side : "")); return Boolean(ok); },
      cursor() { const ok = actionsRef.current.cursor?.(true); if (!ok) console.warn("Coy: move the mouse first (and keep it away from him, above the taskbar)"); return Boolean(ok); },
      random() { actionsRef.current.random?.(); return true; },
      async demo() {
        const sequence = ["wave", "dance", "dance2", "dance3", "swordslash", "swordlunge", "gearhold", "grapple", "climbing"];
        for (const move of sequence) {
          if (!window.coyMoves || window.coyMoves !== api) return;
          api.play(move, durations[move] || 2200);
          const equipDelay = move === "swordslash" || move === "swordlunge" ? 300 : 0;
          await new Promise(resolve => window.setTimeout(resolve, (durations[move] || 2200) + equipDelay + 180));
        }
        api.stop();
      }
    };
    window.coyMoves = api;
    return () => { if (window.coyMoves === api) delete window.coyMoves; };
  }, []);
  useEffect(() => {
    // Start the greeting only when the real avatar is ready to appear.
    if (avatarReady) showPose("wave", 1650);
  }, [avatarReady]);

  useEffect(() => {
    const onMove = e => { lookRef.current.x = e.clientX; lookRef.current.y = e.clientY; if (e.pointerType !== "touch") lastPointerAt.current = Date.now(); };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.clearTimeout(poseTimer.current);
      window.cancelAnimationFrame(fallRaf.current);
      window.cancelAnimationFrame(ropeRaf.current);
    };
  }, []);

  // Every few seconds Coy picks something to do on his own: swing the sword, sit down, or
  // grapple (onto a wall he then climbs, or onto the mouse cursor). This is one long-lived
  // timer. The old version restarted its countdown every time he toggled idle <-> walk, which
  // happens every few seconds, so the countdown almost never finished and he rarely did anything.
  useEffect(() => {
    let timer = 0, dead = false;
    const reduced = () => Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const schedule = ms => { timer = window.setTimeout(fire, ms); };
    const fire = () => {
      if (dead) return;
      const ui = uiRef.current;
      const ready = !ui.chatOpen && !ui.busy && !ui.underAppWindows && !reduced() && !document.hidden &&
        !actionRef.current && !dragState.current && wasStandingAligned.current &&
        (poseRef.current === "idle" || poseRef.current === "walk");
      if (!ready) { schedule(1500 + Math.random() * 1500); return; }
      try { actionsRef.current.random?.(); } catch (e) { console.warn("Coy action failed", e); }
      schedule(ACTION_MIN_MS + Math.random() * (ACTION_MAX_MS - ACTION_MIN_MS));
    };
    schedule(4500 + Math.random() * 3500);
    return () => { dead = true; window.clearTimeout(timer); actionsRef.current.cancel?.(); };
  }, []);

  useEffect(() => {
    // Speech bubbles are visual only: they must not pause Coy's autonomous walking.
    if (chatOpen || busy || underAppWindows) return;
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
      poseRef.current = gearHeldRef.current ? "gearhold" : "idle";
      setPose(poseRef.current);
      return;
    }
    // Throw: keep the sideways speed from just before release (zero if the pointer paused).
    const fresh = performance.now() - (velRef.current.t || 0) < 80;
    let vx = fresh ? Math.max(-1500, Math.min(1500, velRef.current.vx)) : 0;
    velRef.current.vx = 0;
    let left = posRef.current.left;
    const maxLeft = Math.max(0, window.innerWidth - spriteSize);
    // He may let go while hanging half off a screen-edge wall; don't snap him back in.
    let loL = Math.min(0, left), hiL = Math.max(maxLeft, left);
    let vy = 0, last = performance.now();
    poseRef.current = "fall";
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
      if (left >= 0) loL = 0;
      if (left <= maxLeft) hiL = maxLeft;
      if (left < loL || left > hiL) { left = Math.max(loL, Math.min(hiL, left)); vx *= -0.5; }  // bounce off the edges
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


  // ======================= autonomous routines =======================

  function moveTo(left, top) {
    const next = { left, top };
    posRef.current = next;
    setPosition(next);
  }

  // ---- rope overlay: drawn on screen, so it can reach a wall far outside his canvas ----
  function drawRope() {
    ropeRaf.current = 0;
    const g = grappleRef.current, svg = ropeSvgRef.current;
    if (!svg) return;
    if (!g.active) { svg.style.display = "none"; return; }
    const W = spriteSize, H = getCoyHeight();
    const mx = Number.isFinite(g.mx) ? g.mx : posRef.current.left + W * 0.5;
    const my = Number.isFinite(g.my) ? g.my : posRef.current.top + H * 0.42;
    const k = easeInOut(Math.max(0, Math.min(1, g.travel)));
    const hx = Number.isFinite(g.hx) ? g.hx : lerp(mx, g.ax, k);
    const hy = Number.isFinite(g.hy) ? g.hy : lerp(my, g.ay, k);
    const line = ropeLineRef.current;
    if (line) {
      line.setAttribute("x1", mx); line.setAttribute("y1", my);
      line.setAttribute("x2", hx); line.setAttribute("y2", hy);
    }
    svg.style.display = "block";
    ropeRaf.current = window.requestAnimationFrame(drawRope);
  }
  function showRope(ax, ay) {
    const g = grappleRef.current;
    g.ax = ax; g.ay = ay; g.travel = 0; g.mx = NaN; g.my = NaN; g.hx = NaN; g.hy = NaN; g.active = true;
    if (!ropeRaf.current) ropeRaf.current = window.requestAnimationFrame(drawRope);
  }
  function hideRope() {
    grappleRef.current.active = false;
    grappleRef.current.hx = NaN; grappleRef.current.hy = NaN;
    if (ropeSvgRef.current) ropeSvgRef.current.style.display = "none";
  }

  // ---- routine plumbing ----
  function beginAction(name) {
    cancelAction();
    const token = { name, cancelled: false, raf: 0 };
    actionRef.current = token;
    window.cancelAnimationFrame(fallRaf.current);
    window.clearTimeout(poseTimer.current);
    wasStandingAligned.current = false;           // placement/walk logic must leave him alone
    return token;
  }
  function cancelAction() {
    const a = actionRef.current;
    if (!a) return;
    a.cancelled = true;
    window.cancelAnimationFrame(a.raf);
    actionRef.current = null;
    hideRope();
  }
  function runLoop(token, step) {
    let last = performance.now();
    const tick = now => {
      if (token.cancelled) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      let done = false;
      try { done = step(dt); } catch (e) { console.warn("Coy action failed", e); letGo(token, 0); return; }
      if (token.cancelled) return;
      if (done) { if (actionRef.current === token) actionRef.current = null; return; }
      token.raf = window.requestAnimationFrame(tick);
    };
    token.raf = window.requestAnimationFrame(tick);
  }
  // Let go of whatever he is hanging from and fall (carrying a little sideways speed).
  function letGo(token, vx) {
    if (token.cancelled) return;
    window.cancelAnimationFrame(token.raf);
    if (actionRef.current === token) actionRef.current = null;
    hideRope();
    velRef.current.vx = vx;
    velRef.current.t = performance.now();
    startFall();
  }

  // ---- walls he can grapple onto: the screen edges and the outer sides of app windows ----
  function readWall(wall) {
    if (wall.kind === "screen") {
      return { ok: true, x: wall.side === "left" ? 0 : window.innerWidth };
    }
    const node = wall.node;
    if (!node?.isConnected) return { ok: false };
    const cs = window.getComputedStyle(node);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return { ok: false };
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { ok: false };
    return { ok: true, x: wall.side === "left" ? rect.left : rect.right, rect };
  }

  function pickWall(onlySide) {
    const W = spriteSize, H = getCoyHeight();
    const vw = window.innerWidth;
    const cx = posRef.current.left + W / 2;
    const handY = posRef.current.top + H * 0.42;
    const reach = Math.min(WALL_ROPE_REACH, vw * 0.7);
    const found = [];
    const add = (kind, side, x, node, loY, hiY) => {
      if (onlySide && onlySide !== side) return;
      const dir = side === "left" ? (kind === "screen" ? -1 : 1) : (kind === "screen" ? 1 : -1);
      const contactX = x - dir * WALL_CONTACT_PX;
      const away = Math.abs(contactX - cx);
      if (contactX < 8 || contactX > vw - 8 || away < 80 || away > reach) return;
      // Windows must be approached from outside; he never climbs through a window's body.
      if (kind === "window" && (side === "left" ? cx > contactX - 10 : cx < contactX + 10)) return;
      const hi = Math.min(hiY, handY - 70), lo = Math.max(loY, handY - 300);
      if (hi < lo) return;
      found.push({ kind, side, dir, x, node, anchorY: lo + Math.random() * (hi - lo) });
    };
    add("screen", "left", 0, null, 60, Infinity);
    add("screen", "right", vw, null, 60, Infinity);
    document.querySelectorAll(".app__header").forEach(header => {
      const node = header.closest("[data-app-window-id][data-app-title]");
      if (!node || !isVisibleAppbar(header, node)) return;
      const rect = node.getBoundingClientRect();
      if (rect.height < 150 || rect.top - H > posRef.current.top - 30) return;
      add("window", "left", rect.left, node, rect.top + 24, rect.bottom - 24);
      add("window", "right", rect.right, node, rect.top + 24, rect.bottom - 24);
      // Windows are more interesting than bare screen edges, so they get a second ticket.
      found.push(...found.filter(w => w.node === node));
    });
    return found.length ? found[Math.floor(Math.random() * found.length)] : null;
  }

  // Fire the grapple at a wall, get pulled onto it, climb, then either haul himself up onto
  // the window's title bar or lose his grip and fall.
  function startWallGrapple(onlySide) {
    const wall = pickWall(onlySide);
    if (!wall) return false;
    const W = spriteSize, H = getCoyHeight();
    const dir = wall.dir;
    const token = beginAction("wall");
    const slipAt = wall.kind === "window" && Math.random() < 0.4 ? 0.3 + Math.random() * 0.55 : null;
    const climbDirection = -1;
    let phase = "fire", t = 0, pullFrom = null, pullDur = 0.7, climbStartTop = 0, climbStopTop = 0, climbStopAt = 0, mantleFrom = null, mantleTo = null, mantleSurface = null;
    const contactLeft = x => x - dir * WALL_CONTACT_PX - W / 2;

    dirRef.current = dir;
    setDir(dir);
    poseRef.current = "grapple";
    setPose("grapple");
    showRope(wall.x, wall.anchorY);

    runLoop(token, dt => {
      const w = readWall(wall);
      if (!w.ok) { letGo(token, 0); return true; }
      grappleRef.current.ax = w.x;                               // the hook stays stuck to a moving window
      const cur = posRef.current;

      if (phase === "fire") {
        t += dt;
        grappleRef.current.travel = t / HOOK_TRAVEL_S;
        if (t >= HOOK_TRAVEL_S + 0.12) { phase = "pull"; t = 0; pullFrom = { ...cur }; pullDur = Math.max(0.45, Math.min(1.0, Math.hypot(contactLeft(w.x) - cur.left, wall.anchorY - cur.top) / 700)); }
        return false;
      }

      if (phase === "pull") {
        t += dt;
        const k = easeInOut(Math.min(1, t / pullDur));
        const toLeft = contactLeft(w.x), toTop = Math.max(0, wall.anchorY - H * 0.42);
        const left = lerp(pullFrom.left, toLeft, k), top = lerp(pullFrom.top, toTop, k);
        velRef.current.vx = (left - cur.left) / Math.max(dt, 0.001);        // he leans into the pull
        moveTo(left, top);
        if (t >= pullDur) {
          phase = "climb";
          hideRope();
          velRef.current.vx = 0;
          climbStartTop = top;
          if (wall.kind === "screen") {
            const vh = window.innerHeight;
            const distance = Math.max(60, (0.18 + Math.random() * 0.37) * vh);
            climbStopAt = climbDirection < 0
              ? Math.max(8, climbStartTop - distance)
              : Math.min(getTaskbarTop() - H, climbStartTop + distance);
          } else {
            climbStopAt = climbDirection < 0
              ? Math.max(0, w.rect.top - H)
              : Math.min(getTaskbarTop() - H, w.rect.bottom - H);
          }
          poseRef.current = "climbing";
          setPose("climbing");
        }
        return false;
      }

      if (phase === "climb") {
        const left = contactLeft(w.x);
        const top = cur.top + climbDirection * CLIMB_SPEED * dt;
        const endTop = wall.kind === "window"
          ? (climbDirection < 0 ? Math.max(0, w.rect.top - H) : Math.min(getTaskbarTop() - H, w.rect.bottom - H))
          : climbStopAt;
        moveTo(left, top);
        if (wall.kind === "window") {
          const total = Math.max(1, Math.abs(climbStartTop - endTop));
          if (slipAt !== null && Math.abs(climbStartTop - top) / total >= slipAt) { letGo(token, -dir * 70); return true; }
        }
        const reachedEnd = climbDirection < 0 ? top <= endTop : top >= endTop;
        if (reachedEnd) {
          if (wall.kind === "screen" || climbDirection > 0) {
            letGo(token, -dir * (wall.kind === "screen" ? 190 : 70));
            return true;
          }
          const header = wall.node.querySelector(".app__header");
          const fit = header && getAppbarFitRange(header.getBoundingClientRect());
          if (!fit) { letGo(token, -dir * 70); return true; }
          const standLeft = wall.side === "left" ? fit.minLeft : fit.maxLeft;
          mantleSurface = {
            kind: "appbar", minLeft: fit.minLeft, maxLeft: fit.maxLeft, top: endTop,
            anchorRatio: getAppbarAnchorRatio(standLeft, fit),
            zIndex: Number.parseInt(window.getComputedStyle(wall.node).zIndex, 10) || 0,
            element: header, windowNode: wall.node, headerRect: readRect(header), windowRect: readRect(wall.node)
          };
          mantleFrom = { left, top: endTop };
          mantleTo = { left: standLeft, top: endTop };
          phase = "mantle"; t = 0;
        }
        return false;
      }

      // mantle: swing over the edge onto the title bar
      t += dt;
      const k = easeInOut(Math.min(1, t / 0.5));
      moveTo(lerp(mantleFrom.left, mantleTo.left, k), mantleTo.top);
      if (t >= 0.5) {
        standingSurfaceRef.current = mantleSurface;
        wasStandingAligned.current = true;
        setImpact(0);
        showPose("land", 520);
        return true;
      }
      return false;
    });
    return true;
  }

  // Shoot the hook at the mouse cursor, get yanked over to it, dangle for a moment, drop.
  function startCursorGrapple(force) {
    const fine = !window.matchMedia || window.matchMedia("(pointer: fine)").matches;
    if (!fine || Date.now() - lastPointerAt.current > 6000) return false;
    const W = spriteSize, H = getCoyHeight();
    const groundTop = getTaskbarTop() - H;
    const cursor = lookRef.current;
    const cx = posRef.current.left + W / 2, cy = posRef.current.top + H * 0.42;
    const dist = Math.hypot(cursor.x - cx, cursor.y - cy);
    // The cursor has to be somewhere he can swing to: well away from him, above the taskbar.
    if (dist < 170 || dist > 950 || cursor.y > groundTop + H * 0.3 || cursor.y < 10) return false;
    const token = beginAction("cursor");
    dirRef.current = cursor.x < cx ? -1 : 1;
    setDir(dirRef.current);
    const hangFor = 1.1 + Math.random() * 1.1;
    let phase = "fire", t = 0, speed = 250;
    const goal = () => ({
      left: Math.max(0, Math.min(window.innerWidth - W, cursor.x - W / 2)),
      top: Math.max(0, Math.min(groundTop, cursor.y - H * 0.06))
    });
    poseRef.current = "grapple";
    setPose("grapple");
    showRope(cursor.x, cursor.y);

    runLoop(token, dt => {
      grappleRef.current.ax = cursor.x;                         // the hook is stuck to the cursor itself
      grappleRef.current.ay = cursor.y;
      const cur = posRef.current, g = goal();

      if (phase === "fire") {
        t += dt;
        grappleRef.current.travel = t / HOOK_TRAVEL_S;
        if (t >= HOOK_TRAVEL_S + 0.1) { phase = "pull"; t = 0; }
        return false;
      }

      if (phase === "pull") {
        t += dt;
        speed = Math.min(1250, speed + 2200 * dt);
        const dx = g.left - cur.left, dy = g.top - cur.top, d = Math.hypot(dx, dy);
        const stepLen = Math.min(d, speed * dt);
        velRef.current.vx = d > 0 ? (dx / d) * speed : 0;
        if (d > 0) moveTo(cur.left + (dx / d) * stepLen, cur.top + (dy / d) * stepLen);
        if (d <= 6 || t > 2.6) { phase = "hang"; t = 0; }
        return false;
      }

      // hang: dangles from the cursor, following it with a little lag
      t += dt;
      const k = 1 - Math.exp(-9 * dt);
      const left = lerp(cur.left, g.left, k), top = lerp(cur.top, g.top, k);
      velRef.current.vx = (left - cur.left) / Math.max(dt, 0.001);
      moveTo(left, top);
      if (t >= hangFor) { letGo(token, Math.max(-400, Math.min(400, velRef.current.vx))); return true; }
      return false;
    });
    return true;
  }

  function doSword() {
    startSwordAction("swordlunge", 900);
    return true;
  }
  function doSit() {
    cancelAction();
    const surface = getTaskbarSurface();
    const next = {
      left: clampValue(posRef.current.left, surface.minLeft, surface.maxLeft),
      top: surface.top
    };
    posRef.current = next;
    setPosition(next);
    standingSurfaceRef.current = surface;
    wasStandingAligned.current = true;
    showPose("sit", 6500 + Math.random() * 3500);
    return true;
  }
  // Weighted pick; anything that cannot happen right now (no wall in reach, mouse not moving) falls through.
  function doRandomAction() {
    const roll = Math.random();
    if (roll < 0.08) return;                                    // sometimes he just keeps wandering
    if (roll < 0.28) { doSword(); return; }
    if (roll < 0.48) { doSit(); return; }
    if (roll < 0.58 && startCursorGrapple()) return;
    if (startWallGrapple()) return;
    doSword();
  }
  actionsRef.current = { wall: startWallGrapple, cursor: startCursorGrapple, random: doRandomAction, cancel: cancelAction };

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
    // A click must not stop the fall; only cancel physics once this becomes a real drag.
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) {}
  }

  function onCoyPointerMove(event) {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    let dx = event.clientX - drag.startX;
    let dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    if (!drag.moved) {
      actionsRef.current.cancel?.();
      window.cancelAnimationFrame(fallRaf.current);
      // Start dragging from Coy's latest physics position, not where he was on pointer-down.
      drag.originLeft = posRef.current.left;
      drag.originTop = posRef.current.top;
      drag.startX = event.clientX;
      drag.startY = event.clientY;
      dx = 0;
      dy = 0;
      window.clearTimeout(poseTimer.current);
      setPose("held");
    }
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
    // Tool climbing and falling are locked actions: clicks must not interrupt them.
    if (pose === "climbing" || pose === "fall" || !wasStandingAligned.current) return;
    if (suppressClickAfterDrag.current) {
      suppressClickAfterDrag.current = false;
      return;
    }
    if (poseRef.current === "climbing" || poseRef.current === "fall" || actionRef.current?.name === "wall") return;
    // Clicking Coy only pats him; use the chat button to open the chatbot.
    if (clickTimer.current) window.clearTimeout(clickTimer.current);
    clickTimer.current = null;
    // A direct click plays one dance; it never triggers the old pat pose or a pat bubble.
    const dances = ["dance", "dance2", "dance3"];
    showPose(dances[Math.floor(Math.random() * dances.length)], 4500);
    lastActivity.current = Date.now();
  }

  function openChat() {
    window.dispatchEvent(new CustomEvent("coy:open-chat"));
  }

  async function send(event, overrideMessage) {
    if (event && event.preventDefault) event.preventDefault();
    const message = (overrideMessage || draft).trim();
    if (!message || busy) return;
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
      // Compact balloon close to Coy's head; text controls width and wraps when needed.
      left: "50%",
      bottom: "calc(100% - 5px)",
      transform: "translateX(-50%)",
      width: "max-content",
      minWidth: 54,
      maxWidth: "min(204px, calc(100vw - 20px))",
      height: "auto",
      overflow: "visible",
      pointerEvents: "none",
      zIndex: 5
    },
    dialogBody: {
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxSizing: "border-box",
      width: "max-content",
      minWidth: 54,
      maxWidth: "min(204px, calc(100vw - 20px))",
      minHeight: 44,
      border: "12px solid transparent",
      // Preserve the original 2013 green border/corners and stretch only the
      // dark-green center, rather than resizing the entire square texture.
      borderImageSource: `url(${ROBLOX_DIALOG_ASSET_BASE}chatBubble_botGreen_bkg.png)`,
      borderImageSlice: "12 fill",
      borderImageWidth: "12px",
      borderImageRepeat: "stretch",
      zIndex: 1
    },
    dialogTail: {
      position: "absolute",
      // Center the tail and tuck its base behind the bubble border to hide the seam.
      left: "50%",
      right: "auto",
      transform: "translateX(-50%)",
      // Put the tail behind the body and overlap the border enough to hide
      // transparent edge pixels in the original Roblox texture.
      top: "calc(100% - 15px)",
      width: 28,
      height: 28,
      objectFit: "fill",
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
      minWidth: 26,
      maxWidth: 174,
      boxSizing: "border-box",
      padding: "2px 3px 2px",
      overflow: "hidden",
      color: "#fff",
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: 12,
      fontWeight: 600,
      lineHeight: "14px",
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
    <div ref={rootRef} style={{ ...styles.root, visibility: avatarReady && !underAppWindows ? "visible" : "hidden" }} data-coy-ui="true">
      <svg
        ref={ropeSvgRef}
        aria-hidden="true"
        style={{ position: "fixed", left: 0, top: 0, width: "100vw", height: "100vh", display: "none", overflow: "visible", pointerEvents: "none" }}
      >
        <line ref={ropeLineRef} stroke="#161616" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
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
        <CoyAvatar3D size={spriteSize} pose={pose} dir={dir} vx={velRef.current.vx} impact={impact} look={lookRef.current} grapple={grappleRef.current} getPos={() => ({ x: posRef.current.left, y: posRef.current.top })} onReady={() => setAvatarReady(true)} />
      </button>

      <button
        type="button"
        aria-label="Open Coy chat"
        title="Chat with Coy"
        onClick={event => { event.stopPropagation(); openChat(); }}
        style={{
          position: "absolute",
          // Keep the chat icon beside Coy's head rather than beside his torso.
          left: Math.round(spriteSize * 0.7),
          top: Math.round(spriteSize * 0.05),
          width: 30,
          height: 30,
          padding: 0,
          border: 0,
          background: "transparent",
          cursor: "pointer",
          pointerEvents: "auto",
          display: "block",
          zIndex: 4
        }}
        onMouseEnter={event => {
          const image = event.currentTarget.querySelector("img");
          if (image) image.src = ROBLOX_DIALOG_ASSET_BASE + "Chat_ovr.png";
        }}
        onMouseLeave={event => {
          const image = event.currentTarget.querySelector("img");
          if (image) image.src = ROBLOX_DIALOG_ASSET_BASE + "Chat_ds.png";
        }}
      >
        <img
          src={ROBLOX_DIALOG_ASSET_BASE + "Chat_ds.png"}
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
