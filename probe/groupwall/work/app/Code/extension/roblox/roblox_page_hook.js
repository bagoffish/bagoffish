// Runs in the page (main world).
// 1) Captures selected API responses (fetch + XHR) -> content-script via window.postMessage
// 2) Provides a small RPC for the content-script to ask the page to fetch JSON (bypasses CORS issues)
//
// NOTE: Keep this conservative to avoid breaking the site.

(function () {
  'use strict';

  const MAX_CAPTURE_BYTES = 2 * 1024 * 1024; // 2MB cap per response

  // Capture allowlist (keep broad but Roblox-focused)
  const ALLOWLIST = [
    // Communities/groups content
    /\/groups\//i,
    /\/communities\//i,
    /\/v1\/(?:groups|communities)\//i,
    /\/v2\/(?:groups|communities)\//i,
    /\/social-links/i,
    /\/relationships\//i,
    /\/wall\/posts/i,

    // Announcements / forums / events
    /\/announcements/i,
    /\/forums/i,
    /\/community-boards/i,
    /\/events/i,
    /\/experience-events/i,

    // Economy (group funds)
    /economy\.roblox\.com\/v1\/groups\//i,
  ];

  function shouldCapture(url) {
    if (!url) return false;
    try {
      const u = String(url);
      return ALLOWLIST.some((re) => re.test(u));
    } catch {
      return false;
    }
  }

  function postMessageSafe(obj) {
    try {
      window.postMessage(obj, '*');
    } catch {
      // ignore
    }
  }

  function postCapture(payload) {
    postMessageSafe({ __roa: true, type: 'ROBLOX_API_CAPTURE', payload });
  }

  // ---------------------------------------------------------------------------
  // RPC: content-script -> page fetch
  // ---------------------------------------------------------------------------

  // Keep the GET RPC name stable for existing callers.
  // Request:  {__roa:true, type:'ROA_FETCH_JSON', id, url, opts:{headers?}}
  // Response: {__roa:true, type:'ROA_FETCH_JSON_RESULT', id, ok, status, text?, error?}
  // Generic HTTP RPC:
  // Request:  {__roa:true, type:'ROA_HTTP_REQUEST', id, url, opts:{method?,headers?,bodyText?,credentials?,cache?}}
  // Response: {__roa:true, type:'ROA_HTTP_RESULT', id, ok, status, text?, error?, headers?}

  const rpcInFlight = new Set();
  let csrfTokenCache = null;

  async function rpcHttpRequest(id, url, opts) {
    if (!id || !url) return;
    if (rpcInFlight.has(id)) return;
    rpcInFlight.add(id);

    let status = 0;
    try {
      const method = String((opts && opts.method) || 'GET').toUpperCase();
      const baseHeaders = (opts && typeof opts === 'object' && opts.headers && typeof opts.headers === 'object') ? Object.assign({}, opts.headers) : {};
      const bodyText = (opts && Object.prototype.hasOwnProperty.call(opts, 'bodyText')) ? opts.bodyText : undefined;
      const credentials = (opts && opts.credentials) ? opts.credentials : 'include';
      const cache = (opts && opts.cache) ? opts.cache : 'no-store';

      async function doFetch(useToken) {
        const headers = Object.assign({}, baseHeaders);
        if (useToken && csrfTokenCache && method !== 'GET' && method !== 'HEAD') {
          headers['X-CSRF-TOKEN'] = csrfTokenCache;
        }
        const init = { method, headers, credentials, cache };
        if (bodyText !== undefined && bodyText !== null && method !== 'GET' && method !== 'HEAD') {
          init.body = String(bodyText);
        }
        return await window.fetch(String(url), init);
      }

      let res = await doFetch(true);
      status = res.status;
      if (method !== 'GET' && method !== 'HEAD' && res && res.status === 403) {
        try {
          const freshToken = (res.headers && res.headers.get && res.headers.get('x-csrf-token')) || '';
          if (freshToken) {
            csrfTokenCache = freshToken;
            res = await doFetch(true);
            status = res.status;
          }
        } catch {
          // ignore
        }
      }

      const headers = {};
      try {
        if (res && res.headers && typeof res.headers.forEach === 'function') {
          res.headers.forEach((v, k) => { headers[String(k || '').toLowerCase()] = String(v || ''); });
        }
      } catch {
        // ignore
      }
      const txt = await res.text().catch(() => '');
      const clipped = txt && txt.length > MAX_CAPTURE_BYTES ? txt.slice(0, MAX_CAPTURE_BYTES) : txt;
      postMessageSafe({ __roa: true, type: 'ROA_HTTP_RESULT', id, ok: !!(res && res.ok), status, text: clipped || '', error: '', headers });
    } catch (e) {
      postMessageSafe({ __roa: true, type: 'ROA_HTTP_RESULT', id, ok: false, status, text: '', error: String(e && (e.message || e)), headers: {} });
    } finally {
      rpcInFlight.delete(id);
    }
  }

  async function rpcFetchJson(id, url, opts) {
    if (!id || !url) return;
    if (rpcInFlight.has(id)) return;
    rpcInFlight.add(id);

    let status = 0;
    try {
      const headers = (opts && typeof opts === 'object' && opts.headers && typeof opts.headers === 'object') ? opts.headers : {};
      const res = await window.fetch(String(url), {
        method: 'GET',
        headers,
        credentials: 'include',
        cache: 'no-store',
      });
      status = res.status;

      const ct = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
      if (!(ct.includes('application/json') || ct.includes('text/json') || ct.includes('json'))) {
        const txt = await res.text().catch(() => '');
        const clipped = txt && txt.length > MAX_CAPTURE_BYTES ? txt.slice(0, MAX_CAPTURE_BYTES) : txt;
        postMessageSafe({ __roa: true, type: 'ROA_FETCH_JSON_RESULT', id, ok: false, status, error: 'non_json_response', text: clipped || '' });
        return;
      }

      const txt = await res.text().catch(() => '');
      const clipped = txt && txt.length > MAX_CAPTURE_BYTES ? txt.slice(0, MAX_CAPTURE_BYTES) : txt;
      postMessageSafe({ __roa: true, type: 'ROA_FETCH_JSON_RESULT', id, ok: res.ok, status, text: clipped || '' });
    } catch (e) {
      postMessageSafe({ __roa: true, type: 'ROA_FETCH_JSON_RESULT', id, ok: false, status, error: String(e && (e.message || e)) });
    } finally {
      rpcInFlight.delete(id);
    }
  }

  window.addEventListener('message', (event) => {
    try {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.__roa !== true) return;

      if (data.type === 'ROA_PING') {
        postMessageSafe({ __roa: true, type: 'ROA_PONG', id: data.id || null, ok: true });
        return;
      }

      if (data.type === 'ROA_FETCH_JSON') {
        const id = data.id;
        const url = data.url;
        const opts = data.opts;
        rpcFetchJson(id, url, opts);
        return;
      }

      if (data.type === 'ROA_HTTP_REQUEST') {
        rpcHttpRequest(data.id, data.url, data.opts || {});
        return;
      }
    } catch {
      // ignore
    }
  });

  // ---------------------------------------------------------------------------
  // Passive capture: fetch + XHR monkeypatch
  // ---------------------------------------------------------------------------

  // ---- fetch ----
  try {
    const origFetch = window.fetch;
    window.fetch = async function (...args) {
      const res = await origFetch.apply(this, args);
      try {
        const req = args[0];
        const url = (typeof req === 'string') ? req : (req && req.url);
        if (shouldCapture(url)) {
          const clone = res.clone();
          const ct = (clone.headers && clone.headers.get && clone.headers.get('content-type')) || '';
          if (ct.includes('application/json') || ct.includes('text/json') || ct.includes('json')) {
            const txt = await clone.text();
            if (txt && txt.length <= MAX_CAPTURE_BYTES) {
              postCapture({
                url: String(url),
                status: clone.status,
                method: (args[1] && args[1].method) || 'GET',
                text: txt
              });
            }
          }
        }
      } catch {
        // ignore
      }
      return res;
    };
  } catch {
    // ignore
  }

  // ---- XHR ----
  try {
    const OrigXHR = window.XMLHttpRequest;
    function XHRProxy() {
      const xhr = new OrigXHR();
      let _url = null;
      let _method = 'GET';

      const origOpen = xhr.open;
      xhr.open = function (method, url, ...rest) {
        _method = method || 'GET';
        _url = url;
        return origOpen.call(this, method, url, ...rest);
      };

      xhr.addEventListener('load', function () {
        try {
          if (!_url || !shouldCapture(_url)) return;
          const ct = (xhr.getResponseHeader && xhr.getResponseHeader('content-type')) || '';
          if (!(ct.includes('application/json') || ct.includes('json'))) return;
          const txt = xhr.responseText;
          if (txt && txt.length <= MAX_CAPTURE_BYTES) {
            postCapture({
              url: String(_url),
              status: xhr.status,
              method: _method,
              text: txt
            });
          }
        } catch {
          // ignore
        }
      });

      return xhr;
    }
    window.XMLHttpRequest = XHRProxy;
  } catch {
    // ignore
  }
})();
