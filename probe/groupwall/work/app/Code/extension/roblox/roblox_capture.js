// Roblox capture content-script (isolated world).
// Focus: Group static/dynamic, wall, forums, announcements, events.
// Sends normalized row blocks to background, which batches -> local server.

(() => {
  'use strict';

  // -----------------------
  // Config
  // -----------------------
  const CAPTURE_COOLDOWN_MS = 10_000; // per-page debounce
  const WALL_LIMIT = 100;
  const WALL_MAX_PAGES = 0; // 0 = unlimited
  const WALL_PAGE_DELAY_MS = 6500; // safer default for account/IP

  const FORUM_LIMIT = 25; // per devforum note: limit currently works with 10/25
  const FORUM_MAX_PAGES = 5_000; // safety cap
  const FORUM_PAGE_DELAY_MS = 150;
  const FORUM_MAX_POSTS_PER_RUN = 2_500;
  const FORUM_MAX_COMMENTS_PER_RUN = 10_000;
  const FORUM_MAX_POSTS_TO_FETCH_COMMENTS = 200; // reduce blow-ups

  const ANN_LIMIT = 25;

  // -----------------------
  // Utilities
  // -----------------------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function nowIsoZ() {
    return new Date().toISOString();
  }

  function uuidv4() {
    // browser-safe
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 0x0f) >> 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function jsonOrNull(v) {
    if (v === null || v === undefined) return null;
    try {
      return JSON.stringify(v);
    } catch (e) {
      return null;
    }
  }

  function safeText(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'string') return v;
    try { return String(v); } catch (e) { return null; }
  }

  function safeInt(v) {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.trunc(n);
  }

  function pick(...vals) {
    for (const v of vals) {
      if (v !== null && v !== undefined) return v;
    }
    return null;
  }

// -----------------------
// Page-RPC JSON fetch (bypasses CORS restrictions for some Roblox APIs)
// -----------------------
const __roaRpc = { pending: new Map(), listening: false };

function ensureRoaRpcListener() {
  if (__roaRpc.listening) return;
  __roaRpc.listening = true;
  window.addEventListener('message', (event) => {
    try {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.__roa !== true || (data.type !== 'ROA_FETCH_JSON_RESULT' && data.type !== 'ROA_HTTP_RESULT')) return;
      const id = data.id;
      if (!id) return;
      const p = __roaRpc.pending.get(id);
      if (!p) return;
      __roaRpc.pending.delete(id);
      clearTimeout(p.t);
      p.resolve({ ok: !!data.ok, status: data.status || 0, text: data.text || '', error: data.ok ? null : String(data.error || 'rpc_failed'), headers: (data.headers && typeof data.headers === 'object') ? data.headers : {} });
    } catch (e) {}
  });
}

function roaRpcFetchText(url, opts = {}) {
  ensureRoaRpcListener();
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const t = setTimeout(() => {
      __roaRpc.pending.delete(id);
      reject(new Error('rpc_timeout'));
    }, 15000);

    __roaRpc.pending.set(id, { resolve, reject, t });

    try {
      window.postMessage({
        __roa: true,
        type: 'ROA_FETCH_JSON',
        id,
        url: String(url || ''),
        opts: Object.assign({}, opts || {})
      }, '*');
    } catch (e) {
      clearTimeout(t);
      __roaRpc.pending.delete(id);
      reject(e);
    }
  });
}

async function roaDirectHttpRequest(url, opts = {}) {
  const method = String((opts && opts.method) || 'GET').toUpperCase();
  const baseHeaders = Object.assign({}, (opts && opts.headers) || {});
  const bodyText = Object.prototype.hasOwnProperty.call((opts || {}), 'bodyText') ? opts.bodyText : undefined;
  const credentials = (opts && opts.credentials) ? opts.credentials : 'include';
  const cache = (opts && opts.cache) ? opts.cache : 'no-store';

  async function doFetch(csrfToken) {
    const headers = Object.assign({}, baseHeaders);
    if (csrfToken && method !== 'GET' && method !== 'HEAD') headers['X-CSRF-TOKEN'] = csrfToken;
    const init = { method, headers, credentials, cache };
    if (bodyText !== undefined && bodyText !== null && method !== 'GET' && method !== 'HEAD') {
      init.body = String(bodyText);
    }
    return await fetch(String(url || ''), init);
  }

  let res = await doFetch('');
  if (method !== 'GET' && method !== 'HEAD' && res && Number(res.status || 0) === 403) {
    const freshToken = (res.headers && res.headers.get && res.headers.get('x-csrf-token')) || '';
    if (freshToken) {
      res = await doFetch(freshToken);
    }
  }

  const headers = {};
  try {
    if (res && res.headers && typeof res.headers.forEach === 'function') {
      res.headers.forEach((v, k) => { headers[String(k || '').toLowerCase()] = String(v || ''); });
    }
  } catch (e) {}
  const text = await res.text().catch(() => '');
  return { ok: !!(res && res.ok), status: Number(res && res.status || 0), text: text || '', error: '', headers };
}

async function roaRpcRequest(url, opts = {}) {
  ensureRoaRpcListener();
  try {
    return await new Promise((resolve, reject) => {
      const id = uuidv4();
      const t = setTimeout(() => {
        __roaRpc.pending.delete(id);
        reject(new Error('rpc_timeout'));
      }, 5000);

      __roaRpc.pending.set(id, { resolve, reject, t });

      try {
        window.postMessage({
          __roa: true,
          type: 'ROA_HTTP_REQUEST',
          id,
          url: String(url || ''),
          opts: Object.assign({}, opts || {})
        }, '*');
      } catch (e) {
        clearTimeout(t);
        __roaRpc.pending.delete(id);
        reject(e);
      }
    });
  } catch (rpcErr) {
    return await roaDirectHttpRequest(url, opts).catch((directErr) => ({
      ok: false,
      status: 0,
      text: '',
      error: String((directErr && (directErr.message || directErr)) || (rpcErr && (rpcErr.message || rpcErr)) || 'rpc_and_direct_failed'),
      headers: {}
    }));
  }
}

async function roaRpcJsonRequest(url, opts = {}) {
  const r = await roaRpcRequest(url, Object.assign({}, opts || {}));
  const status = Number(r && r.status || 0);
  if (!(r && r.ok && status >= 200 && status < 300)) {
    const err = new Error(`HTTP ${status || 0} ${url}` + (r && r.error ? ` ${r.error}` : ''));
    err.status = status || 0;
    err.body = ((r && r.text) ? String(r.text) : '').slice(0, 200);
    throw err;
  }
  const txt = String((r && r.text) || '');
  if (!txt) return {};
  try {
    return JSON.parse(txt);
  } catch (e) {
    const err = new Error(`invalid_json ${url}`);
    err.status = status || 0;
    err.body = txt.slice(0, 200);
    throw err;
  }
}

async function fetchJson(url, opts = {}) {
  const headers = Object.assign({ 'Accept': 'application/json' }, (opts.headers || {}));
  // Prefer page-context fetch via page-hook RPC (avoids extension-origin CORS issues).
  try {
    const r = await roaRpcFetchText(url, Object.assign({}, opts, { headers, method: (opts.method || 'GET'), credentials: 'include' }));
    if (!r) throw new Error('rpc_empty');
    const status = Number(r.status || 0);
    const ok = !!r.ok && status >= 200 && status < 300;
    if (!ok) {
      const err = new Error(`HTTP ${status || 0} ${url}` + (r && r.error ? ` ${r.error}` : ''));
      err.status = status || 0;
      err.body = ((r && r.text) ? String(r.text) : '').slice(0, 200);
      throw err;
    }
    if (!r.text) {
      const err = new Error('rpc_empty_body');
      err.status = status || 0;
      throw err;
    }
    try {
      return JSON.parse(r.text);
    } catch (e) {
      const err = new Error(`invalid_json ${url}`);
      err.status = status || 0;
      err.body = String(r.text || '').slice(0, 200);
      throw err;
    }
  } catch (e) {
    // Fallback: direct fetch (may work for some endpoints)
    const res = await fetch(url, Object.assign({}, opts, { headers, credentials: 'include' }));
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      const err = new Error(`HTTP ${res.status} ${url} ${txt.slice(0, 120)}`);
      err.status = res.status;
      err.body = txt.slice(0, 200);
      throw err;
    }
    return await res.json();
  }
}

  function deepFind(obj, predicate, maxNodes = 20000) {
    const q = [obj];
    let seen = 0;
    while (q.length && seen < maxNodes) {
      const cur = q.shift();
      seen++;
      try {
        if (predicate(cur)) return cur;
      } catch (e) {}
      if (!cur) continue;
      if (Array.isArray(cur)) {
        for (const x of cur) q.push(x);
      } else if (typeof cur === 'object') {
        for (const k of Object.keys(cur)) q.push(cur[k]);
      }
    }
    return null;
  }

  function stableShoutId(groupId, posterId, created, body) {
    const s = `${groupId}|${posterId || ''}|${created || ''}|${body || ''}`;
    // sha256 in browser
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then((buf) => {
      const b = new Uint8Array(buf);
      return Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
    });
  }

  

  function extractUserLike(obj) {
    // Attempts to find a user-ish object with an id and a username/name.
    if (!obj) return { userId: null, username: null };
    const found = deepFind(obj, (o) => {
      if (!o || typeof o !== 'object') return false;
      const id = (o.userId ?? o.id ?? o.uid);
      const name = (o.username ?? o.name ?? o.displayName);
      if (id == null || name == null) return false;
      const n = Number(id);
      return Number.isFinite(n) && n > 0 && typeof name === 'string' && name.length > 0;
    }, 12000);
    if (!found) return { userId: null, username: null };
    return {
      userId: safeInt(found.userId ?? found.id ?? found.uid),
      username: safeText(found.username ?? found.name ?? found.displayName),
    };
  }

  function extractWallPostPoster(p) {
    // Try common shapes first, then deep-search.
    const poster =
      p.poster ||
      p.posterUser ||
      p.user ||
      p.author ||
      p.createdBy ||
      p.posterInfo ||
      {};
    const user = poster.user || poster;

    let pid = pick(
      p.posterUserId,
      p.userId,
      p.posterId,
      p.creatorId,
      user.userId,
      user.id,
      poster.userId,
      poster.id,
      (poster.user && (poster.user.userId || poster.user.id))
    );

    let uname = pick(
      p.posterUsername,
      p.username,
      user.username,
      user.name,
      user.displayName,
      poster.username,
      poster.name,
      poster.displayName,
      (poster.user && (poster.user.username || poster.user.name || poster.user.displayName))
    );

    if (pid == null || uname == null) {
      const deep = extractUserLike(p);
      if (pid == null) pid = deep.userId;
      if (uname == null) uname = deep.username;
    }

    const roleName = pick(
      p.role && (p.role.name || p.role),
      p.posterRole && (p.posterRole.name || p.posterRole),
      poster.role && (poster.role.name || poster.role),
      user.role && (user.role.name || user.role)
    );

    return { pid: safeInt(pid), uname: safeText(uname), roleName: safeText(roleName) };
  }
// -----------------------
  // Page hook injection (for announcements/events discovery)
  // -----------------------
  async function injectPageHookOnce() {
    try {
      if (window.__roaHookInjected) return;
      window.__roaHookInjected = true;

      // Prefer MV3 scripting injection (MAIN world) to bypass site CSP.
      try {
        await chrome.runtime.sendMessage({ type: 'inject_roa_hook' });
        return;
      } catch (e) {
        // fallback below
      }

      // Fallback: DOM script tag (may be blocked by CSP)
      const s = document.createElement('script');
      s.src = chrome.runtime.getURL('roblox/roblox_page_hook.js');
      s.async = true;
      (document.documentElement || document.head || document.body).appendChild(s);
      s.onload = () => { try { s.remove(); } catch (e) {} };
    } catch (e) {}
  }


  injectPageHookOnce().catch(() => {});

  // -----------------------
  // Debounce per URL
  // -----------------------
  let lastCaptureUrl = null;
  let lastCaptureTs = 0;

  function isCooldown(url) {
    const now = Date.now();
    if (url === lastCaptureUrl && (now - lastCaptureTs) < CAPTURE_COOLDOWN_MS) return true;
    lastCaptureUrl = url;
    lastCaptureTs = now;
    return false;
  }

  // -----------------------
  // Record batching (local)
  // -----------------------
  const pendingBlocks = new Map(); // type -> rows[]
  let flushTimer = null;

  function addRows(type, rows) {
    if (!rows || !rows.length) return;
    if (!pendingBlocks.has(type)) pendingBlocks.set(type, []);
    pendingBlocks.get(type).push(...rows);
    scheduleFlush();
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushNow();
    }, 750);
  }

  function flushNow() {
    if (!pendingBlocks.size) return;
    if (!WALL_PAGER.manualCaptureEnabled) {
      pendingBlocks.clear();
      return;
    }
    const blocks = [];
    for (const [type, rows] of pendingBlocks.entries()) {
      if (rows && rows.length) blocks.push({ type, rows });
    }
    pendingBlocks.clear();
    if (!blocks.length) return;
    chrome.runtime.sendMessage({
      type: 'roblox_records',
      payload: {
        source: 'roblox_capture',
        url: location.href,
        captured: nowIsoZ(),
        records: blocks
      }
    }, () => {});
  }

  // -----------------------
  // Capture handlers
  // -----------------------
  function getGroupIdFromUrl(u) {
    const s = String(u || "");
    let m = s.match(/\/groups\/(\d+)/i);
    if (m) return safeInt(m[1]);
    m = s.match(/\/communities\/(\d+)/i);
    if (m) return safeInt(m[1]);
    m = s.match(/[?&](?:communityId|groupId)=(\d+)/i);
    if (m) return safeInt(m[1]);
    return null;
  }


  // -----------------------
  // Wall Pager UI (Roblox GUI overlay)
  // - Shows 100 wall posts per page
  // - Prev/Next paging (cursor chain + local history)
  // - Sort toggle (Oldest<->Newest via API sortOrder Asc/Desc)
  // - Auto paging with adaptive backoff on 429
  // -----------------------

  const WALL_PAGER = {
    el: null,
    styleEl: null,
    ui: null,
    groupId: null,
    apiVer: 'v2',
    sortOrder: 'Desc', // Roblox default is typically newest-first
    limit: WALL_LIMIT,
    pages: [], // [{ cursorStart, nextCursor, data }]
    pageIndex: 0,
    loading: false,
    auto: false,
    autoStop: false,
    baseDelayMs: 6500,
    jitterMs: 1200,
    breakEveryPages: 25,     // extra long pause every N pages (0 disables)
    breakMinMs: 20000,       // min long pause
    breakMaxMs: 45000,       // max long pause
    stopOnHidden: true,      // pause when tab is not visible
    pauseOnOffline: true,    // pause when navigator is offline
    rateLimitHits: 0,        // consecutive 429s
    tempErrorHits: 0,        // consecutive transient errors (0/5xx)
    lastDelayMs: 0,          // last scheduled delay (for UI)
    backoffMs: 0,
    maxDelayMs: 60000,
    maxAutoPages: 0,
    manualCaptureEnabled: false,
    runnerMode: 'wall',
    discoveryMinId: 1,
    notifyMode: 'off',
    notifyTimer: null,
    notifyDoneKey: null,
    originalTitle: null,
    badgeActive: false,
    cutoffInput: '',
    cutoffBoundaryIso: '',
  };


  const PASSIVE_GROUP_INFO = new Map();

  function rememberPassiveGroupInfo(groupId, info) {
    const gid = safeInt(groupId);
    if (!gid || !info || typeof info !== 'object') return;
    PASSIVE_GROUP_INFO.set(gid, Object.assign({ groupId: gid, captured: nowIsoZ() }, info));
  }

  function getPassiveGroupInfo(groupId) {
    const gid = safeInt(groupId);
    if (!gid) return null;
    return PASSIVE_GROUP_INFO.get(gid) || null;
  }

  function runnerStateKey() {
    return 'roa_runner_state_v1';
  }

  function loadRunnerStateSync() {
    try {
      const raw = sessionStorage.getItem(runnerStateKey());
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return null;
      return obj;
    } catch (e) {
      return null;
    }
  }

  function saveRunnerStateSync(state) {
    try {
      if (!state || typeof state !== 'object') {
        sessionStorage.removeItem(runnerStateKey());
        return null;
      }
      const out = Object.assign({}, state, {
        runnerId: safeText(state.runnerId) || WALL_RUNTIME_SESSION_ID,
        updatedAt: nowIsoZ(),
      });
      sessionStorage.setItem(runnerStateKey(), JSON.stringify(out));
      return out;
    } catch (e) {
      return null;
    }
  }

  function clearRunnerStateSync() {
    try { sessionStorage.removeItem(runnerStateKey()); } catch (e) {}
  }

  const RUNNER = {
    tickTimer: null,
    inTick: false,
    leaseSeconds: 120,
    lastRenewAt: 0,
  };

  function runnerCalcPctJitterDelayMs(baseMs, pct = 0.2) {
    const base = Math.max(0, Number(baseMs) || 0);
    const spread = Math.max(0, base * Math.max(0, Number(pct) || 0));
    return clampInt(Math.round(randBetween(base - spread, base + spread)), 250, 60000);
  }

  function runnerEntryDelayMs() {
    return runnerCalcPctJitterDelayMs(2000, 0.20);
  }

  function runnerAdvanceDelayMs() {
    return runnerCalcPctJitterDelayMs(1000, 0.20);
  }

  function runnerPeriodicBreakMs(completedGroups) {
    const done = safeInt(completedGroups) || 0;
    if (done > 0 && (done % 250) === 0) {
      return clampInt(Math.round(randBetween(30000, 60000)), 30000, 60000);
    }
    return 0;
  }

  function parseCutoffInput(rawValue) {
    const raw = safeText(rawValue) || '';
    if (!raw) return { raw: '', boundaryMs: null, boundaryIso: '' };
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (dateOnly) {
      const y = Number(dateOnly[1]);
      const m = Number(dateOnly[2]);
      const d = Number(dateOnly[3]);
      const ms = Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0);
      if (Number.isFinite(ms)) return { raw, boundaryMs: ms, boundaryIso: new Date(ms).toISOString(), mode: 'date' };
    }
    const ms = Date.parse(raw);
    if (!Number.isFinite(ms)) return { raw, boundaryMs: null, boundaryIso: '' };
    return { raw, boundaryMs: ms, boundaryIso: new Date(ms).toISOString(), mode: 'timestamp' };
  }

  function wallPostCreatedIso(post) {
    return safeText(pick(post && post.created, post && post.createdAt, post && post.created_at)) || null;
  }

  function wallPostCreatedMs(post) {
    const iso = wallPostCreatedIso(post);
    if (!iso) return null;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : null;
  }

  function findFirstPostAfterBoundary(items, boundaryMs) {
    if (!Array.isArray(items) || !Number.isFinite(boundaryMs)) return null;
    for (const p of items) {
      const ms = wallPostCreatedMs(p);
      if (ms !== null && ms >= boundaryMs) {
        return { timestamp: wallPostCreatedIso(p), postId: safeInt(p && p.id), ms };
      }
    }
    return null;
  }

  function pageReachedFinishTimestamp(items, reachedMs) {
    if (!Array.isArray(items) || !Number.isFinite(reachedMs)) return false;
    for (const p of items) {
      const ms = wallPostCreatedMs(p);
      if (ms !== null && ms <= reachedMs) return true;
    }
    return false;
  }


  function runnerCurrentModeFromUi() {
    const sel = WALL_PAGER.ui && WALL_PAGER.ui.modeSel;
    const v = safeText(sel && sel.value) || WALL_PAGER.runnerMode || 'wall';
    return (v === 'discovery' || v === 'climb' || v === 'finish') ? v : 'wall';
  }

  function runnerCurrentMinIdFromUi() {
    const inp = WALL_PAGER.ui && WALL_PAGER.ui.minIdInp;
    const n = clampInt(inp && inp.value != null ? inp.value : WALL_PAGER.discoveryMinId, 1, 2147483647);
    WALL_PAGER.discoveryMinId = n;
    if (inp) inp.value = String(n);
    return n;
  }

  function runnerCurrentCutoffInputFromUi() {
    const inp = WALL_PAGER.ui && WALL_PAGER.ui.cutoffInp;
    const v = safeText(inp && inp.value) || '';
    WALL_PAGER.cutoffInput = v;
    const parsed = parseCutoffInput(v);
    WALL_PAGER.cutoffBoundaryIso = parsed.boundaryIso || '';
    return parsed;
  }

  function runnerReadUiSettings() {
    try {
      WALL_PAGER.runnerMode = runnerCurrentModeFromUi();
      WALL_PAGER.discoveryMinId = runnerCurrentMinIdFromUi();
      runnerCurrentCutoffInputFromUi();
    } catch (e) {}
  }

  function runnerSyncUiFromState() {
    try {
      const st = loadRunnerStateSync();
      const ui = WALL_PAGER.ui || {};
      if (ui.modeSel) ui.modeSel.value = st && st.active ? (st.mode || 'wall') : (WALL_PAGER.runnerMode || runnerCurrentModeFromUi());
      if (ui.minIdInp) ui.minIdInp.value = String(st && st.minimumId ? st.minimumId : (WALL_PAGER.discoveryMinId || 1));
      if (ui.cutoffInp) ui.cutoffInp.value = safeText(st && st.cutoffInput) || safeText(WALL_PAGER.cutoffInput) || '';
      const autoBtn = WALL_PAGER.el && WALL_PAGER.el.querySelector('[data-roa-auto]');
      if (autoBtn) autoBtn.textContent = (st && st.active) ? 'Stop' : 'Auto';
      WALL_PAGER.auto = !!(st && st.active);
      WALL_PAGER.autoStop = !(st && st.active);
    } catch (e) {}
  }

  async function serverPostJson(path, payload) {
    const res = await runtimeMessage({
      type: 'server_post_json',
      path: String(path || ''),
      payload: (payload && typeof payload === 'object') ? payload : {}
    });
    return res && typeof res === 'object' ? res : { ok: false, error: 'empty_server_result' };
  }

  function scheduleRunnerTick(delayMs = 0) {
    if (RUNNER.tickTimer) return;
    RUNNER.tickTimer = setTimeout(() => {
      RUNNER.tickTimer = null;
      runRunnerTick().catch(() => {});
    }, Math.max(0, Number(delayMs) || 0));
  }


  function runnerStateMatches(state) {
    const live = loadRunnerStateSync();
    if (!live || !live.active) return false;
    if (!state) return !!live.active;
    if (state.mode && live.mode !== state.mode) return false;
    const wanted = safeInt(state.targetId);
    if (wanted !== null && safeInt(live.targetId) !== wanted) return false;
    if (state.runnerId && live.runnerId && String(live.runnerId) !== String(state.runnerId)) return false;
    return true;
  }

  async function runnerSleepCancelable(ms, state) {
    const until = Date.now() + Math.max(0, Number(ms) || 0);
    while (Date.now() < until) {
      if (!runnerStateMatches(state)) return false;
      const remaining = Math.max(0, until - Date.now());
      const hidden = !!(document.visibilityState && document.visibilityState !== 'visible');
      const step = hidden ? Math.min(5000, remaining) : Math.min(250, remaining);
      await sleep(Math.max(1, step));
    }
    return runnerStateMatches(state);
  }

  async function runnerReleaseCurrentClaim(state) {
    try {
      if (!state || !state.targetId || !state.mode || !state.runnerId) return;
      const modePath = state.mode === 'climb' ? '/climb/release' : (state.mode === 'finish' ? '/finish/release' : '/discovery/release');
      await serverPostJson(modePath, { group_id: state.targetId, claimed_by: state.runnerId });
    } catch (e) {}
  }

  async function stopRunnerMode(reason = 'Stopped') {
    const st = loadRunnerStateSync();
    if (RUNNER.tickTimer) {
      clearTimeout(RUNNER.tickTimer);
      RUNNER.tickTimer = null;
    }
    try {
      if (st && st.active) {
        saveRunnerStateSync(Object.assign({}, st, { active: false, stopping: true }));
      }
    } catch (e) {}
    if (st && st.active && st.targetId) {
      await runnerReleaseCurrentClaim(st).catch(() => {});
    }
    clearRunnerStateSync();
    WALL_PAGER.auto = false;
    WALL_PAGER.autoStop = true;
    runnerSyncUiFromState();
    try { wallPagerSetStatus(String(reason || 'Stopped')); } catch (e) {}
  }

  async function startRunnerMode(mode) {
    runnerReadUiSettings();
    const wanted = (mode === 'discovery' || mode === 'climb' || mode === 'finish') ? mode : runnerCurrentModeFromUi();
    const state = saveRunnerStateSync({
      active: true,
      mode: wanted,
      minimumId: runnerCurrentMinIdFromUi(),
      runnerId: WALL_RUNTIME_SESSION_ID,
      targetId: null,
      targetStatus: null,
      targetGroupName: null,
      targetMemberCount: null,
      joinedByRunner: false,
      targetNavStartedAt: null,
      targetNavAttempts: 0,
      leaseSeconds: RUNNER.leaseSeconds,
      completedGroups: 0,
      cutoffInput: safeText(WALL_PAGER.cutoffInput) || '',
      cutoffBoundaryIso: safeText(WALL_PAGER.cutoffBoundaryIso) || '',
    });
    WALL_PAGER.auto = true;
    WALL_PAGER.autoStop = false;
    runnerSyncUiFromState();
    wallPagerSetStatus(wanted === 'climb' ? 'Climb mode active' : (wanted === 'finish' ? 'Finish mode active' : 'Discovery mode active')); 
    scheduleRunnerTick(50);
    return state;
  }

  async function runnerMaybeRenewClaim(state) {
    try {
      if (!state || !state.active || !state.targetId || !state.runnerId) return;
      const now = Date.now();
      if ((RUNNER.lastRenewAt || 0) + 30000 > now) return;
      const path = state.mode === 'climb' ? '/climb/renew' : (state.mode === 'finish' ? '/finish/renew' : '/discovery/renew');
      await serverPostJson(path, {
        group_id: state.targetId,
        claimed_by: state.runnerId,
        lease_seconds: state.leaseSeconds || RUNNER.leaseSeconds
      });
      RUNNER.lastRenewAt = now;
    } catch (e) {}
  }

  function isSearchCommunitiesPage(url = null) {
    const u = String(url || location.href || '');
    return /\/search\/communities(?:[?#]|$)/i.test(u);
  }

  function navigateToGroupPage(groupId) {
    const gid = safeInt(groupId);
    if (!gid) return;
    const target = `https://www.roblox.com/communities/${gid}`;
    if (location.href !== target) location.href = target;
  }

  async function fetchGroupInfoPreflight(groupId) {
    const gid = safeInt(groupId);
    if (!gid) return { exists: false, groupId: null, status: 0 };
    const tries = [
      `https://groups.roblox.com/v1/groups/${gid}`,
      `https://communities.roblox.com/v1/communities/${gid}`,
      `https://groups.roblox.com/v2/groups/${gid}`,
      `https://communities.roblox.com/v2/communities/${gid}`
    ];
    let lastStatus = 0;
    for (const url of tries) {
      try {
        const r = await fetchJsonEx(url, {}, '');
        lastStatus = safeInt(r && r.status) || 0;
        if (r && r.ok && r.json && typeof r.json === 'object') {
          const j = r.json;
          const ownerId = pick(j.owner && (j.owner.userId || j.owner.id), j.ownerId);
          return {
            exists: true,
            groupId: gid,
            name: safeText(j.name),
            description: safeText(j.description),
            memberCount: safeInt(pick(j.memberCount, j.members, j.member_count)),
            ownerId: safeInt(ownerId),
            verified: pick(j.hasVerifiedBadge, j.isVerified, j.verified),
            raw: j,
          };
        }
        if (lastStatus === 404) continue;
      } catch (e) {}
    }
    return { exists: false, groupId: gid, status: lastStatus || 404 };
  }

  function bestGroupInfo(groupId, fallback = null) {
    const gid = safeInt(groupId);
    const passive = getPassiveGroupInfo(gid) || {};
    const fb = fallback && typeof fallback === 'object' ? fallback : {};
    return {
      groupId: gid,
      name: safeText(passive.name) || safeText(fb.name) || null,
      memberCount: safeInt(passive.memberCount != null ? passive.memberCount : fb.memberCount),
      description: safeText(passive.description) || safeText(fb.description) || null,
      ownerId: safeInt(passive.ownerId != null ? passive.ownerId : fb.ownerId),
      verified: passive.verified != null ? passive.verified : fb.verified,
    };
  }

  function showWallJsonOnUi(groupId, jsonObj, sortOrder = 'Asc') {
    try {
      if (!WALL_PAGER.groupId) WALL_PAGER.groupId = safeInt(groupId);
      WALL_PAGER.sortOrder = sortOrder === 'Desc' ? 'Desc' : 'Asc';
      const nextCursor = safeText(jsonObj && (jsonObj.nextPageCursor || jsonObj.nextPageToken || jsonObj.nextPage));
      WALL_PAGER.pages = [{ cursorStart: null, nextCursor: nextCursor || null, data: jsonObj }];
      WALL_PAGER.pageIndex = 0;
      wallPagerRenderPage();
    } catch (e) {}
  }

  async function probeWallOldestPage(groupId, runnerState = null) {
    const gid = safeInt(groupId);
    if (!gid) return { ok: false, status: 0, count: 0, error: 'missing_group_id' };
    enableManualCapture();
    const savedSort = WALL_PAGER.sortOrder;
    const savedApi = WALL_PAGER.apiVer;
    WALL_PAGER.groupId = gid;
    WALL_PAGER.sortOrder = 'Asc';
    const apiVers = Array.from(new Set([(savedApi === 'v1' || savedApi === 'v2') ? savedApi : 'v2', 'v2', 'v1']));
    try {
      for (const apiVer of apiVers) {
        WALL_PAGER.apiVer = apiVer;
        let transientAttempts = 0;
        while (true) {
          if (runnerState) await runnerMaybeRenewClaim(runnerState).catch(() => {});
          const requestUrl = wallApiUrl(gid, null);
          const r = await fetchJsonEx(requestUrl, {}, WALL_PAGER.proxyValue || '');
          if (r && r.ok && r.json) {
            showWallJsonOnUi(gid, r.json, 'Asc');
            archiveWallFromJson(gid, r.json, nowIsoZ(), {
              source: 'discovery_probe',
              requestCursor: null,
              requestUrl,
              apiVer,
              sortOrder: 'Asc',
              proxyValue: WALL_PAGER.proxyValue || '',
            });
            WALL_PAGER.backoffMs = 0;
            WALL_PAGER.rateLimitHits = 0;
            WALL_PAGER.tempErrorHits = 0;
            return {
              ok: true,
              status: safeInt(r.status) || 200,
              count: Array.isArray(r.json && r.json.data) ? r.json.data.length : 0,
              json: r.json,
              apiVer,
            };
          }

          const st = safeInt(r && r.status) || 0;
          const transient = (st === 429 || st === 0 || st >= 500);
          if (transient && transientAttempts < 8) {
            transientAttempts += 1;
            if (st === 429) {
              WALL_PAGER.rateLimitHits = clampInt((WALL_PAGER.rateLimitHits || 0) + 1, 1, 50);
              const base = Math.max(15000, WALL_PAGER.baseDelayMs * 2);
              const mult = Math.pow(1.9, Math.max(0, WALL_PAGER.rateLimitHits - 1));
              const j = randBetween(0, Math.max(500, WALL_PAGER.jitterMs));
              WALL_PAGER.backoffMs = clampInt(base * mult + j, 5000, WALL_PAGER.maxDelayMs);
            } else {
              WALL_PAGER.tempErrorHits = clampInt((WALL_PAGER.tempErrorHits || 0) + 1, 1, 50);
              const base = Math.max(4000, Math.round(WALL_PAGER.baseDelayMs * 0.6));
              const mult = Math.pow(1.6, Math.max(0, WALL_PAGER.tempErrorHits - 1));
              const j = randBetween(0, Math.max(500, WALL_PAGER.jitterMs));
              WALL_PAGER.backoffMs = clampInt(base * mult + j, 3000, WALL_PAGER.maxDelayMs);
            }
            const waitMs = wallPagerCalcRetryDelayMs();
            wallPagerSetStatus(`Discovery ${gid} retry ${(waitMs / 1000).toFixed(1)}s after ${st || 'net'}`);
            const keepGoing = runnerState ? await runnerSleepCancelable(waitMs, runnerState) : (await sleep(waitMs), true);
            if (!keepGoing) return { ok: false, status: 0, count: 0, error: 'stopped', stopped: true, apiVer };
            continue;
          }

          return {
            ok: false,
            status: st,
            count: 0,
            error: safeText(r && r.error) || null,
            apiVer,
          };
        }
      }
      return { ok: false, status: 404, count: 0, error: 'wall_not_found' };
    } finally {
      WALL_PAGER.sortOrder = savedSort;
      WALL_PAGER.apiVer = savedApi;
    }
  }

  function deepQueryAll(root, selector, out = [], seen = new Set()) {
    try {
      if (!root || seen.has(root)) return out;
      seen.add(root);
      if (typeof root.querySelectorAll === 'function') {
        out.push(...Array.from(root.querySelectorAll(selector)));
        const all = Array.from(root.querySelectorAll('*'));
        for (const el of all) {
          try {
            if (el && el.shadowRoot) deepQueryAll(el.shadowRoot, selector, out, seen);
          } catch (e) {}
        }
      }
    } catch (e) {}
    return out;
  }

  function getControlText(el) {
    if (!el) return '';
    try {
      return String(
        el.innerText ||
        el.textContent ||
        (el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('value'))) ||
        ''
      ).replace(/\s+/g, ' ').trim();
    } catch (e) {
      return '';
    }
  }

  function getControlContextText(el) {
    const parts = [];
    const seen = new Set();
    let cur = el;
    for (let depth = 0; cur && depth < 4; depth++) {
      if (!seen.has(cur)) {
        seen.add(cur);
        try {
          if (typeof cur.getAttribute === 'function') {
            const aria = cur.getAttribute('aria-label');
            const title = cur.getAttribute('title');
            const value = cur.getAttribute('value');
            if (aria) parts.push(String(aria));
            if (title) parts.push(String(title));
            if (value) parts.push(String(value));
          }
        } catch (e) {}
        try {
          const txt = getControlText(cur);
          if (txt) parts.push(txt);
        } catch (e) {}
      }
      cur = cur.parentElement || null;
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  function isControlDisabled(el) {
    if (!el) return false;
    try {
      if (el.disabled === true) return true;
      if (typeof el.getAttribute === 'function') {
        const ad = String(el.getAttribute('aria-disabled') || '').toLowerCase();
        if (ad === 'true') return true;
        if (el.hasAttribute('disabled')) return true;
      }
      const cls = String(el.className || '');
      if (/\bMui-disabled\b/i.test(cls) || /\bdisabled\b/i.test(cls)) return true;
    } catch (e) {}
    return false;
  }

  function visibleButtonElements() {
    const selector = 'button, a[role="button"], [role="button"], a.btn, button.btn, [data-testid*="join"], [data-testid*="leave"], [aria-label*="Join" i], [aria-label*="Leave" i], [title*="Join" i], [title*="Leave" i]';
    const nodes = Array.from(new Set(deepQueryAll(document, selector)));
    return nodes.filter((el) => {
      try {
        if (!el || (el.closest && el.closest('#roa-wall-pager'))) return false;
        const rect = el.getBoundingClientRect();
        if (!rect || rect.width < 8 || rect.height < 8) return false;
        const style = window.getComputedStyle(el);
        if (!style || style.visibility === 'hidden' || style.display === 'none' || style.pointerEvents === 'none') return false;
        return true;
      } catch (e) {
        return false;
      }
    });
  }

  function findBlockedMembershipSignal() {
    try {
      const ctl = findMembershipControl();
      if (ctl && ctl.kind === 'closed') {
        return { blocked: true, closed: true, via: 'control', text: safeText(ctl.text) || 'closed' };
      }
    } catch (e) {}
    const nodes = Array.from(new Set(deepQueryAll(document, '.actions-btn-container, [aria-label], [title], button, [role="button"], [data-testid], [class*="actions-btn"]')));
    for (const el of nodes) {
      try {
        if (!el || (el.closest && el.closest('#roa-wall-pager'))) continue;
        const txt = String(getControlContextText(el) || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (!txt) continue;
        if (/community closed|group closed|closed community|closed group|community unavailable|group unavailable|private community|private group|community locked|group locked|membership closed|join disabled|not accepting new members|content deleted|deleted community|deleted group|this community is closed|this group is closed/.test(txt)) {
          return { blocked: true, closed: /closed/.test(txt), via: 'text', text: txt };
        }
        const kind = membershipControlKind(txt);
        if ((kind === 'join' || kind === 'request') && isControlDisabled(el)) {
          return { blocked: true, closed: /closed/.test(txt), via: 'disabled', text: txt };
        }
      } catch (e) {}
    }
    return null;
  }


  async function getAuthenticatedUserId() {
    const st = loadRunnerStateSync() || {};
    if (safeInt(st.selfUserId)) return safeInt(st.selfUserId);
    try {
      const j = await fetchJson('https://users.roblox.com/v1/users/authenticated', { method: 'GET' });
      const uid = safeInt(j && (j.id || j.userId));
      if (uid) {
        saveRunnerStateSync(Object.assign({}, st, { selfUserId: uid }));
      }
      return uid;
    } catch (e) {
      return null;
    }
  }

  function membershipStateFromJson(j) {
    if (!j || typeof j !== 'object') return 'none';
    const roleRank = safeInt(pick(j.userRole && (j.userRole.rank || (j.userRole.role && j.userRole.role.rank)), j.role && j.role.rank, j.rank));
    const roleId = safeInt(pick(j.userRole && (j.userRole.id || (j.userRole.role && j.userRole.role.id)), j.role && j.role.id));
    const roleName = (safeText(pick(j.userRole && (j.userRole.name || (j.userRole.role && j.userRole.role.name)), j.role && j.role.name)) || '').trim().toLowerCase();
    const explicitMember = (j.isInGroup === true) || (j.isMember === true) || (safeText(j.membershipStatus) || '').toLowerCase() === 'member';
    const guestLike = roleName === 'guest' || roleName === 'non-member' || roleName === 'non member';
    const roleImpliesMember = (roleRank !== null && roleRank > 0) || (roleId !== null && roleId > 0 && !guestLike);
    if (explicitMember || roleImpliesMember) return 'in_group';
    const membershipStatus = (safeText(j.membershipStatus) || '').toLowerCase();
    const pending = (j.isPendingJoinRequest === true) || (j.pending === true) || (j.isPending === true) || membershipStatus === 'pending' || membershipStatus === 'pending_join_request';
    if (pending) return 'pending';
    return 'none';
  }

  async function getGroupMembershipViaApi(groupId) {
    try {
      const j = await fetchJson(`https://groups.roblox.com/v1/groups/${groupId}/membership`, { method: 'GET' });
      return { ok: true, status: 200, state: membershipStateFromJson(j), json: j };
    } catch (e) {
      return { ok: false, status: e && e.status ? Number(e.status) : 0, error: String(e && (e.message || e)), state: 'unknown' };
    }
  }

  async function runnerDelayOrStop(ms, state) {
    if (state) return await runnerSleepCancelable(ms, state);
    await sleep(Math.max(0, Number(ms) || 0));
    return true;
  }

  async function runnerPauseIfHiddenOrOffline(state, modeLabel = 'Runner') {
    if (WALL_PAGER.stopOnHidden && document.visibilityState && document.visibilityState !== 'visible') {
      wallPagerSetStatus(`${modeLabel} paused (tab hidden)`);
      while (document.visibilityState !== 'visible') {
        if (state && !runnerStateMatches(state)) return false;
        await sleep(1000);
      }
    }
    if (WALL_PAGER.pauseOnOffline && navigator && navigator.onLine === false) {
      wallPagerSetStatus(`${modeLabel} paused (offline)`);
      while (navigator && navigator.onLine === false) {
        if (state && !runnerStateMatches(state)) return false;
        await sleep(1000);
      }
    }
    return !(state && !runnerStateMatches(state));
  }

  async function runnerWaitFixedDelay(state, modeLabel, delayMs, verb = 'waiting') {
    if (!(await runnerPauseIfHiddenOrOffline(state, modeLabel))) return false;
    const ms = clampInt(delayMs, 0, 60000);
    if (ms > 0) {
      wallPagerSetStatus(`${modeLabel} ${verb} ${(ms / 1000).toFixed(1)}s`);
      if (!(await runnerSleepCancelable(ms, state))) return false;
    }
    return await runnerPauseIfHiddenOrOffline(state, modeLabel);
  }

  async function runnerWaitEntryDelay(state, modeLabel = 'Runner') {
    return await runnerWaitFixedDelay(state, modeLabel, runnerEntryDelayMs(), 'settling');
  }

  async function runnerWaitAdvanceDelay(state, modeLabel = 'Runner') {
    return await runnerWaitFixedDelay(state, modeLabel, runnerAdvanceDelayMs(), 'next in');
  }

  function runnerFinalizeCompletedTarget(state, clearExtra = null) {
    const live = loadRunnerStateSync() || state || {};
    const completed = (safeInt(live.completedGroups) || 0) + 1;
    const cleared = Object.assign({}, live, {
      completedGroups: completed,
      targetId: null,
      joinedByRunner: false,
      targetStatus: null,
      targetGroupName: null,
      targetMemberCount: null,
      targetNavStartedAt: null,
      targetNavAttempts: 0,
    }, clearExtra || {});
    saveRunnerStateSync(cleared);
    return { state: cleared, completedGroups: completed };
  }

  function runnerNextTargetDelayMs(completedGroups) {
    return runnerAdvanceDelayMs() + runnerPeriodicBreakMs(completedGroups);
  }

  function discoveryStatusFromCount(count) {
    const c = safeInt(count) || 0;
    if (c <= 0) return 'EMPTY';
    if (c >= 100) return 'NEEDED';
    return 'DONE';
  }

  function getCommunityAccessState() {
    try {
      const ctl = findMembershipControl();
      if (ctl && ctl.kind === 'closed') {
        return { locked: true, reason: 'membership_control_closed', text: safeText(ctl.text) || '' };
      }
    } catch (e) {}
    try {
      const closedWrap = document.querySelector('.actions-btn-container[aria-label*="Community Closed"], .actions-btn-container[aria-label*="Group Closed"]');
      if (closedWrap) return { locked: true, reason: 'actions_btn_closed', text: safeText(getControlContextText(closedWrap)) || '' };
    } catch (e) {}
    try {
      const disabledJoin = Array.from(document.querySelectorAll('.actions-btn-container button[disabled], .actions-btn-container [aria-disabled="true"]')).find((el) => {
        const txt = (safeText(getControlContextText(el)) || '').toLowerCase();
        return txt.includes('join community') || txt.includes('join group') || txt.includes('request to join');
      });
      if (disabledJoin) return { locked: true, reason: 'disabled_join_control', text: safeText(getControlContextText(disabledJoin)) || '' };
    } catch (e) {}
    return { locked: false, reason: null, text: '' };
  }

  function discoveryStatusFromProbe(probe) {
    // Discovery must always let the wall probe decide first.
    // Only when the wall is unavailable do we fall back to UI state.
    if (probe && probe.ok) return discoveryStatusFromCount(probe.count);
    const status = safeInt(probe && probe.status) || 0;
    const wallUnavailable = (status === 404 || status === 403 || status === 429 || status === 0 || status >= 500);
    if (wallUnavailable) {
      const access = getCommunityAccessState();
      if (access && access.locked) return 'LOCKED';
    }
    return 'CHECK';
  }

  async function waitForMembershipOutcome(state, groupId, timeoutMs = 2400) {
    const until = Date.now() + Math.max(1000, safeInt(timeoutMs) || 12000);
    let lastUi = null;
    let lastApi = null;
    while (Date.now() < until) {
      if (state && !runnerStateMatches(state)) return { ok: false, stopped: true, state: 'unknown', via: 'stopped', lastUi, lastApi };
      const ctl = findMembershipControl();
      if (ctl && ctl.kind) {
        lastUi = ctl.kind;
        if (ctl.kind === 'leave') return { ok: true, state: 'in_group', via: 'ui', lastUi, lastApi };
        if (ctl.kind === 'requested') return { ok: true, state: 'pending', via: 'ui', lastUi, lastApi };
      }
      if (groupId) {
        const api = await getGroupMembershipViaApi(groupId);
        if (api && api.ok) {
          lastApi = api.state;
          if (api.state === 'in_group' || api.state === 'pending') {
            return { ok: true, state: api.state, via: 'api', lastUi, lastApi, json: api.json };
          }
        }
      }
      if (!(await runnerDelayOrStop(300, state))) return { ok: false, stopped: true, state: 'unknown', via: 'stopped', lastUi, lastApi };
    }
    return { ok: false, state: lastApi || (lastUi === 'leave' ? 'in_group' : (lastUi === 'requested' ? 'pending' : 'none')), via: 'timeout', lastUi, lastApi };
  }

  async function cancelPendingJoinRequest(state = null, groupId = null) {
    const ctl = findMembershipControl();
    if (ctl && ctl.kind === 'requested') {
      clickElement(ctl.el);
      if (!(await runnerDelayOrStop(1000, state))) return { ok: false, stopped: true };
      await clickDialogButton(['cancel request', 'cancel', 'yes', 'confirm']);
      if (!(await runnerDelayOrStop(1500, state))) return { ok: false, stopped: true };
    }
    if (groupId) {
      await unrequestGroupJoinViaApi(groupId).catch(() => {});
    }
    return { ok: true };
  }

  async function joinGroupViaApi(groupId) {
    const before = await getGroupMembershipViaApi(groupId);
    if (before.ok && before.state === 'in_group') return { ok: true, joined: true, requested: false, already: true, via: 'api' };
    if (before.ok && before.state === 'pending') return { ok: true, joined: false, requested: true, already: false, via: 'api' };
    const req = await roaRpcRequest(`https://groups.roblox.com/v1/groups/${groupId}/users`, {
      method: 'POST',
      credentials: 'include',
    }).catch((e) => ({ ok: false, status: 0, error: String(e && (e.message || e)), text: '' }));
    const reqStatus = Number(req && req.status || 0);
    let after = null;
    for (let i = 0; i < 2; i++) {
      await sleep(300);
      after = await getGroupMembershipViaApi(groupId);
      if (after.ok && (after.state === 'in_group' || after.state === 'pending')) break;
    }
    if (after && after.ok && after.state === 'in_group') return { ok: true, joined: true, requested: false, already: false, via: 'api', status: reqStatus };
    if (after && after.ok && after.state === 'pending') return { ok: true, joined: false, requested: true, already: false, via: 'api', status: reqStatus };
    if (reqStatus === 400 || reqStatus === 403 || reqStatus === 404) {
      return { ok: false, joined: false, requested: false, already: false, blocked: true, closed: reqStatus === 403 || reqStatus === 404, via: 'api', status: reqStatus, error: safeText(req && req.error), text: safeText(req && req.text) };
    }
    return { ok: !!(req && req.ok), joined: false, requested: false, already: false, via: 'api', status: reqStatus, error: safeText(req && req.error), text: safeText(req && req.text) };
  }

  async function unrequestGroupJoinViaApi(groupId) {
    const uid = await getAuthenticatedUserId();
    if (!uid) return { ok: false, error: 'missing_authenticated_user' };
    const req = await roaRpcRequest(`https://groups.roblox.com/v1/groups/${groupId}/join-requests/users/${uid}`, {
      method: 'DELETE',
      credentials: 'include',
    }).catch((e) => ({ ok: false, status: 0, error: String(e && (e.message || e)), text: '' }));
    return { ok: !!(req && (req.ok || Number(req.status || 0) === 404)), status: Number(req && req.status || 0), error: safeText(req && req.error) };
  }

  async function leaveGroupViaApi(groupId) {
    const uid = await getAuthenticatedUserId();
    if (!uid) return { ok: false, error: 'missing_authenticated_user' };
    const req = await roaRpcRequest(`https://groups.roblox.com/v1/groups/${groupId}/users/${uid}`, {
      method: 'DELETE',
      credentials: 'include',
    }).catch((e) => ({ ok: false, status: 0, error: String(e && (e.message || e)), text: '' }));
    return { ok: !!(req && (req.ok || Number(req.status || 0) === 404)), status: Number(req && req.status || 0), error: safeText(req && req.error) };
  }

  function membershipControlKind(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!t) return null;
    if (t.includes('leave community') || t.includes('leave group') || t === 'leave') return 'leave';
    if (t.includes('cancel request')) return 'requested';
    if (t.includes('requested') || t.includes('pending')) return 'requested';
    if (t.includes('request to join community') || t.includes('request community join') || t.includes('request to join') || t.includes('request join')) return 'request';
    if (t.includes('join community') || t.includes('join group') || t === 'join') return 'join';
    return null;
  }

  function findMembershipControl() {
    const buttons = visibleButtonElements();
    let best = null;
    for (const el of buttons) {
      const text = safeText(getControlContextText(el)) || '';
      const lower = text.toLowerCase();
      const disabled = isControlDisabled(el);
      let kind = membershipControlKind(text);
      if (/community closed|group closed|closed community|closed group/.test(lower)) {
        kind = 'closed';
      } else if (disabled && (kind === 'join' || kind === 'request')) {
        kind = 'closed';
      }
      if (!kind) continue;
      let score = 0;
      try {
        const rect = el.getBoundingClientRect();
        if (rect.top >= 0 && rect.top < Math.max(320, window.innerHeight * 0.5)) score += 10;
        if (rect.left > window.innerWidth * 0.4) score += 5;
      } catch (e) {}
      if (/community/i.test(text)) score += 3;
      if (/group/i.test(text)) score += 2;
      if (kind === 'closed') score += 100;
      const cand = { el, kind, text, score, disabled };
      if (!best || cand.score > best.score) best = cand;
    }
    return best;
  }

  function clickElement(el) {
    if (!el) return false;
    try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch (e) {}
    try { el.focus({ preventScroll: true }); } catch (e) {}
    try {
      const rect = (typeof el.getBoundingClientRect === 'function') ? el.getBoundingClientRect() : null;
      const cx = rect ? (rect.left + rect.width / 2) : 1;
      const cy = rect ? (rect.top + rect.height / 2) : 1;
      const common = { bubbles: true, cancelable: true, composed: true, view: window, clientX: cx, clientY: cy, button: 0, buttons: 1 };
      try { el.dispatchEvent(new PointerEvent('pointerdown', Object.assign({ pointerId: 1, pointerType: 'mouse', isPrimary: true }, common))); } catch (e) {}
      try { el.dispatchEvent(new MouseEvent('mousedown', common)); } catch (e) {}
      try { el.dispatchEvent(new PointerEvent('pointerup', Object.assign({ pointerId: 1, pointerType: 'mouse', isPrimary: true }, common))); } catch (e) {}
      try { el.dispatchEvent(new MouseEvent('mouseup', common)); } catch (e) {}
    } catch (e) {}
    try { el.click(); return true; } catch (e) {}
    try {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, view: window }));
      return true;
    } catch (e) {}
    return false;
  }

  function visibleDialogButtonElements() {
    const containers = Array.from(new Set(deepQueryAll(document, '[role="dialog"], [aria-modal="true"], .modal, .dialog, [data-testid*="modal"], [data-testid*="dialog"], [class*="modal"], [class*="dialog"]')));
    const out = [];
    for (const root of containers) {
      try {
        const rect = root.getBoundingClientRect();
        const style = window.getComputedStyle(root);
        if (!rect || rect.width < 8 || rect.height < 8) continue;
        if (!style || style.visibility === 'hidden' || style.display === 'none' || style.pointerEvents === 'none') continue;
      } catch (e) {
        continue;
      }
      const buttons = Array.from(new Set(deepQueryAll(root, 'button, a[role="button"], [role="button"], a.btn, button.btn, [aria-label], [title]')));
      for (const el of buttons) {
        try {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          if (!rect || rect.width < 8 || rect.height < 8) continue;
          if (!style || style.visibility === 'hidden' || style.display === 'none' || style.pointerEvents === 'none') continue;
          out.push(el);
        } catch (e) {}
      }
    }
    return out;
  }

  function findDialogButton(textNeedles) {
    const needles = Array.isArray(textNeedles) ? textNeedles.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean) : [String(textNeedles || '').trim().toLowerCase()].filter(Boolean);
    let best = null;
    for (const el of visibleDialogButtonElements()) {
      const txt = String(getControlText(el)).replace(/\s+/g, ' ').trim().toLowerCase();
      if (!txt) continue;
      if (!needles.some((n) => txt.includes(n))) continue;
      let score = 0;
      if (txt.includes('join')) score += 3;
      if (txt.includes('request')) score += 3;
      if (txt.includes('confirm') || txt.includes('yes') || txt.includes('ok')) score += 1;
      const cand = { el, txt, score };
      if (!best || cand.score > best.score) best = cand;
    }
    return best;
  }

  async function clickDialogButton(textNeedles, opts = {}) {
    const limitToDialogs = opts && opts.limitToDialogs === true;
    const needles = Array.isArray(textNeedles) ? textNeedles.map((x) => String(x).toLowerCase()) : [String(textNeedles || '').toLowerCase()];
    for (let i = 0; i < 20; i++) {
      const dialogHit = findDialogButton(needles);
      if (dialogHit && clickElement(dialogHit.el)) return true;
      if (!limitToDialogs) {
        for (const el of visibleButtonElements()) {
          const txt = String(getControlText(el)).replace(/\s+/g, ' ').trim().toLowerCase();
          if (!txt) continue;
          if (needles.some((n) => n && txt.includes(n))) {
            if (clickElement(el)) return true;
          }
        }
      }
      await sleep(250);
    }
    return false;
  }

  async function joinGroupVisibly(state = null, groupId = null) {
    const gid = safeInt(groupId || (state && state.targetId) || getGroupIdFromUrl(location.href));
    let sawAnyControl = false;
    let lastCtlKind = null;
    const initialBlocked = findBlockedMembershipSignal();
    if (initialBlocked) {
      return { ok: false, joined: false, requested: false, blocked: true, closed: !!initialBlocked.closed, via: initialBlocked.via || 'ui', sawAnyControl: false, lastCtlKind: 'closed', reason: initialBlocked.text || 'blocked_signal' };
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      if (state && !runnerStateMatches(state)) return { ok: false, stopped: true, joined: false, requested: false };
      const blockedSignal = findBlockedMembershipSignal();
      if (blockedSignal) {
        return { ok: false, joined: false, requested: false, blocked: true, closed: !!blockedSignal.closed, via: blockedSignal.via || 'ui', sawAnyControl, lastCtlKind: 'closed', reason: blockedSignal.text || 'blocked_signal' };
      }
      const ctl = findMembershipControl();
      if (!ctl) {
        if (attempt >= 1 && gid) {
          const apiRes = await joinGroupViaApi(gid);
          if (apiRes && apiRes.requested) {
            await cancelPendingJoinRequest(state, gid).catch(() => {});
            return { ok: true, joined: false, requested: true, via: 'api' };
          }
          if (apiRes && (apiRes.joined || apiRes.already)) return apiRes;
          if (apiRes && apiRes.blocked) return Object.assign({ sawAnyControl, lastCtlKind: 'closed' }, apiRes);
        }
        if (!(await runnerDelayOrStop(300, state))) return { ok: false, stopped: true, joined: false, requested: false };
        continue;
      }
      sawAnyControl = true;
      lastCtlKind = ctl.kind;
      if (ctl.kind === 'closed') {
        return { ok: false, joined: false, requested: false, blocked: true, closed: true, via: 'ui', sawAnyControl, lastCtlKind, reason: 'closed_or_disabled_join' };
      }
      if (ctl.kind === 'leave') return { ok: true, joined: true, requested: false, via: 'ui', already: true };
      if (ctl.kind === 'requested') {
        await cancelPendingJoinRequest(state, gid).catch(() => {});
        return { ok: true, joined: false, requested: true, via: 'ui' };
      }
      if (ctl.kind === 'join' || ctl.kind === 'request') {
        if (ctl.disabled) {
          return { ok: false, joined: false, requested: false, blocked: true, closed: true, via: 'ui', sawAnyControl, lastCtlKind, reason: 'disabled_join_button' };
        }
        clickElement(ctl.el);
        if (!(await runnerDelayOrStop(250, state))) return { ok: false, stopped: true, joined: false, requested: false };
        const maybeDialog = findDialogButton(['join community', 'request to join community', 'join group', 'request to join', 'request join', 'request', 'join', 'ok', 'yes', 'confirm']);
        if (maybeDialog) {
          if (maybeDialog.el !== ctl.el) {
            clickElement(maybeDialog.el);
          } else {
            await clickDialogButton(['join community', 'request to join community', 'join group', 'request to join', 'request join', 'request', 'join', 'ok', 'yes', 'confirm'], { limitToDialogs: true });
          }
          if (!(await runnerDelayOrStop(250, state))) return { ok: false, stopped: true, joined: false, requested: false };
        }
        const outcome = await waitForMembershipOutcome(state, gid, 5000);
        if (outcome && outcome.ok && outcome.state === 'in_group') {
          return { ok: true, joined: true, requested: false, via: outcome.via || 'ui' };
        }
        if (outcome && outcome.ok && outcome.state === 'pending') {
          await cancelPendingJoinRequest(state, gid).catch(() => {});
          return { ok: true, joined: false, requested: true, via: outcome.via || 'ui' };
        }
        const blockedAfterClick = findBlockedMembershipSignal();
        if (blockedAfterClick) {
          return { ok: false, joined: false, requested: false, blocked: true, closed: !!blockedAfterClick.closed, via: blockedAfterClick.via || 'ui', sawAnyControl, lastCtlKind, reason: blockedAfterClick.text || 'blocked_after_click' };
        }
        if (gid) {
          const apiRes = await joinGroupViaApi(gid);
          if (apiRes && apiRes.requested) {
            await cancelPendingJoinRequest(state, gid).catch(() => {});
            return { ok: true, joined: false, requested: true, via: 'api' };
          }
          if (apiRes && (apiRes.joined || apiRes.already)) return apiRes;
          if (apiRes && apiRes.blocked) return Object.assign({ sawAnyControl, lastCtlKind }, apiRes);
        }
        const ctlAfter = findMembershipControl();
        if (ctlAfter && (ctlAfter.kind === 'closed' || ((ctlAfter.kind === 'join' || ctlAfter.kind === 'request') && ctlAfter.disabled))) {
          return { ok: false, joined: false, requested: false, blocked: true, closed: true, via: 'ui', sawAnyControl, lastCtlKind: ctlAfter.kind, reason: 'join_no_state_change' };
        }
        return { ok: false, joined: false, requested: false, blocked: true, closed: false, via: 'ui', sawAnyControl, lastCtlKind, reason: 'join_no_state_change' };
      }
    }
    if (gid) {
      const blockedSignal = findBlockedMembershipSignal();
      if (blockedSignal) {
        return { ok: false, joined: false, requested: false, blocked: true, closed: !!blockedSignal.closed, via: blockedSignal.via || 'ui', sawAnyControl, lastCtlKind: 'closed', reason: blockedSignal.text || 'blocked_signal' };
      }
      const apiRes = await joinGroupViaApi(gid);
      if (apiRes && apiRes.requested) {
        await cancelPendingJoinRequest(state, gid).catch(() => {});
        return { ok: true, joined: false, requested: true, via: 'api' };
      }
      return Object.assign({ sawAnyControl, lastCtlKind }, apiRes || {});
    }
    return { ok: false, joined: false, requested: false, sawAnyControl, lastCtlKind };
  }

  async function leaveGroupVisibly(state = null, groupId = null) {
    const gid = safeInt(groupId || (state && state.targetId) || getGroupIdFromUrl(location.href));
    for (let attempt = 0; attempt < 4; attempt++) {
      if (!runnerStateMatches(state)) return { ok: false, stopped: true, left: false };
      const ctl = findMembershipControl();
      if (!ctl) {
        await sleep(750);
        continue;
      }
      if (ctl.kind !== 'leave') return { ok: true, left: true, via: 'ui' };
      clickElement(ctl.el);
      if (!(await runnerSleepCancelable(750, state))) return { ok: false, stopped: true, left: false };
      await clickDialogButton(['leave', 'yes', 'confirm']);
      if (!(await runnerSleepCancelable(2000, state))) return { ok: false, stopped: true, left: false };
      const after = findMembershipControl();
      if (!after || after.kind !== 'leave') return { ok: true, left: true, via: 'ui' };
    }
    if (gid) {
      return await leaveGroupViaApi(gid);
    }
    return { ok: false, left: false };
  }

  async function maybePersistFallbackGroupInfo(info) {
    try {
      if (!info || !info.groupId || !info.exists) return;
      addRows('rb_static_archive', [{
        id: safeInt(info.groupId),
        owner: safeInt(info.ownerId),
        type: 'group',
        subtype: null,
        creation: null,
        active: true,
        verified: nowIsoZ()
      }]);
      addRows('rb_dynamic_group_archive', [{
        uuid: uuidv4(),
        id: safeInt(info.groupId),
        name: safeText(info.name),
        description: safeText(info.description),
        ranks: null,
        members: safeInt(info.memberCount),
        funds: null,
        verified: (info.verified === true || info.verified === 1) ? 1 : (info.verified === false || info.verified === 0) ? 0 : null,
        links: null,
        affiliates: null,
        captured: nowIsoZ(),
      }]);
      flushNow();
    } catch (e) {}
  }

  async function finishDiscoveryForState(state, status, info) {
    const best = bestGroupInfo(state.targetId, info || {});
    await serverPostJson('/discovery/complete', {
      group_id: state.targetId,
      claimed_by: state.runnerId,
      group_name: best.name,
      member_count: best.memberCount,
      status: String(status || 'ERROR'),
      checked: nowIsoZ(),
    });
  }

  async function runDiscoveryForCurrentTarget(state) {
    const targetId = safeInt(state && state.targetId);
    if (!targetId) return;
    const pre = await fetchGroupInfoPreflight(targetId);
    if (pre && pre.exists) {
      await maybePersistFallbackGroupInfo(pre);
    }

    if (pre && pre.exists === false && safeInt(pre.status) === 404) {
      const info404 = bestGroupInfo(targetId, pre || {});
      await finishDiscoveryForState(state, 'CHECK', info404);
      wallPagerSetStatus(`Discovery ${targetId}: CHECK`);
      if (!runnerStateMatches(state)) return state;
      const finalized404 = runnerFinalizeCompletedTarget(state);
      scheduleRunnerTick(runnerNextTargetDelayMs(finalized404.completedGroups));
      return finalized404.state;
    }

    if (isSearchCommunitiesPage()) {
      const infoSearch = bestGroupInfo(targetId, pre || {});
      await finishDiscoveryForState(state, 'CHECK', infoSearch);
      wallPagerSetStatus(`Discovery ${targetId}: CHECK`);
      if (!runnerStateMatches(state)) return state;
      const finalizedSearch = runnerFinalizeCompletedTarget(state);
      scheduleRunnerTick(runnerNextTargetDelayMs(finalizedSearch.completedGroups));
      return finalizedSearch.state;
    }

    if (getGroupIdFromUrl(location.href) !== targetId) {
      const live = loadRunnerStateSync() || state || {};
      const navState = saveRunnerStateSync(Object.assign({}, live, {
        targetId,
        targetNavStartedAt: Date.now(),
        targetNavAttempts: (safeInt(live.targetNavAttempts) || 0) + 1,
      })) || state;
      wallPagerSetStatus(`Discovery -> ${targetId}`);
      navigateToGroupPage(targetId);
      return navState;
    }

    await runnerMaybeRenewClaim(state);
    if (!(await runnerPauseIfHiddenOrOffline(state, `Discovery ${targetId}`))) return state;
    if (!(await runnerWaitEntryDelay(state, `Discovery ${targetId}`))) return state;

    const info = bestGroupInfo(targetId, pre || {});
    const probe1 = await probeWallOldestPage(targetId, state);
    if (probe1 && probe1.stopped) return state;
    const status = discoveryStatusFromProbe(probe1);
    await finishDiscoveryForState(state, status, info);
    wallPagerSetStatus(`Discovery ${targetId}: ${status}`);

    if (!runnerStateMatches(state)) return state;
    const finalized = runnerFinalizeCompletedTarget(state);
    scheduleRunnerTick(runnerNextTargetDelayMs(finalized.completedGroups));
    return finalized.state;
  }

  async function completeArchiveMode(state, status, extra = {}) {
    const path = state.mode === 'finish' ? '/finish/complete' : '/climb/complete';
    return await serverPostJson(path, Object.assign({
      group_id: state.targetId,
      claimed_by: state.runnerId,
      status: status,
      checked: nowIsoZ(),
    }, extra || {}));
  }

  function effectiveCutoffState(state) {
    const raw = safeText(state && state.cutoffInput) || safeText(WALL_PAGER.cutoffInput) || '';
    const parsed = parseCutoffInput(raw);
    return { raw, boundaryMs: parsed.boundaryMs, boundaryIso: parsed.boundaryIso || '' };
  }

  async function runClimbCurrentTarget(state) {
    const targetId = safeInt(state && state.targetId);
    if (!targetId) return;
    const pre = await fetchGroupInfoPreflight(targetId);
    if (pre && pre.exists === false && safeInt(pre.status) === 404) {
      await completeArchiveMode(state, 'CHECK');
      wallPagerSetStatus(`${state.mode === 'finish' ? 'Finish' : 'Climb'} ${targetId}: CHECK`);
      if (!runnerStateMatches(state)) return state;
      const finalized404 = runnerFinalizeCompletedTarget(state);
      scheduleRunnerTick(runnerNextTargetDelayMs(finalized404.completedGroups));
      return finalized404.state;
    }
    if (isSearchCommunitiesPage()) {
      await completeArchiveMode(state, 'CHECK');
      wallPagerSetStatus(`${state.mode === 'finish' ? 'Finish' : 'Climb'} ${targetId}: CHECK`);
      if (!runnerStateMatches(state)) return state;
      const finalizedSearch = runnerFinalizeCompletedTarget(state);
      scheduleRunnerTick(runnerNextTargetDelayMs(finalizedSearch.completedGroups));
      return finalizedSearch.state;
    }
    if (getGroupIdFromUrl(location.href) !== targetId) {
      const live = loadRunnerStateSync() || state || {};
      const navState = saveRunnerStateSync(Object.assign({}, live, {
        targetId,
        targetNavStartedAt: Date.now(),
        targetNavAttempts: (safeInt(live.targetNavAttempts) || 0) + 1,
      })) || state;
      wallPagerSetStatus(`${state.mode === 'finish' ? 'Finish' : 'Climb'} -> ${targetId}`);
      navigateToGroupPage(targetId);
      return navState;
    }

    await runnerMaybeRenewClaim(state);
    if (!(await runnerPauseIfHiddenOrOffline(state, `${state.mode === 'finish' ? 'Finish' : 'Climb'} ${targetId}`))) return state;

    enableManualCapture();
    wallPagerReadUiSettings();
    WALL_PAGER.groupId = targetId;
    const sortOrder = state.mode === 'finish' ? 'Desc' : 'Asc';
    WALL_PAGER.sortOrder = sortOrder;
    const sel = WALL_PAGER.ui && WALL_PAGER.ui.sortSel;
    if (sel) sel.value = sortOrder;
    WALL_PAGER.pages = [];
    WALL_PAGER.pageIndex = 0;

    const cutoff = effectiveCutoffState(state);
    const finishReachedMs = state.mode === 'finish' ? (Number.isFinite(Date.parse(safeText(state && state.reachedTimestamp) || '')) ? Date.parse(safeText(state && state.reachedTimestamp) || '') : null) : null;
    let hitBoundary = false;
    let reachedTimestamp = safeText(state && state.reachedTimestamp) || '';

    let firstLoad = await wallPagerLoadFirstPage();
    while (firstLoad && (firstLoad.rateLimited || firstLoad.tempError)) {
      const retryMs = wallPagerCalcRetryDelayMs();
      wallPagerSetStatus(`${state.mode === 'finish' ? 'Finish' : 'Climb'} ${targetId} retry ${(retryMs / 1000).toFixed(1)}s`);
      if (!(await runnerSleepCancelable(retryMs, { mode: state.mode, targetId, runnerId: state.runnerId }))) return state;
      const liveRetryState = loadRunnerStateSync() || state;
      await runnerMaybeRenewClaim(liveRetryState).catch(() => {});
      firstLoad = await wallPagerLoadFirstPage();
    }
    if (firstLoad && !firstLoad.ok && !WALL_PAGER.pages.length) {
      await completeArchiveMode(state, 'CHECK');
      wallPagerSetStatus(`${state.mode === 'finish' ? 'Finish' : 'Climb'} ${targetId}: CHECK`);
      if (!runnerStateMatches(state)) return state;
      const finalizedLoad = runnerFinalizeCompletedTarget(state);
      scheduleRunnerTick(runnerNextTargetDelayMs(finalizedLoad.completedGroups));
      return finalizedLoad.state;
    }

    const checkCurrentPageForStop = () => {
      const cur = WALL_PAGER.pages[WALL_PAGER.pageIndex];
      const items = Array.isArray(cur && cur.data && cur.data.data) ? cur.data.data : [];
      if (state.mode === 'finish') {
        if (Number.isFinite(finishReachedMs) && pageReachedFinishTimestamp(items, finishReachedMs)) {
          hitBoundary = true;
          return true;
        }
        return false;
      }
      if (Number.isFinite(cutoff.boundaryMs)) {
        const firstAfter = findFirstPostAfterBoundary(items, cutoff.boundaryMs);
        if (firstAfter && firstAfter.timestamp) {
          hitBoundary = true;
          reachedTimestamp = firstAfter.timestamp;
          return true;
        }
      }
      return false;
    };

    let steps = 0;
    checkCurrentPageForStop();
    let delayBeforeNextMs = wallPagerCalcNormalDelayMs();
    while (!hitBoundary) {
      const liveState = loadRunnerStateSync();
      if (!liveState || !liveState.active || liveState.mode !== state.mode || safeInt(liveState.targetId) !== targetId) return state;
      await runnerMaybeRenewClaim(liveState);
      wallPagerReadUiSettings();

      if (!(await runnerPauseIfHiddenOrOffline({ mode: state.mode, targetId, runnerId: state.runnerId }, `${state.mode === 'finish' ? 'Finish' : 'Climb'} ${targetId}`))) return state;

      const cur = WALL_PAGER.pages[WALL_PAGER.pageIndex];
      const hasCachedNext = !!WALL_PAGER.pages[WALL_PAGER.pageIndex + 1];
      if (!cur || !cur.nextCursor) break;

      if (!hasCachedNext && delayBeforeNextMs > 0) {
        WALL_PAGER.lastDelayMs = delayBeforeNextMs;
        wallPagerSetStatus(`${state.mode === 'finish' ? 'Finish' : 'Climb'} waiting ${(delayBeforeNextMs / 1000).toFixed(1)}s`);
        if (!(await runnerSleepCancelable(delayBeforeNextMs, { mode: state.mode, targetId, runnerId: state.runnerId }))) return state;
      }

      const r = await wallPagerGoNext(true);
      if (r && r.fatal) break;
      if (r && r.end) break;
      if (r && (r.rateLimited || r.tempError)) {
        delayBeforeNextMs = wallPagerCalcRetryDelayMs();
        continue;
      }
      if (r && r.progressed) {
        steps++;
        if (checkCurrentPageForStop()) break;
      }

      let nextDelay = hasCachedNext ? 0 : wallPagerCalcNormalDelayMs();
      if (r && r.progressed && WALL_PAGER.breakEveryPages > 0 && (steps % WALL_PAGER.breakEveryPages) === 0) {
        const pause = clampInt(randBetween(WALL_PAGER.breakMinMs, WALL_PAGER.breakMaxMs), 0, WALL_PAGER.maxDelayMs);
        if (pause > 0) {
          wallPagerSetStatus(`${state.mode === 'finish' ? 'Finish' : 'Climb'} break ${(pause / 1000).toFixed(0)}s`);
          nextDelay = clampInt(nextDelay + pause, 0, WALL_PAGER.maxDelayMs);
        }
      }
      delayBeforeNextMs = nextDelay;
    }

    if (!runnerStateMatches({ mode: state.mode, targetId, runnerId: state.runnerId })) return state;
    if (state.mode === 'finish') {
      await completeArchiveMode(state, 'DONE', {
        reached_timestamp: safeText(state && state.reachedTimestamp) || '',
      });
      const finalized = runnerFinalizeCompletedTarget(state);
      wallPagerSetStatus(`Finish ${targetId}: DONE`);
      scheduleRunnerTick(clampInt(wallPagerCalcNormalDelayMs() + runnerPeriodicBreakMs(finalized.completedGroups), 0, WALL_PAGER.maxDelayMs));
      return finalized.state;
    }

    if (Number.isFinite(cutoff.boundaryMs)) {
      if (hitBoundary && reachedTimestamp) {
        await completeArchiveMode(state, 'PARTIAL', {
          boundary_date: cutoff.boundaryIso || cutoff.raw || '',
          reached_timestamp: reachedTimestamp,
        });
        const finalized = runnerFinalizeCompletedTarget(state);
        wallPagerSetStatus(`Climb ${targetId}: PARTIAL @ ${reachedTimestamp}`);
        scheduleRunnerTick(clampInt(wallPagerCalcNormalDelayMs() + runnerPeriodicBreakMs(finalized.completedGroups), 0, WALL_PAGER.maxDelayMs));
        return finalized.state;
      }
      await completeArchiveMode(state, 'DONE', {
        boundary_date: cutoff.boundaryIso || cutoff.raw || '',
      });
      const finalized = runnerFinalizeCompletedTarget(state);
      wallPagerSetStatus(`Climb ${targetId}: DONE`);
      scheduleRunnerTick(clampInt(wallPagerCalcNormalDelayMs() + runnerPeriodicBreakMs(finalized.completedGroups), 0, WALL_PAGER.maxDelayMs));
      return finalized.state;
    }

    await completeArchiveMode(state, 'CLIMBED');
    const finalized = runnerFinalizeCompletedTarget(state);
    wallPagerSetStatus(`Climb ${targetId}: CLIMBED`);
    scheduleRunnerTick(clampInt(wallPagerCalcNormalDelayMs() + runnerPeriodicBreakMs(finalized.completedGroups), 0, WALL_PAGER.maxDelayMs));
    return finalized.state;
  }

  async function runRunnerTick() {
    if (RUNNER.inTick) return;
    const state = loadRunnerStateSync();
    if (!state || !state.active) {
      runnerSyncUiFromState();
      return;
    }
    RUNNER.inTick = true;
    try {
      runnerSyncUiFromState();
      enableManualCapture();

      if (state.mode === 'discovery') {
        if (!state.targetId) {
          const claim = await serverPostJson('/discovery/claim', {
            minimum_id: safeInt(state.minimumId) || runnerCurrentMinIdFromUi(),
            claimed_by: state.runnerId || WALL_RUNTIME_SESSION_ID,
            lease_seconds: state.leaseSeconds || RUNNER.leaseSeconds,
          });
          if (!claim || !claim.ok || !safeInt(claim.group_id)) {
            if (claim && claim.idle) {
              wallPagerSetStatus('Discovery idle');
              scheduleRunnerTick(3000);
              return;
            }
            wallPagerSetStatus('Discovery claim failed');
            scheduleRunnerTick(3000);
            return;
          }
          saveRunnerStateSync(Object.assign({}, state, { targetId: safeInt(claim.group_id), targetStatus: null, joinedByRunner: false, targetNavStartedAt: null, targetNavAttempts: 0 }));
        }
        await runDiscoveryForCurrentTarget(loadRunnerStateSync() || state);
      } else if (state.mode === 'climb' || state.mode === 'finish') {
        if (!state.targetId) {
          const path = state.mode === 'finish' ? '/finish/claim' : '/climb/claim';
          const claim = await serverPostJson(path, {
            claimed_by: state.runnerId || WALL_RUNTIME_SESSION_ID,
            lease_seconds: state.leaseSeconds || RUNNER.leaseSeconds,
          });
          if (!claim || !claim.ok) {
            wallPagerSetStatus(`${state.mode === 'finish' ? 'Finish' : 'Climb'} claim failed`);
            return;
          }
          const gid = safeInt(claim.group_id);
          if (!gid) {
            const msg = state.mode === 'finish' ? 'Finish complete - no more PARTIAL groups' : 'Climb complete - no more NEEDED groups';
            wallPagerSetStatus(msg);
            await stopRunnerMode(msg);
            return;
          }
          saveRunnerStateSync(Object.assign({}, state, {
            targetId: gid,
            targetStatus: safeText(claim.status) || null,
            targetGroupName: safeText(claim.group_name) || null,
            targetMemberCount: safeInt(claim.member_count),
            reachedTimestamp: safeText(claim.reached_timestamp) || '',
            boundaryDate: safeText(claim.boundary_date) || '',
            joinedByRunner: false,
            targetNavStartedAt: null,
            targetNavAttempts: 0,
          }));
        }
        await runClimbCurrentTarget(loadRunnerStateSync() || state);
      }
    } finally {
      RUNNER.inTick = false;
      runnerSyncUiFromState();
    }
  }

  function wallPagerReadUiSettings() {
    try {
      const ui = WALL_PAGER.ui || {};

      if (ui.delayInp) {
        const sec = clampInt(ui.delayInp.value, 1, 60);
        ui.delayInp.value = String(sec);
        WALL_PAGER.baseDelayMs = sec * 1000;
      }

      if (ui.jitterInp) {
        const sec = Number(ui.jitterInp.value);
        const v = Math.max(0, Math.min(10, Number.isFinite(sec) ? sec : 0));
        ui.jitterInp.value = v.toFixed(1);
        WALL_PAGER.jitterMs = Math.round(v * 1000);
      }

      if (ui.breakEveryInp) {
        const n = clampInt(ui.breakEveryInp.value, 0, 5000);
        ui.breakEveryInp.value = String(n);
        WALL_PAGER.breakEveryPages = n;
      }

      let breakMinSec = Math.round(WALL_PAGER.breakMinMs / 1000);
      let breakMaxSec = Math.round(WALL_PAGER.breakMaxMs / 1000);
      if (ui.breakMinInp) breakMinSec = clampInt(ui.breakMinInp.value, 0, 300);
      if (ui.breakMaxInp) breakMaxSec = clampInt(ui.breakMaxInp.value, 0, 300);
      if (breakMaxSec < breakMinSec) breakMaxSec = breakMinSec;
      if (ui.breakMinInp) ui.breakMinInp.value = String(breakMinSec);
      if (ui.breakMaxInp) ui.breakMaxInp.value = String(breakMaxSec);
      WALL_PAGER.breakMinMs = breakMinSec * 1000;
      WALL_PAGER.breakMaxMs = breakMaxSec * 1000;

      if (ui.capInp) {
        const n = clampInt(ui.capInp.value, 0, 50000);
        ui.capInp.value = String(n);
        WALL_PAGER.maxAutoPages = n;
      }

      if (ui.hiddenCb) WALL_PAGER.stopOnHidden = !!ui.hiddenCb.checked;
      if (ui.offCb) WALL_PAGER.pauseOnOffline = !!ui.offCb.checked;
    } catch (e) {}
  }

  function wallPagerCalcNormalDelayMs() {
    wallPagerReadUiSettings();
    const jitter = randBetween(0, Math.max(0, WALL_PAGER.jitterMs));
    const extra = Math.random() < 0.08 ? randBetween(1500, 7000) : 0;
    return clampInt(WALL_PAGER.baseDelayMs + jitter + extra, 1000, WALL_PAGER.maxDelayMs);
  }

  function wallPagerCalcRetryDelayMs() {
    wallPagerReadUiSettings();
    const jitter = randBetween(0, Math.max(500, WALL_PAGER.jitterMs));
    return clampInt((WALL_PAGER.backoffMs || 15000) + jitter, 3000, WALL_PAGER.maxDelayMs);
  }

  function clampInt(n, lo, hi) {
    n = Math.trunc(Number(n));
    if (!Number.isFinite(n)) return lo;
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
  }


  function randBetween(min, max) {
    min = Number(min); max = Number(max);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return 0;
    if (max < min) { const t = min; min = max; max = t; }
    return min + Math.random() * (max - min);
  }

  async function saveWallPagerPrefs() {
    try {
      runnerReadUiSettings();
      await storageSet({
        roa_wall_pager_prefs: {
          sortOrder: WALL_PAGER.sortOrder,
          baseDelayMs: WALL_PAGER.baseDelayMs,
          jitterMs: WALL_PAGER.jitterMs,
          breakEveryPages: WALL_PAGER.breakEveryPages,
          breakMinMs: WALL_PAGER.breakMinMs,
          breakMaxMs: WALL_PAGER.breakMaxMs,
          maxAutoPages: WALL_PAGER.maxAutoPages,
          stopOnHidden: WALL_PAGER.stopOnHidden,
          pauseOnOffline: WALL_PAGER.pauseOnOffline,
          runnerMode: WALL_PAGER.runnerMode,
          discoveryMinId: WALL_PAGER.discoveryMinId,
          notifyMode: WALL_PAGER.notifyMode,
          cutoffInput: WALL_PAGER.cutoffInput || ''
        }
      });
    } catch (e) {}
  }


  function wallPagerNotifyModeLabel(mode = null) {
    const m = String(mode || WALL_PAGER.notifyMode || 'off');
    if (m === 'on') return 'Notify: On';
    if (m === 'repeat_1m') return 'Notify: Repeat 1m';
    if (m === 'repeat_15m') return 'Notify: Repeat 15m';
    return 'Notify: Off';
  }

  function wallPagerNotifyRepeatMs(mode = null) {
    const m = String(mode || WALL_PAGER.notifyMode || 'off');
    if (m === 'repeat_1m') return 60 * 1000;
    if (m === 'repeat_15m') return 15 * 60 * 1000;
    return 0;
  }

  function wallPagerUpdateNotifyUi() {
    try {
      const btn = WALL_PAGER.el && WALL_PAGER.el.querySelector('[data-roa-notify]');
      if (btn) btn.textContent = wallPagerNotifyModeLabel();
    } catch (e) {}
  }

  function wallPagerClearNotifyTimer() {
    try {
      if (WALL_PAGER.notifyTimer) {
        clearInterval(WALL_PAGER.notifyTimer);
        WALL_PAGER.notifyTimer = null;
      }
    } catch (e) {}
  }

  function wallPagerBadgeIconDataUrl() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="14" fill="#ff2b2b"/></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function wallPagerSetTabAttention(active) {
    try {
      if (!WALL_PAGER.originalTitle) WALL_PAGER.originalTitle = String(document.title || '');
      if (active) {
        if (!/^●\s/.test(String(document.title || ''))) {
          document.title = `● ${WALL_PAGER.originalTitle || document.title || ''}`.trim();
        }
        const rels = ['icon', 'shortcut icon'];
        for (const rel of rels) {
          let link = document.querySelector(`link[rel="${rel}"]`);
          if (!link) {
            link = document.createElement('link');
            link.rel = rel;
            document.head.appendChild(link);
          }
          if (!link.dataset.roaOriginalHref) link.dataset.roaOriginalHref = link.href || '';
          link.href = wallPagerBadgeIconDataUrl();
        }
        WALL_PAGER.badgeActive = true;
        return;
      }
      if (WALL_PAGER.originalTitle && /^●\s/.test(String(document.title || ''))) {
        document.title = WALL_PAGER.originalTitle;
      }
      for (const link of Array.from(document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]'))) {
        const orig = link.dataset && link.dataset.roaOriginalHref;
        if (orig != null) link.href = orig;
      }
      WALL_PAGER.badgeActive = false;
    } catch (e) {}
  }

  function wallPagerPlayDoneSound() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const notes = [0, 0.16, 0.32];
      for (const at of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
        gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + at + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + at);
        osc.stop(ctx.currentTime + at + 0.2);
      }
      setTimeout(() => { try { ctx.close(); } catch (e) {} }, 900);
    } catch (e) {}
  }

  function wallPagerHandleCompletion(reason = 'Wall finished') {
    try {
      const key = `${safeInt(WALL_PAGER.groupId) || 0}:${safeText(reason) || 'done'}:${safeText((WALL_PAGER.pages[WALL_PAGER.pageIndex] || {}).cursorStart) || ''}`;
      if (WALL_PAGER.notifyDoneKey === key) return;
      WALL_PAGER.notifyDoneKey = key;
      wallPagerSetTabAttention(true);
      if (WALL_PAGER.notifyMode !== 'off') wallPagerPlayDoneSound();
      wallPagerClearNotifyTimer();
      const repeatMs = wallPagerNotifyRepeatMs();
      if (repeatMs > 0) {
        WALL_PAGER.notifyTimer = setInterval(() => {
          try { wallPagerPlayDoneSound(); } catch (e) {}
        }, repeatMs);
      }
      wallPagerSetStatus(reason);
    } catch (e) {}
  }

  function wallPagerClearCompletionSignal() {
    WALL_PAGER.notifyDoneKey = null;
    wallPagerClearNotifyTimer();
    wallPagerSetTabAttention(false);
  }

  async function wallPagerCycleNotifyMode() {
    const order = ['off', 'on', 'repeat_1m', 'repeat_15m'];
    const cur = String(WALL_PAGER.notifyMode || 'off');
    const idx = Math.max(0, order.indexOf(cur));
    WALL_PAGER.notifyMode = order[(idx + 1) % order.length];
    wallPagerUpdateNotifyUi();
    await saveWallPagerPrefs();
    if (!WALL_PAGER.notifyDoneKey) wallPagerClearNotifyTimer();
    else if (WALL_PAGER.notifyMode === 'off') wallPagerClearNotifyTimer();
    else if (wallPagerNotifyRepeatMs() > 0) {
      wallPagerClearNotifyTimer();
      WALL_PAGER.notifyTimer = setInterval(() => {
        try { wallPagerPlayDoneSound(); } catch (e) {}
      }, wallPagerNotifyRepeatMs());
    } else {
      wallPagerClearNotifyTimer();
    }
    wallPagerSetStatus(wallPagerNotifyModeLabel());
  }

  function enableManualCapture() {
    if (WALL_PAGER.manualCaptureEnabled) return;
    WALL_PAGER.manualCaptureEnabled = true;
    try { injectPageHookOnce().catch(() => {}); } catch (e) {}
  }

  function storageGet(keys) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(keys, (r) => resolve(r || {}));
      } catch (e) {
        resolve({});
      }
    });
  }

  function storageSet(obj) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set(obj, () => resolve(true));
      } catch (e) {
        resolve(false);
      }
    });
  }

  function runtimeMessage(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (res) => {
          try {
            const err = chrome.runtime && chrome.runtime.lastError;
            if (err) {
              resolve({ ok: false, status: 0, error: String(err.message || err) });
              return;
            }
          } catch (e) {}
          resolve(res || { ok: false, status: 0, error: 'empty_runtime_response' });
        });
      } catch (e) {
        resolve({ ok: false, status: 0, error: String(e && (e.message || e)) });
      }
    });
  }

  const WALL_RUNTIME_SESSION_ID = (() => {
    try {
      const k = 'roa_wall_runtime_session_id';
      let v = sessionStorage.getItem(k);
      if (!v) {
        v = uuidv4();
        sessionStorage.setItem(k, v);
      }
      return v;
    } catch (e) {
      return `roa-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  })();

  function wallPagerRuntimeStateKey() {
    return `roa_wall_state_rt_${WALL_RUNTIME_SESSION_ID}`;
  }

  function wallPagerPageStateKey(groupId) {
    const gid = safeInt(groupId);
    if (!gid) return null;
    return `roa_wall_state_g_${gid}`;
  }

  function wallPagerBuildSavedState(extra = {}) {
    const curPage = WALL_PAGER.pages[WALL_PAGER.pageIndex] || null;
    const inputCursor = safeText(WALL_PAGER.ui && WALL_PAGER.ui.cursorInp ? WALL_PAGER.ui.cursorInp.value : null);
    const requestCursor = safeText(extra.requestCursor !== undefined ? extra.requestCursor : (curPage ? curPage.cursorStart : inputCursor));
    const nextCursor = safeText(extra.nextCursor !== undefined ? extra.nextCursor : (curPage ? curPage.nextCursor : null));
    const proxyValue = safeText(
      extra.proxyValue !== undefined
        ? extra.proxyValue
        : (WALL_PAGER.ui && WALL_PAGER.ui.proxyInp ? WALL_PAGER.ui.proxyInp.value : (WALL_PAGER.proxyValue || ''))
    ) || '';

    return {
      groupId: safeInt(extra.groupId !== undefined ? extra.groupId : WALL_PAGER.groupId),
      sortOrder: (extra.sortOrder === 'Asc' || extra.sortOrder === 'Desc') ? extra.sortOrder : WALL_PAGER.sortOrder,
      limit: clampInt(extra.limit !== undefined ? extra.limit : WALL_PAGER.limit, 1, 100),
      apiVer: (extra.apiVer === 'v1' || extra.apiVer === 'v2') ? extra.apiVer : WALL_PAGER.apiVer,
      requestCursor,
      nextCursor,
      resumeCursor: nextCursor || requestCursor || null,
      requestUrl: safeText(extra.requestUrl !== undefined ? extra.requestUrl : location.href),
      proxyValue,
      source: safeText(extra.source || null),
      savedAt: nowIsoZ(),
    };
  }

  function wallPagerSyncCursorUi(extra = {}) {
    try {
      const curPage = WALL_PAGER.pages[WALL_PAGER.pageIndex] || null;
      const requestCursor = safeText(extra.requestCursor !== undefined ? extra.requestCursor : (curPage ? curPage.cursorStart : null)) || '';
      const nextCursor = safeText(extra.nextCursor !== undefined ? extra.nextCursor : (curPage ? curPage.nextCursor : null)) || '';
      if (WALL_PAGER.ui && WALL_PAGER.ui.nextCursorInp) WALL_PAGER.ui.nextCursorInp.value = nextCursor;
      if (WALL_PAGER.ui && WALL_PAGER.ui.cursorInp && document.activeElement !== WALL_PAGER.ui.cursorInp) {
        if (!WALL_PAGER.ui.cursorInp.value || requestCursor || nextCursor) {
          WALL_PAGER.ui.cursorInp.value = nextCursor || requestCursor || '';
        }
      }
    } catch (e) {}
  }

  async function saveWallPagerState(extra = {}) {
    const state = wallPagerBuildSavedState(extra || {});
    const payload = {
      [wallPagerRuntimeStateKey()]: state,
    };
    const pageKey = wallPagerPageStateKey(state.groupId);
    if (pageKey) payload[pageKey] = state;
    await storageSet(payload);
    WALL_PAGER.proxyValue = state.proxyValue || '';
    wallPagerSyncCursorUi(state);
    return state;
  }

  async function loadWallPagerState(groupId) {
    const keys = [wallPagerRuntimeStateKey()];
    const pageKey = wallPagerPageStateKey(groupId);
    if (pageKey) keys.push(pageKey);
    const r = await storageGet(keys);
    const wanted = safeInt(groupId);
    const runtimeState = r?.[wallPagerRuntimeStateKey()] || null;
    const pageState = pageKey ? (r?.[pageKey] || null) : null;

    if (wanted) {
      if (runtimeState && safeInt(runtimeState.groupId) === wanted) return runtimeState;
      if (pageState && safeInt(pageState.groupId) === wanted) return pageState;
      return null;
    }

    return runtimeState || pageState || null;
  }

  function recordWallRequestState(groupId, requestMeta = {}) {
    try {
      const gid = safeInt(groupId);
      if (!gid) return;

      const requestCursor = safeText(requestMeta.requestCursor !== undefined ? requestMeta.requestCursor : null);
      const nextCursor = safeText(requestMeta.nextCursor !== undefined ? requestMeta.nextCursor : null);
      const requestUrl = safeText(requestMeta.requestUrl || null) || wallApiUrl(gid, requestCursor);
      const itemCount = safeInt(requestMeta.itemCount);
      const status = safeInt(requestMeta.status);
      const ok = requestMeta.ok === false ? 0 : 1;

      addRows('rb_misc_archive', [{
        uuid: uuidv4(),
        url: requestUrl,
        key: 'roblox_wall_request',
        captured: nowIsoZ(),
        metadata: jsonOrNull({
          groupId: gid,
          source: safeText(requestMeta.source || null),
          apiVersion: safeText(requestMeta.apiVer || WALL_PAGER.apiVer || null),
          sortOrder: safeText(requestMeta.sortOrder || WALL_PAGER.sortOrder || null),
          requestCursor,
          nextCursor,
          resumeCursor: nextCursor || requestCursor || null,
          itemCount,
          status,
          ok,
          proxyValue: safeText(requestMeta.proxyValue !== undefined ? requestMeta.proxyValue : (WALL_PAGER.proxyValue || '')) || ''
        })
      }]);
      flushNow();

      saveWallPagerState({
        groupId: gid,
        requestCursor,
        nextCursor,
        requestUrl,
        source: requestMeta.source || 'wall_request',
        apiVer: requestMeta.apiVer || WALL_PAGER.apiVer,
        sortOrder: requestMeta.sortOrder || WALL_PAGER.sortOrder,
        proxyValue: requestMeta.proxyValue,
      }).catch(() => {});
    } catch (e) {}
  }

  async function loadWallPagerPrefs() {
    try {
      const r = await storageGet(['roa_wall_pager_prefs']);
      const p = r && r.roa_wall_pager_prefs ? r.roa_wall_pager_prefs : null;
      if (p && typeof p === 'object') {
        if (p.sortOrder === 'Asc' || p.sortOrder === 'Desc') WALL_PAGER.sortOrder = p.sortOrder;
        if (p.baseDelayMs != null) WALL_PAGER.baseDelayMs = clampInt(p.baseDelayMs, 1000, 60000);
        if (p.jitterMs != null) WALL_PAGER.jitterMs = clampInt(p.jitterMs, 0, 10000);
        if (p.breakEveryPages != null) WALL_PAGER.breakEveryPages = clampInt(p.breakEveryPages, 0, 5000);
        if (p.breakMinMs != null) WALL_PAGER.breakMinMs = clampInt(p.breakMinMs, 0, 300000);
        if (p.breakMaxMs != null) WALL_PAGER.breakMaxMs = clampInt(p.breakMaxMs, 0, 300000);
        if (p.maxAutoPages != null) WALL_PAGER.maxAutoPages = clampInt(p.maxAutoPages, 0, 50000);
        if (typeof p.stopOnHidden === 'boolean') WALL_PAGER.stopOnHidden = p.stopOnHidden;
        if (typeof p.pauseOnOffline === 'boolean') WALL_PAGER.pauseOnOffline = p.pauseOnOffline;
        if (p.runnerMode === 'wall' || p.runnerMode === 'discovery' || p.runnerMode === 'climb' || p.runnerMode === 'finish') WALL_PAGER.runnerMode = p.runnerMode;
        if (p.discoveryMinId != null) WALL_PAGER.discoveryMinId = clampInt(p.discoveryMinId, 1, 2147483647);
        if (p.notifyMode === 'off' || p.notifyMode === 'on' || p.notifyMode === 'repeat_1m' || p.notifyMode === 'repeat_15m') WALL_PAGER.notifyMode = p.notifyMode;
        if (p.cutoffInput != null) { WALL_PAGER.cutoffInput = safeText(p.cutoffInput) || ''; const parsed = parseCutoffInput(WALL_PAGER.cutoffInput); WALL_PAGER.cutoffBoundaryIso = parsed.boundaryIso || ''; }
      }
    } catch (e) {}
  }

  function wallApiUrl(groupId, cursorStart) {
    const base = `https://groups.roblox.com/${WALL_PAGER.apiVer}/groups/${groupId}/wall/posts?sortOrder=${encodeURIComponent(WALL_PAGER.sortOrder)}&limit=${WALL_PAGER.limit}`;
    return base + (cursorStart ? `&cursor=${encodeURIComponent(cursorStart)}` : '');
  }

  async function fetchJsonEx(url, opts = {}, proxyValue = null) {
    const headers = Object.assign({ 'Accept': 'application/json' }, (opts.headers || {}));
    const proxyText = safeText(proxyValue) ? String(proxyValue).trim() : '';

    if (proxyText) {
      const proxied = await runtimeMessage({
        type: 'proxy_fetch_json',
        url,
        proxyValue: proxyText,
        headers,
      });
      if (!proxied || typeof proxied !== 'object') {
        return { ok: false, status: 0, error: 'proxy_runtime_failed', text: '' };
      }
      const status = Number(proxied.status || 0);
      if (!proxied.ok) {
        return { ok: false, status, error: proxied.error || (status ? `HTTP ${status}` : 'proxy_fetch_failed'), text: String(proxied.text || '') };
      }
      return { ok: true, status, json: proxied.json, text: '' };
    }

    try {
      const r = await roaRpcFetchText(url, Object.assign({}, opts, { headers, method: (opts.method || 'GET'), credentials: 'include' }));
      if (!r) return { ok: false, status: 0, error: 'rpc_empty', text: '' };
      const status = Number(r.status || 0);
      if (!(r.ok && status >= 200 && status < 300)) {
        return { ok: false, status, error: r.error || `HTTP ${status || 0}`, text: String(r.text || '') };
      }
      const txt = String(r.text || '');
      let j = null;
      try { j = JSON.parse(txt); } catch (e) { return { ok: false, status, error: 'invalid_json', text: txt }; }
      return { ok: true, status, json: j, text: txt };
    } catch (e) {
      // fallback: direct fetch
      try {
        const res = await fetch(url, Object.assign({}, opts, { headers, credentials: 'include' }));
        const status = res.status;
        const txt = await res.text().catch(() => '');
        if (!res.ok) return { ok: false, status, error: `HTTP ${status}`, text: txt };
        let j = null;
        try { j = JSON.parse(txt); } catch (e2) { return { ok: false, status, error: 'invalid_json', text: txt }; }
        return { ok: true, status, json: j, text: txt };
      } catch (e2) {
        return { ok: false, status: 0, error: String(e2 && (e2.message || e2)), text: '' };
      }
    }
  }

  function archiveWallFromJson(groupId, j, capturedIso, requestMeta = {}) {
    try {
      const items = (j && j.data) || [];
      const gid = safeInt(groupId);
      const nextCursor = safeText(j && (j.nextPageCursor || j.nextPageToken || j.nextPage));

      if (!gid || !Array.isArray(items)) {
        recordWallRequestState(gid, {
          ...requestMeta,
          nextCursor,
          itemCount: 0,
          status: 200,
          ok: true,
        });
        return;
      }

      const wallRows = [];
      const staticRows = [];

      for (const p of items) {
        const postId = safeInt(p && p.id);
        if (!postId) continue;

        const poster = extractWallPostPoster(p || {});
        wallRows.push({
          post_id: postId,
          group_id: gid,
          user_id: poster.pid,
          username: poster.uname,
          role: poster.roleName,
          body: safeText(p && p.body),
          created: pick(p && p.created, p && p.createdAt, p && p.created_at),
        });

        if (poster.pid) {
          staticRows.push({
            id: safeInt(poster.pid),
            owner: null,
            type: 'user',
            subtype: null,
            creation: null,
            active: true,
            verified: capturedIso
          });
        }
      }

      if (wallRows.length) {
        addRows('rb_group_wall_archive', wallRows);
        if (staticRows.length) addRows('rb_static_archive', staticRows);
        flushNow();
      }

      recordWallRequestState(gid, {
        ...requestMeta,
        nextCursor,
        itemCount: wallRows.length,
        status: 200,
        ok: true,
      });
    } catch (e) {}
  }

  function ensureWallPagerStyles() {
    if (WALL_PAGER.styleEl) return;
    const st = document.createElement('style');
    st.id = 'roa-wall-pager-style';
    st.textContent = `
#roa-wall-pager{position:fixed;right:14px;top:88px;width:420px;height:560px;z-index:2147483647;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#e9e9e9}
#roa-wall-pager .roa-card{height:100%;background:rgba(22,22,22,.92);border:1px solid rgba(255,255,255,.12);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.4);display:flex;flex-direction:column;overflow:hidden}
#roa-wall-pager .roa-head{display:flex;align-items:center;justify-content:space-between;padding:10px 10px;border-bottom:1px solid rgba(255,255,255,.10);gap:8px}
#roa-wall-pager .roa-title{font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#roa-wall-pager .roa-mini{opacity:.85;font-size:12px}
#roa-wall-pager .roa-btn{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);color:#f2f2f2;border-radius:8px;padding:6px 8px;font-size:12px;cursor:pointer}
#roa-wall-pager .roa-btn:disabled{opacity:.45;cursor:not-allowed}
#roa-wall-pager .roa-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.08)}
#roa-wall-pager select,#roa-wall-pager input{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:#f2f2f2;border-radius:8px;padding:6px 8px;font-size:12px}
#roa-wall-pager .roa-status{padding:6px 10px;font-size:12px;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-bottom:1px solid rgba(255,255,255,.08)}
#roa-wall-pager .roa-list{flex:1;overflow:auto;padding:10px}
#roa-wall-pager .roa-post{border:1px solid rgba(255,255,255,.10);border-radius:10px;padding:8px 8px;margin-bottom:8px;background:rgba(0,0,0,.18)}
#roa-wall-pager .roa-post .h{display:flex;gap:8px;align-items:baseline;justify-content:space-between}
#roa-wall-pager .roa-post .u{font-weight:600;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px}
#roa-wall-pager .roa-post .t{font-size:11px;opacity:.85;white-space:nowrap}
#roa-wall-pager .roa-post .b{margin-top:6px;font-size:12px;white-space:pre-wrap;word-break:break-word;line-height:1.25}
#roa-wall-pager.roa-min{height:auto;width:280px}
#roa-wall-pager.roa-min .roa-row,#roa-wall-pager.roa-min .roa-status,#roa-wall-pager.roa-min .roa-list{display:none}
`;
    (document.head || document.documentElement).appendChild(st);
    WALL_PAGER.styleEl = st;
  }

  function mkEl(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'text') el.textContent = String(v);
      else if (k === 'html') el.innerHTML = String(v);
      else if (k === 'class') el.className = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else el.setAttribute(k, String(v));
    }
    for (const c of children || []) {
      if (!c) continue;
      el.appendChild(c);
    }
    return el;
  }

  function wallPagerSetStatus(msg) {
    try {
      const st = WALL_PAGER.el && WALL_PAGER.el.querySelector('.roa-status');
      if (st) st.textContent = String(msg || '');
    } catch (e) {}
  }

  function wallPagerControlsEnabled(enabled) {
    try {
      const btns = WALL_PAGER.el ? WALL_PAGER.el.querySelectorAll('button,select,input') : [];
      for (const b of btns) {
        if (b && b.dataset && b.dataset.roaLock === '1') continue;
        if (b && typeof b.disabled === 'boolean') b.disabled = !enabled;
      }
      // keep minimize always clickable
      const minBtn = WALL_PAGER.el && WALL_PAGER.el.querySelector('[data-roa-min]');
      if (minBtn) minBtn.disabled = false;
    } catch (e) {}
  }

  function wallPagerRenderPage() {
    if (!WALL_PAGER.el) return;
    const list = WALL_PAGER.el.querySelector('.roa-list');
    const head = WALL_PAGER.el.querySelector('.roa-mini');
    if (!list || !head) return;

    const page = WALL_PAGER.pages[WALL_PAGER.pageIndex] || null;
    const items = page && page.data && Array.isArray(page.data.data) ? page.data.data : [];
    const liveNextCursor = safeText(page && page.nextCursor) || '';

    head.textContent = `G${WALL_PAGER.groupId} • Page ${WALL_PAGER.pageIndex + 1} • ${items.length}/${WALL_PAGER.limit} • ${WALL_PAGER.sortOrder === 'Asc' ? 'Oldest' : 'Newest'} • d=${(WALL_PAGER.baseDelayMs/1000).toFixed(1)}s±${(WALL_PAGER.jitterMs/1000).toFixed(1)}s${WALL_PAGER.breakEveryPages>0?` • break/${WALL_PAGER.breakEveryPages}`:''}${WALL_PAGER.backoffMs>0?` • bo=${(WALL_PAGER.backoffMs/1000).toFixed(0)}s`:''}`;
    wallPagerSyncCursorUi({ requestCursor: safeText(page && page.cursorStart), nextCursor: liveNextCursor });

    list.textContent = '';
    for (const p of items) {
      const poster = extractWallPostPoster(p || {});
      const uname = poster.uname || '(unknown)';
      const created = pick(p && p.created, p && p.createdAt, p && p.created_at) || '';
      const body = safeText(p && p.body) || '';
      const postEl = mkEl('div', { class: 'roa-post' }, [
        mkEl('div', { class: 'h' }, [
          mkEl('div', { class: 'u', text: uname }),
          mkEl('div', { class: 't', text: safeText(created) || '' }),
        ]),
        mkEl('div', { class: 'b', text: body }),
      ]);
      list.appendChild(postEl);
    }

    const prevBtn = WALL_PAGER.el.querySelector('[data-roa-prev]');
    const nextBtn = WALL_PAGER.el.querySelector('[data-roa-next]');
    if (prevBtn) prevBtn.disabled = WALL_PAGER.loading || WALL_PAGER.pageIndex <= 0;
    if (nextBtn) {
      const hasNext = !!(page && page.nextCursor);
      nextBtn.disabled = WALL_PAGER.loading || !hasNext;
    }
  }

  async function detectWallApiVersion(groupId, proxyValue = null) {
    // Prefer v2; if it yields no author info, fall back to v1.
    try {
      WALL_PAGER.apiVer = 'v2';
      const r = await fetchJsonEx(wallApiUrl(groupId, null), {}, proxyValue);
      if (!r.ok || !r.json) throw new Error('v2_fail');
      const items = (r.json && r.json.data) || [];
      if (Array.isArray(items) && items.length) {
        let authorHits = 0;
        for (const p of items) {
          const poster = extractWallPostPoster(p);
          if (poster.pid != null || poster.uname != null) authorHits++;
          if (authorHits >= 2) break;
        }
        if (authorHits > 0) return r;
      }
    } catch (e) {}
    WALL_PAGER.apiVer = 'v1';
    return null;
  }

  async function wallPagerLoadFirstPage() {
    wallPagerClearCompletionSignal();
    enableManualCapture();
    if (!WALL_PAGER.groupId) return { ok: false, status: 0, error: 'missing_group_id' };
    if (WALL_PAGER.loading) return { ok: false, status: 0, error: 'busy' };

    wallPagerReadUiSettings();

    const proxyInp = WALL_PAGER.ui && WALL_PAGER.ui.proxyInp;
    if (proxyInp) {
      WALL_PAGER.proxyValue = String(proxyInp.value || '').trim();
      proxyInp.value = WALL_PAGER.proxyValue;
    }

    WALL_PAGER.pages = [];
    WALL_PAGER.pageIndex = 0;
    WALL_PAGER.backoffMs = 0;
    WALL_PAGER.rateLimitHits = 0;
    WALL_PAGER.tempErrorHits = 0;
    wallPagerSetStatus('Loading...');
    wallPagerControlsEnabled(false);
    WALL_PAGER.loading = true;

    try {
      const probeRes = await detectWallApiVersion(WALL_PAGER.groupId, WALL_PAGER.proxyValue);
      const requestUrl = wallApiUrl(WALL_PAGER.groupId, null);
      const r = (probeRes && WALL_PAGER.apiVer === 'v2') ? probeRes : await fetchJsonEx(requestUrl, {}, WALL_PAGER.proxyValue);
      if (!r.ok) {
        const st = r.status || 0;
        recordWallRequestState(WALL_PAGER.groupId, {
          source: 'wall_pager_first',
          requestCursor: null,
          nextCursor: null,
          requestUrl,
          status: st,
          ok: false,
          proxyValue: WALL_PAGER.proxyValue,
        });
        if (st === 429) {
          WALL_PAGER.rateLimitHits = clampInt((WALL_PAGER.rateLimitHits || 0) + 1, 1, 50);
          const base = Math.max(15000, WALL_PAGER.baseDelayMs * 2);
          const mult = Math.pow(1.9, Math.max(0, WALL_PAGER.rateLimitHits - 1));
          const j = randBetween(0, Math.max(500, WALL_PAGER.jitterMs));
          WALL_PAGER.backoffMs = clampInt(base * mult + j, 5000, WALL_PAGER.maxDelayMs);
          wallPagerSetStatus(`Rate limited (429) - backoff ${(WALL_PAGER.backoffMs / 1000).toFixed(1)}s`);
          return { ok: false, status: st, error: safeText(r.error) || '', rateLimited: true };
        }
        if (st === 0 || st >= 500) {
          WALL_PAGER.tempErrorHits = clampInt((WALL_PAGER.tempErrorHits || 0) + 1, 1, 50);
          const base = Math.max(4000, Math.round(WALL_PAGER.baseDelayMs * 0.6));
          const mult = Math.pow(1.6, Math.max(0, WALL_PAGER.tempErrorHits - 1));
          const j = randBetween(0, Math.max(500, WALL_PAGER.jitterMs));
          WALL_PAGER.backoffMs = clampInt(base * mult + j, 3000, WALL_PAGER.maxDelayMs);
          wallPagerSetStatus(`Temporary error (${st || 'net'}) - retry in ${(WALL_PAGER.backoffMs / 1000).toFixed(1)}s`);
          return { ok: false, status: st, error: safeText(r.error) || '', tempError: true };
        }
        wallPagerSetStatus(st === 429 ? 'Rate limited (429) - try again in a bit' : `Load failed: ${st} ${safeText(r.error) || ''}`);
        return { ok: false, status: st, error: safeText(r.error) || '', fatal: (st === 401 || st === 403 || st === 404) };
      }
      const nextCursor = r.json && (r.json.nextPageCursor || r.json.nextPageToken || r.json.nextPage);
      WALL_PAGER.pages.push({ cursorStart: null, nextCursor: nextCursor || null, data: r.json });
      archiveWallFromJson(WALL_PAGER.groupId, r.json, nowIsoZ(), {
        source: 'wall_pager_first',
        requestCursor: null,
        requestUrl,
        apiVer: WALL_PAGER.apiVer,
        sortOrder: WALL_PAGER.sortOrder,
        proxyValue: WALL_PAGER.proxyValue,
      });
      wallPagerSetStatus('Ready');
      wallPagerRenderPage();
      WALL_PAGER.backoffMs = 0;
      WALL_PAGER.rateLimitHits = 0;
      WALL_PAGER.tempErrorHits = 0;
      return { ok: true, status: safeInt(r.status) || 200 };
    } finally {
      WALL_PAGER.loading = false;
      wallPagerControlsEnabled(true);
      wallPagerRenderPage();
    }
  }

  async function wallPagerGoNext(fromAuto = false) {
    if (!fromAuto) wallPagerClearCompletionSignal();
    enableManualCapture();
    wallPagerReadUiSettings();
    const cur = WALL_PAGER.pages[WALL_PAGER.pageIndex];
    if (!cur || !cur.nextCursor) return { progressed: false, end: true };
    if (WALL_PAGER.loading) return { progressed: false, end: false };

    const proxyInp = WALL_PAGER.ui && WALL_PAGER.ui.proxyInp;
    if (proxyInp) {
      WALL_PAGER.proxyValue = String(proxyInp.value || '').trim();
      proxyInp.value = WALL_PAGER.proxyValue;
    }

    // cached?
    if (WALL_PAGER.pages[WALL_PAGER.pageIndex + 1]) {
      WALL_PAGER.pageIndex++;
      wallPagerRenderPage();
      return { progressed: true, end: false };
    }

    WALL_PAGER.loading = true;
    wallPagerControlsEnabled(false);
    wallPagerSetStatus('Loading next page...');
    const requestUrl = wallApiUrl(WALL_PAGER.groupId, cur.nextCursor);
    try {
      const r = await fetchJsonEx(requestUrl, {}, WALL_PAGER.proxyValue);
      if (!r.ok) {
        const st = r.status || 0;
        recordWallRequestState(WALL_PAGER.groupId, {
          source: fromAuto ? 'wall_pager_auto' : 'wall_pager_next',
          requestCursor: cur.nextCursor,
          nextCursor: null,
          requestUrl,
          status: st,
          ok: false,
          proxyValue: WALL_PAGER.proxyValue,
        });

        if (st === 401 || st === 403) {
          wallPagerSetStatus(`Auth/permission error: ${st} ${safeText(r.error) || ''}`);
          return { progressed: false, end: false, fatal: true };
        }

        if (st === 429) {
          WALL_PAGER.rateLimitHits = clampInt((WALL_PAGER.rateLimitHits || 0) + 1, 1, 50);
          const base = Math.max(15000, WALL_PAGER.baseDelayMs * 2);
          const mult = Math.pow(1.9, Math.max(0, WALL_PAGER.rateLimitHits - 1));
          const j = randBetween(0, Math.max(500, WALL_PAGER.jitterMs));
          WALL_PAGER.backoffMs = clampInt(base * mult + j, 5000, WALL_PAGER.maxDelayMs);
          wallPagerSetStatus(`Rate limited (429) - backoff ${(WALL_PAGER.backoffMs / 1000).toFixed(1)}s`);
          return { progressed: false, end: false, rateLimited: true };
        }

        if (st === 0 || st >= 500) {
          WALL_PAGER.tempErrorHits = clampInt((WALL_PAGER.tempErrorHits || 0) + 1, 1, 50);
          const base = Math.max(4000, Math.round(WALL_PAGER.baseDelayMs * 0.6));
          const mult = Math.pow(1.6, Math.max(0, WALL_PAGER.tempErrorHits - 1));
          const j = randBetween(0, Math.max(500, WALL_PAGER.jitterMs));
          WALL_PAGER.backoffMs = clampInt(base * mult + j, 3000, WALL_PAGER.maxDelayMs);
          wallPagerSetStatus(`Temporary error (${st || 'net'}) - retry in ${(WALL_PAGER.backoffMs / 1000).toFixed(1)}s`);
          return { progressed: false, end: false, tempError: true };
        }

        wallPagerSetStatus(`Load failed: ${st} ${safeText(r.error) || ''}`);
        return { progressed: false, end: false };
      }

      const nextCursor = r.json && (r.json.nextPageCursor || r.json.nextPageToken || r.json.nextPage);
      WALL_PAGER.pages.push({ cursorStart: cur.nextCursor, nextCursor: nextCursor || null, data: r.json });
      WALL_PAGER.pageIndex++;
      archiveWallFromJson(WALL_PAGER.groupId, r.json, nowIsoZ(), {
        source: fromAuto ? 'wall_pager_auto' : 'wall_pager_next',
        requestCursor: cur.nextCursor,
        requestUrl,
        apiVer: WALL_PAGER.apiVer,
        sortOrder: WALL_PAGER.sortOrder,
        proxyValue: WALL_PAGER.proxyValue,
      });
      wallPagerSetStatus('Ready');
      wallPagerRenderPage();
      // successful request: relax backoff
      WALL_PAGER.backoffMs = 0;
      WALL_PAGER.rateLimitHits = 0;
      WALL_PAGER.tempErrorHits = 0;
      return { progressed: true, end: false };
    } finally {
      WALL_PAGER.loading = false;
      wallPagerControlsEnabled(true);
      wallPagerRenderPage();
    }
  }

  async function wallPagerStartFromSavedOrInput() {
    wallPagerClearCompletionSignal();
    enableManualCapture();
    wallPagerReadUiSettings();
    const raw = safeText(WALL_PAGER.ui && WALL_PAGER.ui.cursorInp ? WALL_PAGER.ui.cursorInp.value : null) || '';
    const parsed = wallPagerParseCursorInput(raw);
    if (parsed && parsed.cursor) {
      await wallPagerJumpToCursor(raw);
      return;
    }
    await wallPagerLoadFirstPage();
  }

  async function wallPagerReloadCurrent() {
    wallPagerClearCompletionSignal();
    enableManualCapture();
    wallPagerReadUiSettings();
    if (WALL_PAGER.loading) return;

    const cur = WALL_PAGER.pages[WALL_PAGER.pageIndex] || null;
    const reloadCursor = safeText(cur && cur.cursorStart);
    if (reloadCursor) {
      await wallPagerJumpToCursor(reloadCursor);
      return;
    }

    const raw = safeText(WALL_PAGER.ui && WALL_PAGER.ui.cursorInp ? WALL_PAGER.ui.cursorInp.value : null) || '';
    const parsed = wallPagerParseCursorInput(raw);
    if (parsed && parsed.cursor) {
      await wallPagerJumpToCursor(raw);
      return;
    }

    await wallPagerLoadFirstPage();
  }

  function wallPagerGoPrev() {
    wallPagerClearCompletionSignal();
    if (WALL_PAGER.loading) return;
    if (WALL_PAGER.pageIndex <= 0) return;
    WALL_PAGER.pageIndex--;
    wallPagerSetStatus('Ready');
    wallPagerRenderPage();
  }

  async function wallPagerAutoLoop() {
    if (!WALL_PAGER.el) return;
    if (WALL_PAGER.auto) return;
    WALL_PAGER.auto = true;
    WALL_PAGER.autoStop = false;
    let completedWall = false;

    const autoBtn = WALL_PAGER.el.querySelector('[data-roa-auto]');
    if (autoBtn) autoBtn.textContent = 'Stop';

    let steps = 0;
    let delayBeforeNextMs = wallPagerCalcNormalDelayMs();
    while (WALL_PAGER.auto && !WALL_PAGER.autoStop && (WALL_PAGER.maxAutoPages <= 0 || steps < WALL_PAGER.maxAutoPages)) {
      wallPagerReadUiSettings();

      if (WALL_PAGER.stopOnHidden && document.visibilityState && document.visibilityState !== 'visible') {
        wallPagerSetStatus('Auto paused (tab hidden)');
        while (!WALL_PAGER.autoStop && document.visibilityState !== 'visible') {
          await sleep(1000);
        }
        if (WALL_PAGER.autoStop) break;
        wallPagerSetStatus('Auto resumed');
      }

      if (WALL_PAGER.pauseOnOffline && typeof navigator !== 'undefined' && navigator && navigator.onLine === false) {
        wallPagerSetStatus('Auto paused (offline)');
        while (!WALL_PAGER.autoStop && navigator && navigator.onLine === false) {
          await sleep(1000);
        }
        if (WALL_PAGER.autoStop) break;
        wallPagerSetStatus('Auto resumed');
      }

      const cur = WALL_PAGER.pages[WALL_PAGER.pageIndex];
      const hasCachedNext = !!WALL_PAGER.pages[WALL_PAGER.pageIndex + 1];
      if (!cur || !cur.nextCursor) {
        completedWall = !!cur;
        break;
      }

      if (!hasCachedNext && delayBeforeNextMs > 0) {
        WALL_PAGER.lastDelayMs = delayBeforeNextMs;
        wallPagerSetStatus(`Waiting ${(delayBeforeNextMs / 1000).toFixed(1)}s before next request`);
        await sleep(delayBeforeNextMs);
        if (WALL_PAGER.autoStop) break;
      }

      const r = await wallPagerGoNext(true);
      if (r && r.fatal) break;
      if (r && r.end) {
        completedWall = true;
        break;
      }

      // Rate-limited or transient error: wait backoff and retry without counting a page step.
      if (r && (r.rateLimited || r.tempError)) {
        delayBeforeNextMs = wallPagerCalcRetryDelayMs();
        continue;
      }

      if (r && r.progressed) {
        steps++;
      }

      let nextDelay = hasCachedNext ? 0 : wallPagerCalcNormalDelayMs();

      // Periodic long pause to avoid robotic patterns.
      if (r && r.progressed && WALL_PAGER.breakEveryPages > 0 && (steps % WALL_PAGER.breakEveryPages) === 0) {
        const pause = clampInt(randBetween(WALL_PAGER.breakMinMs, WALL_PAGER.breakMaxMs), 0, WALL_PAGER.maxDelayMs);
        if (pause > 0) {
          wallPagerSetStatus(`Auto break ${(pause / 1000).toFixed(0)}s`);
          nextDelay = clampInt(nextDelay + pause, 0, WALL_PAGER.maxDelayMs);
        }
      }

      delayBeforeNextMs = nextDelay;
    }

    const stoppedByUser = !!WALL_PAGER.autoStop;
    WALL_PAGER.auto = false;
    WALL_PAGER.autoStop = false;
    if (autoBtn) autoBtn.textContent = 'Auto';
    if (completedWall && !stoppedByUser) wallPagerHandleCompletion('Wall finished');
    else wallPagerSetStatus('Auto stopped');
  }

  function wallPagerStopAuto() {
    const runnerState = loadRunnerStateSync();
    if (runnerState && runnerState.active) {
      return;
    }
    WALL_PAGER.autoStop = true;
    WALL_PAGER.auto = false;
    const autoBtn = WALL_PAGER.el && WALL_PAGER.el.querySelector('[data-roa-auto]');
    if (autoBtn) autoBtn.textContent = 'Auto';
  }

  
  function wallPagerParseCursorInput(raw) {
    const s = String(raw || '').trim();
    if (!s) return { cursor: null, sortOrder: null, limit: null, apiVer: null, groupId: null };

    // Full URL paste
    if (/^https?:\/\//i.test(s)) {
      try {
        const u = new URL(s);
        const cursor = u.searchParams.get('cursor');
        const sort = u.searchParams.get('sortOrder');
        const lim = u.searchParams.get('limit');

        let apiVer = null;
        let gid = null;
        try {
          const m = u.pathname.match(/^\/(v\d+)\/groups\/(\d+)\/wall\/posts/i);
          if (m) {
            apiVer = m[1];
            gid = safeInt(m[2]);
          }
        } catch (e) {}

        return {
          cursor: cursor ? String(cursor) : null,
          sortOrder: (sort === 'Asc' || sort === 'Desc') ? sort : null,
          limit: lim ? safeInt(lim) : null,
          apiVer: (apiVer === 'v1' || apiVer === 'v2') ? apiVer : null,
          groupId: gid || null
        };
      } catch (e) {
        // fall through
      }
    }

    // Query-string style paste
    const m = s.match(/(?:\?|&|^)cursor=([^&]+)/i);
    if (m && m[1]) {
      let cur = m[1];
      try { cur = decodeURIComponent(cur); } catch (e) {}
      return { cursor: cur, sortOrder: null, limit: null, apiVer: null, groupId: null };
    }

    // Raw token
    return { cursor: s, sortOrder: null, limit: null, apiVer: null, groupId: null };
  }

  async function wallPagerJumpToCursor(raw) {
    wallPagerClearCompletionSignal();
    enableManualCapture();
    wallPagerReadUiSettings();
    if (!WALL_PAGER.groupId) return;
    const p = wallPagerParseCursorInput(raw);
    const cursor = p && p.cursor ? String(p.cursor).trim() : '';
    if (!cursor) {
      wallPagerSetStatus('No cursor found');
      return;
    }

    const proxyInp = WALL_PAGER.ui && WALL_PAGER.ui.proxyInp;
    if (proxyInp) {
      WALL_PAGER.proxyValue = String(proxyInp.value || '').trim();
      proxyInp.value = WALL_PAGER.proxyValue;
    }

    // Stop auto if running
    if (WALL_PAGER.auto) wallPagerStopAuto();

    // Apply URL-provided settings if present
    let prefsDirty = false;

    if (p.sortOrder && (p.sortOrder === 'Asc' || p.sortOrder === 'Desc') && WALL_PAGER.sortOrder !== p.sortOrder) {
      WALL_PAGER.sortOrder = p.sortOrder;
      prefsDirty = true;
      const sel = WALL_PAGER.ui && WALL_PAGER.ui.sortSel;
      if (sel) sel.value = p.sortOrder;
    }

    if (p.limit && Number.isFinite(p.limit)) {
      WALL_PAGER.limit = clampInt(p.limit, 1, 100);
    }

    let forcedApi = false;
    if (p.apiVer && (p.apiVer === 'v1' || p.apiVer === 'v2')) {
      WALL_PAGER.apiVer = p.apiVer;
      forcedApi = true;
    }

    const gid = p.groupId ? safeInt(p.groupId) : null;
    if (gid && gid !== WALL_PAGER.groupId) {
      WALL_PAGER.groupId = gid;
      WALL_PAGER.pages = [];
      WALL_PAGER.pageIndex = 0;
      wallPagerRenderPage();
    }

    if (prefsDirty) {
      await saveWallPagerPrefs();
    }

    if (!forcedApi) {
      try { await detectWallApiVersion(WALL_PAGER.groupId, WALL_PAGER.proxyValue); } catch (e) {}
    }

    if (WALL_PAGER.loading) return;

    WALL_PAGER.backoffMs = 0;
    WALL_PAGER.rateLimitHits = 0;
    WALL_PAGER.tempErrorHits = 0;

    wallPagerSetStatus('Loading cursor...');
    wallPagerControlsEnabled(false);
    WALL_PAGER.loading = true;

    const requestUrl = wallApiUrl(WALL_PAGER.groupId, cursor);
    try {
      const r = await fetchJsonEx(requestUrl, {}, WALL_PAGER.proxyValue);
      if (!r.ok) {
        const st = r.status || 0;
        recordWallRequestState(WALL_PAGER.groupId, {
          source: 'wall_pager_jump',
          requestCursor: cursor,
          nextCursor: null,
          requestUrl,
          status: st,
          ok: false,
          proxyValue: WALL_PAGER.proxyValue,
        });
        wallPagerSetStatus(st === 429 ? 'Rate limited (429) - try again in a bit' : `Load failed: ${st} ${safeText(r.error) || ''}`);
        return;
      }

      const nextCursor = r.json && (r.json.nextPageCursor || r.json.nextPageToken || r.json.nextPage);
      WALL_PAGER.pages = [];
      WALL_PAGER.pageIndex = 0;
      WALL_PAGER.pages.push({ cursorStart: cursor, nextCursor: nextCursor || null, data: r.json });
      archiveWallFromJson(WALL_PAGER.groupId, r.json, nowIsoZ(), {
        source: 'wall_pager_jump',
        requestCursor: cursor,
        requestUrl,
        apiVer: WALL_PAGER.apiVer,
        sortOrder: WALL_PAGER.sortOrder,
        proxyValue: WALL_PAGER.proxyValue,
      });
      wallPagerSetStatus('Ready');
      wallPagerRenderPage();
    } finally {
      WALL_PAGER.loading = false;
      wallPagerControlsEnabled(true);
      wallPagerRenderPage();
    }
  }
  async function ensureWallPagerUI(groupId) {
    if (!groupId) return;
    ensureWallPagerStyles();

    if (!WALL_PAGER.el) {
      await loadWallPagerPrefs();

      const root = mkEl('div', { id: 'roa-wall-pager' }, []);
      const card = mkEl('div', { class: 'roa-card' }, []);
      root.appendChild(card);

      const head = mkEl('div', { class: 'roa-head' }, [
        mkEl('div', { class: 'roa-title', text: 'Roblox Wall Pager' }),
        mkEl('div', { class: 'roa-mini', text: '' }),
        mkEl('button', { class: 'roa-btn', 'data-roa-min': '1', 'data-roa-lock': '1', text: 'Min' }),
      ]);
      card.appendChild(head);
      const row0 = mkEl('div', { class: 'roa-row' }, []);
      const cursorInp = mkEl('input', {
        type: 'text',
        placeholder: 'Paste cursor or full wall URL',
        title: 'Paste groups.roblox.com wall URL (cursor=...) or just the cursor token'
      });
      cursorInp.style.flex = '1';
      const goCurBtn = mkEl('button', { class: 'roa-btn', 'data-roa-cursor-go': '1', text: 'Go' });
      row0.appendChild(cursorInp);
      row0.appendChild(goCurBtn);
      card.appendChild(row0);

      const row0b = mkEl('div', { class: 'roa-row' }, []);
      const nextCursorInp = mkEl('input', {
        type: 'text',
        readonly: 'readonly',
        placeholder: 'Next page cursor (auto-updated)',
        title: 'Next page cursor. This updates automatically so you can resume after refresh without copying it from the network tab.'
      });
      nextCursorInp.style.flex = '1';
      row0b.appendChild(nextCursorInp);
      card.appendChild(row0b);

      const rowProxy = mkEl('div', { class: 'roa-row' }, []);
      const proxyInp = mkEl('input', {
        type: 'text',
        placeholder: 'Webshare proxy (used for wall requests)',
        title: 'Used for wall API requests and saved with the page cursor so you can resume later.'
      });
      proxyInp.style.flex = '1';
      rowProxy.appendChild(proxyInp);
      card.appendChild(rowProxy);

      const row1 = mkEl('div', { class: 'roa-row' }, []);
      const sortSel = mkEl('select', { 'data-roa-sort': '1' }, []);
      sortSel.appendChild(mkEl('option', { value: 'Desc', text: 'Newest → Oldest' }));
      sortSel.appendChild(mkEl('option', { value: 'Asc', text: 'Oldest → Newest' }));
      sortSel.value = WALL_PAGER.sortOrder;

      const modeSel = mkEl('select', { 'data-roa-mode': '1', title: 'Auto mode' }, []);
      modeSel.appendChild(mkEl('option', { value: 'wall', text: 'Wall' }));
      modeSel.appendChild(mkEl('option', { value: 'discovery', text: 'Discovery' }));
      modeSel.appendChild(mkEl('option', { value: 'climb', text: 'Climb' }));
      modeSel.appendChild(mkEl('option', { value: 'finish', text: 'Finish' }));
      modeSel.value = WALL_PAGER.runnerMode || 'wall';

      const minIdInp = mkEl('input', {
        type: 'number',
        min: '1',
        max: '2147483647',
        step: '1',
        value: String(WALL_PAGER.discoveryMinId || 1),
        title: 'Discovery minimum group ID'
      });
      minIdInp.style.width = '92px';

      const cutoffInp = mkEl('input', {
        type: 'text',
        placeholder: 'Cutoff: 2016-12-31 or ISO',
        title: 'Climb cutoff. Date-only means end of that UTC day. Finish mode uses timestamps saved in the database.'
      });
      cutoffInp.style.flex = '1';
      cutoffInp.value = safeText(WALL_PAGER.cutoffInput) || '';

      WALL_PAGER.ui = { sortSel, cursorInp, nextCursorInp, proxyInp, modeSel, minIdInp, cutoffInp };

      const startBtn = mkEl('button', { class: 'roa-btn', 'data-roa-start': '1', text: 'Start' });
      const reloadBtn = mkEl('button', { class: 'roa-btn', 'data-roa-reload': '1', text: 'Reload' });
      const prevBtn = mkEl('button', { class: 'roa-btn', 'data-roa-prev': '1', text: '◀' });
      const nextBtn = mkEl('button', { class: 'roa-btn', 'data-roa-next': '1', text: '▶' });
      const autoBtn = mkEl('button', { class: 'roa-btn', 'data-roa-auto': '1', text: 'Auto' });
      const notifyBtn = mkEl('button', { class: 'roa-btn', 'data-roa-notify': '1', text: wallPagerNotifyModeLabel() });

      const delayInp = mkEl('input', { type: 'number', min: '1', max: '60', step: '1', value: String(Math.round(WALL_PAGER.baseDelayMs / 1000)), title: 'Seconds between auto pages / climb pages / discovery probes' });
      delayInp.style.width = '64px';
      const delayLbl = mkEl('div', { class: 'roa-mini', text: 's' });

      row1.appendChild(sortSel);
      row1.appendChild(modeSel);
      row1.appendChild(minIdInp);
      row1.appendChild(startBtn);
      row1.appendChild(reloadBtn);
      row1.appendChild(prevBtn);
      row1.appendChild(nextBtn);
      row1.appendChild(autoBtn);
      row1.appendChild(notifyBtn);
      row1.appendChild(delayInp);
      row1.appendChild(delayLbl);
      card.appendChild(row1);

      const row1b = mkEl('div', { class: 'roa-row' }, []);
      row1b.appendChild(cutoffInp);
      card.appendChild(row1b);

      // Advanced pacing controls (jitter + periodic breaks)
      const row2 = mkEl('div', { class: 'roa-row' }, []);
      const jitterLbl = mkEl('div', { class: 'roa-mini', text: 'jitter' });
      const jitterInp = mkEl('input', { type: 'number', min: '0', max: '10', step: '0.1', value: (WALL_PAGER.jitterMs / 1000).toFixed(1), title: 'Random +/- seconds added to delay' });
      jitterInp.style.width = '64px';
      const jitterS = mkEl('div', { class: 'roa-mini', text: 's' });

      const breakLbl = mkEl('div', { class: 'roa-mini', text: 'break/pg' });
      const breakEveryInp = mkEl('input', { type: 'number', min: '0', max: '5000', step: '1', value: String(WALL_PAGER.breakEveryPages), title: 'Extra long pause every N pages (0 disables)' });
      breakEveryInp.style.width = '70px';

      const pauseLbl = mkEl('div', { class: 'roa-mini', text: 'pause' });
      const breakMinInp = mkEl('input', { type: 'number', min: '0', max: '300', step: '1', value: String(Math.round(WALL_PAGER.breakMinMs / 1000)), title: 'Min long pause (seconds)' });
      breakMinInp.style.width = '64px';
      const dash = mkEl('div', { class: 'roa-mini', text: '-' });
      const breakMaxInp = mkEl('input', { type: 'number', min: '0', max: '300', step: '1', value: String(Math.round(WALL_PAGER.breakMaxMs / 1000)), title: 'Max long pause (seconds)' });
      breakMaxInp.style.width = '64px';
      const pauseS = mkEl('div', { class: 'roa-mini', text: 's' });

      const capLbl = mkEl('div', { class: 'roa-mini', text: 'cap' });
      const capInp = mkEl('input', { type: 'number', min: '0', max: '50000', step: '1', value: String(WALL_PAGER.maxAutoPages), title: 'Max pages per auto run (0 = unlimited)' });
      capInp.style.width = '74px';

      const hiddenCb = mkEl('input', { type: 'checkbox', title: 'Pause auto when tab is hidden' });
      hiddenCb.checked = !!WALL_PAGER.stopOnHidden;
      const hiddenLbl = mkEl('div', { class: 'roa-mini', text: 'hidden' });

      const offCb = mkEl('input', { type: 'checkbox', title: 'Pause auto when offline' });
      offCb.checked = !!WALL_PAGER.pauseOnOffline;
      const offLbl = mkEl('div', { class: 'roa-mini', text: 'offline' });

      row2.appendChild(jitterLbl);
      row2.appendChild(jitterInp);
      row2.appendChild(jitterS);
      row2.appendChild(breakLbl);
      row2.appendChild(breakEveryInp);
      row2.appendChild(pauseLbl);
      row2.appendChild(breakMinInp);
      row2.appendChild(dash);
      row2.appendChild(breakMaxInp);
      row2.appendChild(pauseS);
      row2.appendChild(capLbl);
      row2.appendChild(capInp);
      row2.appendChild(hiddenCb);
      row2.appendChild(hiddenLbl);
      row2.appendChild(offCb);
      row2.appendChild(offLbl);
      card.appendChild(row2);

      WALL_PAGER.ui = Object.assign(WALL_PAGER.ui || {}, { delayInp, jitterInp, breakEveryInp, breakMinInp, breakMaxInp, capInp, hiddenCb, offCb, notifyBtn });
      wallPagerReadUiSettings();
      wallPagerUpdateNotifyUi();

      const status = mkEl('div', { class: 'roa-status', text: '' });
      card.appendChild(status);

      const list = mkEl('div', { class: 'roa-list' });
      card.appendChild(list);

      // Events
      head.querySelector('[data-roa-min]').addEventListener('click', () => {
        if (root.classList.contains('roa-min')) {
          root.classList.remove('roa-min');
          head.querySelector('[data-roa-min]').textContent = 'Min';
        } else {
          root.classList.add('roa-min');
          head.querySelector('[data-roa-min]').textContent = 'Open';
        }
      });

      startBtn.addEventListener('click', () => wallPagerStartFromSavedOrInput().catch(() => {}));
      reloadBtn.addEventListener('click', () => wallPagerReloadCurrent().catch(() => {}));
      prevBtn.addEventListener('click', () => wallPagerGoPrev());
      nextBtn.addEventListener('click', () => wallPagerGoNext(false).catch(() => {}));
      notifyBtn.addEventListener('click', () => { wallPagerCycleNotifyMode().catch(() => {}); });

      goCurBtn.addEventListener('click', () => wallPagerJumpToCursor(cursorInp.value).catch(() => {}));
      cursorInp.addEventListener('keydown', (e) => {
        if (e && e.key === 'Enter') {
          e.preventDefault();
          goCurBtn.click();
        }
      });


            autoBtn.addEventListener('click', () => {
              wallPagerReadUiSettings();
              runnerReadUiSettings();
              const live = loadRunnerStateSync();
              if (WALL_PAGER.auto || (live && live.active)) {
                stopRunnerMode('Auto stopped').catch(() => {});
                wallPagerStopAuto();
                wallPagerSetStatus('Auto stopped');
                autoBtn.textContent = 'Auto';
              } else {
                const mode = runnerCurrentModeFromUi();
                if (mode === 'discovery' || mode === 'climb' || mode === 'finish') {
                  startRunnerMode(mode).catch(() => {});
                } else {
                  const starter = WALL_PAGER.pages.length ? Promise.resolve() : wallPagerStartFromSavedOrInput();
                  starter.then(() => wallPagerAutoLoop()).catch(() => {});
                }
              }
            });

      sortSel.addEventListener('change', async () => {
        const v = sortSel.value === 'Asc' ? 'Asc' : 'Desc';
        WALL_PAGER.sortOrder = v;
        await saveWallPagerPrefs();
        if (WALL_PAGER.pages.length) {
          await wallPagerReloadCurrent();
        } else {
          wallPagerSetStatus('Saved sort order');
        }
      });

      modeSel.addEventListener('change', async () => {
        runnerReadUiSettings();
        await saveWallPagerPrefs();
        runnerSyncUiFromState();
        wallPagerSetStatus(`Mode: ${WALL_PAGER.runnerMode}`);
      });

      minIdInp.addEventListener('input', () => { runnerReadUiSettings(); });
      minIdInp.addEventListener('change', async () => {
        runnerReadUiSettings();
        await saveWallPagerPrefs();
      });
      cutoffInp.addEventListener('input', () => { runnerReadUiSettings(); });
      cutoffInp.addEventListener('change', async () => {
        runnerReadUiSettings();
        await saveWallPagerPrefs();
      });


      delayInp.addEventListener('input', () => { wallPagerReadUiSettings(); });
      delayInp.addEventListener('change', async () => {
        wallPagerReadUiSettings();
        await saveWallPagerPrefs();
      });
      jitterInp.addEventListener('input', () => { wallPagerReadUiSettings(); });
      jitterInp.addEventListener('change', async () => {
        wallPagerReadUiSettings();
        await saveWallPagerPrefs();
      });

      breakEveryInp.addEventListener('input', () => { wallPagerReadUiSettings(); });
      breakEveryInp.addEventListener('change', async () => {
        wallPagerReadUiSettings();
        await saveWallPagerPrefs();
      });

      async function normalizeBreakRangeAndSave() {
        wallPagerReadUiSettings();
        await saveWallPagerPrefs();
      }

      breakMinInp.addEventListener('input', () => { wallPagerReadUiSettings(); });
      breakMaxInp.addEventListener('input', () => { wallPagerReadUiSettings(); });
      breakMinInp.addEventListener('change', normalizeBreakRangeAndSave);
      breakMaxInp.addEventListener('change', normalizeBreakRangeAndSave);

      capInp.addEventListener('input', () => { wallPagerReadUiSettings(); });
      capInp.addEventListener('change', async () => {
        wallPagerReadUiSettings();
        await saveWallPagerPrefs();
      });

      hiddenCb.addEventListener('change', async () => {
        wallPagerReadUiSettings();
        await saveWallPagerPrefs();
      });

      offCb.addEventListener('change', async () => {
        wallPagerReadUiSettings();
        await saveWallPagerPrefs();
      });

      proxyInp.addEventListener('change', async () => {
        const v = String(proxyInp.value || '').trim();
        proxyInp.value = v;
        WALL_PAGER.proxyValue = v;
        await saveWallPagerState({ source: 'proxy_saved', proxyValue: v });
        wallPagerSetStatus(v ? 'Saved page state' : 'Cleared saved proxy text');
      });

      // Attach
      document.documentElement.appendChild(root);
      WALL_PAGER.el = root;
      runnerSyncUiFromState();
    }

    // Update group target (reset pages if group changes)
    if (WALL_PAGER.groupId !== groupId) {
      WALL_PAGER.groupId = groupId;
      WALL_PAGER.pages = [];
      WALL_PAGER.pageIndex = 0;

      const saved = await loadWallPagerState(groupId);
      const savedSort = saved && (saved.sortOrder === 'Asc' || saved.sortOrder === 'Desc') ? saved.sortOrder : null;
      if (savedSort) {
        WALL_PAGER.sortOrder = savedSort;
        const sel = WALL_PAGER.ui && WALL_PAGER.ui.sortSel;
        if (sel) sel.value = savedSort;
      }
      if (saved && (saved.apiVer === 'v1' || saved.apiVer === 'v2')) {
        WALL_PAGER.apiVer = saved.apiVer;
      }

      const savedResume = safeText(saved && (saved.resumeCursor || saved.nextCursor || saved.requestCursor)) || '';
      const savedProxy = safeText(saved && saved.proxyValue) || '';
      if (WALL_PAGER.ui && WALL_PAGER.ui.cursorInp) WALL_PAGER.ui.cursorInp.value = savedResume;
      if (WALL_PAGER.ui && WALL_PAGER.ui.nextCursorInp) WALL_PAGER.ui.nextCursorInp.value = safeText(saved && saved.nextCursor) || savedResume;
      if (WALL_PAGER.ui && WALL_PAGER.ui.proxyInp) WALL_PAGER.ui.proxyInp.value = savedProxy;
      WALL_PAGER.proxyValue = savedProxy;

      wallPagerClearCompletionSignal();
      wallPagerSetStatus(savedResume ? 'Saved cursor loaded - click Start or Go' : 'Ready - click Start');
      wallPagerRenderPage();

      if (savedResume) {
        await saveWallPagerState({
          groupId,
          requestCursor: safeText(saved && saved.requestCursor),
          nextCursor: safeText(saved && saved.nextCursor),
          requestUrl: safeText(saved && saved.requestUrl) || location.href,
          source: 'group_open_restore',
          proxyValue: savedProxy,
        });
      } else {
        await saveWallPagerState({
          groupId,
          requestCursor: null,
          nextCursor: null,
          requestUrl: location.href,
          source: 'group_open',
          proxyValue: savedProxy,
        });
      }
    }
  }

  function removeWallPagerUI() {
    const runnerState = loadRunnerStateSync();
    if (!(runnerState && runnerState.active)) {
      try { wallPagerStopAuto(); } catch (e) {}
    }
    try {
      if (WALL_PAGER.el) WALL_PAGER.el.remove();
      WALL_PAGER.el = null;
    } catch (e) {}
    WALL_PAGER.groupId = null;
    WALL_PAGER.ui = null;
    WALL_PAGER.pages = [];
    WALL_PAGER.pageIndex = 0;
    WALL_PAGER.manualCaptureEnabled = false;
  }
  async function captureGroup(groupId) {
    // Deliberately disabled in this build.
    // The extension now relies on normal page loads + wall pager requests only.
    return { ok: true, disabled: true, groupId: safeInt(groupId) };
  }

  // -----------------------
  // Page-hook message handling
  // -----------------------
  window.addEventListener('message', (event) => {
    try {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.__roa !== true || data.type !== 'ROBLOX_API_CAPTURE') return;

      const payload = data.payload || {};
      const url = safeText(payload.url) || '';
      const txt = safeText(payload.text) || '';
      if (!url || !txt) return;

      let j = null;
      try { j = JSON.parse(txt); } catch (e) { return; }
      if (!j) return;
      if (!WALL_PAGER.manualCaptureEnabled) return;

      const captured = nowIsoZ();

      
// Heuristic parse: wall posts (supports UI pagination too)
if (/\/wall\/posts/i.test(url)) {
  const groupId = getGroupIdFromUrl(location.href) || getGroupIdFromUrl(url) || safeInt(pick(j.groupId, j.communityId, j.id));
  const wallRows = [];
  const staticRows = [];
  const items = (j && j.data) || [];
  if (groupId && Array.isArray(items)) {
    for (const p of items) {
      const postId = safeInt(p && p.id);
      if (!postId) continue;
      const poster = extractWallPostPoster(p || {});
      wallRows.push({
        post_id: postId,
        group_id: groupId,
        user_id: poster.pid,
        username: poster.uname,
        role: poster.roleName,
        body: safeText(p && p.body),
        created: pick(p && p.created, p && p.createdAt, p && p.created_at),
      });
      if (poster.pid) {
        staticRows.push({
          id: safeInt(poster.pid),
          owner: null,
          type: 'user',
          subtype: null,
          creation: null,
          active: true,
          verified: captured
        });
      }
    }
    const parsedWall = wallPagerParseCursorInput(url);
    const nextCursor = safeText(j && (j.nextPageCursor || j.nextPageToken || j.nextPage));
    if (wallRows.length) {
      addRows('rb_group_wall_archive', wallRows);
      addRows('rb_static_archive', staticRows);
      flushNow();
    }
    recordWallRequestState(groupId, {
      source: 'page_hook',
      requestCursor: safeText(parsedWall && parsedWall.cursor),
      nextCursor,
      requestUrl: url,
      itemCount: wallRows.length,
      status: 200,
      ok: true,
      apiVer: (parsedWall && (parsedWall.apiVer === 'v1' || parsedWall.apiVer === 'v2')) ? parsedWall.apiVer : null,
      sortOrder: (parsedWall && (parsedWall.sortOrder === 'Asc' || parsedWall.sortOrder === 'Desc')) ? parsedWall.sortOrder : null,
    });
  }
  return;
}

// Heuristic parse: group core
if (/\/(?:v\d+)\/(?:groups|communities)\/(\d+)/i.test(url)) {
  const m = url.match(/\/(?:v\d+)\/(?:groups|communities)\/(\d+)/i);
  const groupId = safeInt(m && m[1]);
  if (groupId && j && typeof j === 'object') {
    const captured2 = captured;
    const staticRows = [];
    const dynRows = [];

    const verified = pick(j.hasVerifiedBadge, j.isVerified, j.verified);
    const ownerId = pick(j.owner && (j.owner.userId || j.owner.id), j.ownerId);
    const memberCount = safeInt(pick(j.memberCount, j.members, j.member_count));

    rememberPassiveGroupInfo(groupId, {
      name: safeText(j.name),
      description: safeText(j.description),
      memberCount,
      ownerId: safeInt(ownerId),
      verified: (verified === true || verified === 1) ? 1 : (verified === false || verified === 0) ? 0 : null,
    });

    staticRows.push({
      id: groupId,
      owner: safeInt(ownerId),
      type: 'group',
      subtype: null,
      creation: pick(j.created, j.createdAt, j.created_at, j.createdOn, j.createdUtc, j.createdUTC, j.creationDate, j.creation),
      active: true,
      verified: captured2
    });

    dynRows.push({
      uuid: uuidv4(),
      id: groupId,
      name: safeText(j.name),
      description: safeText(j.description),
      ranks: null,
      members: memberCount,
      funds: null,
      verified: (verified === true || verified === 1) ? 1 : (verified === false || verified === 0) ? 0 : null,
      links: null,
      affiliates: null,
      captured: captured2
    });

    addRows('rb_static_archive', staticRows);
    addRows('rb_dynamic_group_archive', dynRows);
    flushNow();
  }
  return;
}

// Passive announcements / events capture removed in this build.
    } catch (e) {}
  });

  // -----------------------
  // Main router
  // -----------------------
  async function route() {
    const url = location.href;
    const gid = getGroupIdFromUrl(url);
    if (gid) {
      try {
        await ensureWallPagerUI(gid);
        runnerSyncUiFromState();
        const runnerState = loadRunnerStateSync();
        if (runnerState && runnerState.active) scheduleRunnerTick(50);
      } catch (e) {}
      return;
    }

    removeWallPagerUI();
    const runnerState = loadRunnerStateSync();
    if (runnerState && runnerState.active) {
      scheduleRunnerTick(500);
    }
  }

  // Run on load + SPA navigation
  route();
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      route();
    }
  }).observe(document, { subtree: true, childList: true });
})();
