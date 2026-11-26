(function () {
  "use strict";

  var API_BASE = window.RENDERER_API_BASE || "https://fossils.onrender.com";
  var RENDERER_SCRIPT_VERSION = "20261127-user-checker-v2";
  var RETRY_LIMIT = 60;
  var OLD_AVATAR_PAGE_SIZE = 12;

  function text(value) {
    return value == null ? "" : String(value);
  }

  // Tell Coy what was looked up so he can react to it in his speech bubble (CoyCompanion listens).
  // The query may be a username, a numeric user id, or a roblox.com/users/<id> link.
  function notifyCoy(query, id) {
    try {
      var typed = text(query).trim().match(/^(?:https?:\/\/(?:www\.)?roblox\.com\/users\/)?(\d+)(?:\/profile)?\/?$/i);
      window.dispatchEvent(new CustomEvent("coy:renderer-lookup", {
        detail: { query: text(query).trim(), id: text(id || (typed && typed[1]) || "") }
      }));
    } catch (error) { /* Coy's reaction is optional */ }
  }

  function escapeHtml(value) {
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function initRenderer() {
    var usernameInput = document.getElementById("usernameInput");
    var checkBtn = document.getElementById("checkBtn");
    var messageBox = document.getElementById("messageBox");
    var loadingIndicator = document.getElementById("loadingIndicator");
    var spinner = document.getElementById("spinner");
    var centerPanel = document.getElementById("centerPanel");
    var boundKey = "data-renderer-key-bound";

    if (!usernameInput || !checkBtn || !messageBox ||
        !loadingIndicator || !spinner || !centerPanel) {
      return false;
    }

    if (checkBtn.getAttribute("data-renderer-bound") === "1") {
      return true;
    }

    checkBtn.setAttribute("data-renderer-bound", "1");
    usernameInput.setAttribute(boundKey, "1");

    var frames = ["-", "/", "|", "\\"];
    var frameIndex = 0;
    var spinTimer = setInterval(function () {
      if (loadingIndicator.style.display === "flex") {
        spinner.textContent = frames[frameIndex % frames.length];
        frameIndex += 1;
      }
    }, 120);

    function cleanup() {
      clearInterval(spinTimer);
    }

    function showError(message) {
      loadingIndicator.style.display = "none";
      messageBox.textContent = message;
      messageBox.style.display = "flex";
      messageBox.classList.remove("shake");
      void messageBox.offsetWidth;
      messageBox.classList.add("shake");
    }

    usernameInput.addEventListener("input", function () {
      messageBox.style.display = "none";
      messageBox.textContent = "";
    });

    function fetchRendererData(username) {
      return fetch(API_BASE + "/proxy-roblox?username=" + encodeURIComponent(username), {
        headers: { "Accept": "application/json" },
        cache: "no-store"
      }).then(function (response) {
        if (!response.ok) throw new Error("Backend HTTP " + response.status);
        return response.json();
      });
    }

    var lookupSequence = 0;

    function el(tag, className, textValue) {
      var node = document.createElement(tag);
      if (className) node.className = className;
      if (textValue != null) node.textContent = textValue;
      return node;
    }

    function safeHttpUrl(value) {
      try {
        var parsed = new URL(text(value));
        return (parsed.protocol === "https:" || parsed.protocol === "http:") ? parsed.href : "";
      } catch (_) { return ""; }
    }

    function formatCount(value) {
      var n = Number(value) || 0;
      try { return n.toLocaleString("en-US"); } catch (_) { return String(n); }
    }

    function getJson(url) {
      return fetch(url, { headers: { Accept: "application/json" } }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (body) {
          if (!response.ok) {
            var err = new Error((body && body.error) || ("HTTP " + response.status));
            err.status = response.status;
            err.code = body && body.code;
            throw err;
          }
          return body;
        });
      });
    }

    // Every section reports its own failure, e.g. "Forum posts error: ...".
    function showSectionError(container, label, message) {
      if (!container) return;
      var box = container.querySelector(":scope > .checker-error");
      if (!box) {
        box = el("div", "checker-error");
        box.setAttribute("role", "alert");
        var title = container.querySelector(":scope > .checker-section-title");
        if (title && title.nextSibling) container.insertBefore(box, title.nextSibling);
        else container.appendChild(box);
      }
      box.textContent = label + " error: " + message;
    }

    function clearSectionError(container) {
      var box = container && container.querySelector(":scope > .checker-error");
      if (box) box.remove();
    }

    function describeFailure(error, archiveName) {
      if (error && error.code === "ARCHIVE_NOT_PUBLISHED") {
        return "the " + archiveName + " archive isn't available yet.";
      }
      if (error && /Failed to fetch|NetworkError|Load failed/i.test(String(error.message))) {
        return "couldn't reach the checker service. Try again in a moment.";
      }
      return "couldn't load right now" + (error && error.status ? " (HTTP " + error.status + ")." : ".");
    }

    function formatArchiveDate(value) {
      var raw = text(value).trim();
      if (!raw) return "";
      var d = /^\d{10,13}$/.test(raw) ? new Date(Number(raw) * (raw.length === 10 ? 1000 : 1)) : new Date(raw);
      if (isNaN(d.getTime())) return raw;
      try {
        return d.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }) + " UTC";
      } catch (_) { return d.toISOString(); }
    }

    function externalLink(className, label, href) {
      var link = el("a", className, label);
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      return link;
    }

    // Shared loader for archive sections: pages through ?offset= with "Load more".
    function loadArchiveSection(options) {
      var section = document.getElementById(options.sectionId);
      if (!section) return;
      var status = section.querySelector(".checker-section-status");
      var list = section.querySelector(".checker-archive-list");
      var actions = section.querySelector(".checker-archive-actions");
      var id = text(options.userId).trim();
      if (!/^\d+$/.test(id)) { status.textContent = ""; showSectionError(section, options.label, "no user ID to look up."); return; }
      var loaded = 0;

      function renderActions(nextOffset, busy) {
        actions.innerHTML = "";
        if (nextOffset != null) {
          var more = el("button", "xpButton checker-more", busy ? "Loading…" : "Load more");
          more.type = "button";
          more.disabled = !!busy;
          more.addEventListener("click", function () { fetchPage(nextOffset); });
          actions.appendChild(more);
        }
        if (options.extraLink) actions.appendChild(options.extraLink(id));
      }

      function fetchPage(offset) {
        if (offset) renderActions(offset, true);
        clearSectionError(section);
        getJson(API_BASE + options.endpoint + "?userId=" + encodeURIComponent(id) + "&offset=" + offset + "&limit=25").then(function (payload) {
          if (options.sequence !== lookupSequence || !document.body.contains(section)) return;
          var posts = Array.isArray(payload && payload.posts) ? payload.posts : [];
          posts.forEach(function (post) { list.appendChild(options.renderPost(post)); });
          loaded += posts.length;
          var total = Number(payload && payload.total) || loaded;
          status.textContent = total
            ? "Showing " + loaded + " of " + formatCount(total) + " " + (total === 1 ? options.noun : options.nounPlural)
            : options.emptyText;
          renderActions(payload && payload.nextOffset != null ? payload.nextOffset : null, false);
        }).catch(function (error) {
          if (options.sequence !== lookupSequence || !document.body.contains(section)) return;
          status.textContent = loaded ? "Showing " + loaded + " " + options.nounPlural : "";
          showSectionError(section, options.label, describeFailure(error, options.archiveName));
          renderActions(loaded ? offset : null, false);
        });
      }

      fetchPage(0);
    }

    function renderGroupWallPost(post) {
      var item = el("div", "checker-post");
      var groupLabel = text(post.groupName) || (post.groupId ? "Group " + text(post.groupId) : "Unknown group");
      var heading = post.groupId
        ? externalLink("checker-post-title", groupLabel, "https://www.roblox.com/groups/" + encodeURIComponent(text(post.groupId)) + "/")
        : el("div", "checker-post-title", groupLabel);
      item.appendChild(heading);
      var meta = [post.username ? "as " + text(post.username) : "", text(post.role), formatArchiveDate(post.created)].filter(Boolean).join(" · ");
      if (meta) item.appendChild(el("div", "checker-post-meta", meta));
      item.appendChild(el("div", "checker-post-body", text(post.message)));
      return item;
    }

    function renderForumPost(post) {
      var item = el("div", "checker-post");
      var title = text(post.title) || "(untitled)";
      var threadUrl = safeHttpUrl(post.threadUrl);
      item.appendChild(threadUrl ? externalLink("checker-post-title", title, threadUrl) : el("div", "checker-post-title", title));
      var meta = [text(post.forum), formatArchiveDate(post.created)].filter(Boolean).join(" · ");
      if (meta) item.appendChild(el("div", "checker-post-meta", meta));
      if (post.body) item.appendChild(el("div", "checker-post-body", text(post.body)));
      return item;
    }

    function loadGroupWallPosts(userId, sequence) {
      loadArchiveSection({
        sectionId: "userGroupWallPosts", endpoint: "/proxy-roblox-group-wall", userId: userId, sequence: sequence,
        label: "Group wall posts", archiveName: "group wall", noun: "group wall post", nounPlural: "group wall posts",
        emptyText: "No archived group wall posts.", renderPost: renderGroupWallPost
      });
    }

    function loadForumPosts(userId, sequence) {
      loadArchiveSection({
        sectionId: "userForumPosts", endpoint: "/proxy-roblox-forum", userId: userId, sequence: sequence,
        label: "Forum posts", archiveName: "forum", noun: "forum post", nounPlural: "forum posts",
        emptyText: "No archived forum posts.", renderPost: renderForumPost,
        extraLink: function (id) {
          return externalLink("checker-archive-link", "Open on archive.froast.io", "https://archive.froast.io/users/" + encodeURIComponent(id));
        }
      });
    }

    function runLookup() {
      var sequence = ++lookupSequence;
      var username = usernameInput.value.trim();
      if (!username) {
        centerPanel.innerHTML = "";
        showError("Enter a username first!");
        return;
      }

      // React the moment an id / profile link is searched; a username is checked once it resolves.
      var notified = false;
      if (/^(?:https?:\/\/(?:www\.)?roblox\.com\/users\/)?\d+(?:\/profile)?\/?$/i.test(username)) {
        notifyCoy(username);
        notified = true;
      }

      messageBox.style.display = "none";
      // Keep the last successful result visible while the next lookup loads.
      loadingIndicator.style.display = "flex";
      fetchRendererData(username)
        .then(function (data) {
          if (sequence !== lookupSequence) return;
          var roblox = data && data.roblox ? data.roblox : {};
          if (!notified && roblox.id) notifyCoy(username, roblox.id);
          var rolimons = data && data.rolimons ? data.rolimons : {};
          var oldAvatars = Array.isArray(roblox.oldAvatars) ? roblox.oldAvatars : [];
          var imageUrls = [];
          var i;

          if (roblox.avatarUrl) {
            imageUrls.push(roblox.avatarUrl);
          }

          var pastNames = (Array.isArray(roblox.pastUsernames) && roblox.pastUsernames.length)
            ? roblox.pastUsernames.join(", ")
            : "None";
          var lastOnline = rolimons.lastOnline || "Unknown";
          var rap = rolimons.rap || "Unknown";
          var value = rolimons.value || "Unknown";
          var terminated = rolimons.terminated ? '<p class="rendererTermination">Terminated</p>' : "";
          var html =
            '<div class="info-box">' +
              '<div id="avatarRendererErrors" class="checker-avatar-errors"></div>' +
              '<div class="avatar-container">' +
                '<a href="https://www.roblox.com/users/' + encodeURIComponent(text(roblox.id)) + '/profile" target="_blank" rel="noopener noreferrer">' +
                  '<img alt="" loading="eager" decoding="async" fetchpriority="high" style="width:120px;height:120px;object-fit:cover;background:#fff;">' +
                '</a>' +
              '</div>' +
              '<div id="terminationLine">' + terminated + '</div>' +
              '<div class="info-line rendererName"><b>' +
                escapeHtml(roblox.displayName || "") +
                '</b> [' +
                escapeHtml(roblox.username || username) +
                ']</div>' +
              '<div class="info-line"><b>User ID:</b> ' + escapeHtml(roblox.id) + '</div>' +
              '<div id="pastUsernamesLine" class="info-line"><b>Past usernames:</b> ' + escapeHtml(pastNames) + '</div>' +
              '<div class="info-line"><b>Joined:</b> ' + escapeHtml(roblox.joinDate || "Unknown") + '</div>' +
              '<div id="lastOnlineLine" class="info-line"><b>Last Online:</b> ' + escapeHtml(lastOnline) + '</div>' +
              '<div id="valueLine" class="info-line"><b>RAP:</b> ' + escapeHtml(rap) + ' &nbsp;&nbsp; <b>Value:</b> ' + escapeHtml(value) + '</div>' +
              '<div id="oldAvatars" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-flow:row;gap:8px;width:100%;margin-top:12px;padding-top:10px;border-top:1px solid #7b9ebd;font-size:11px;color:#24364b;align-items:stretch;box-sizing:border-box;">Loading archived renders…</div>' +
              '<div id="userGroupWallPosts" class="checker-section">' +
                '<div class="checker-section-title">Group Wall Posts</div>' +
                '<div class="checker-section-status" role="status">Loading group wall posts…</div>' +
                '<div class="checker-archive-list"></div>' +
                '<div class="checker-archive-actions"></div>' +
              '</div>' +
              '<div id="userForumPosts" class="checker-section">' +
                '<div class="checker-section-title">Forum Posts</div>' +
                '<div class="checker-section-status" role="status">Loading forum posts…</div>' +
                '<div class="checker-archive-list"></div>' +
                '<div class="checker-archive-actions"></div>' +
              '</div>' +
            '</div>';

          centerPanel.innerHTML = html;
          loadingIndicator.style.display = "none";

          loadGroupWallPosts(roblox.id, sequence);
          loadForumPosts(roblox.id, sequence);
          var avatarErrors = document.getElementById("avatarRendererErrors");

          // Try the backend image proxy first, then the original Roblox CDN URL.
          // Some Roblox CDN responses work in browsers even when the server proxy fails.
          var liveAvatarImage = centerPanel.querySelector(".avatar-container img");
          if (liveAvatarImage) {
            var proxyAvatarUrl = text(roblox.avatarUrl || "");
            var directAvatarUrl = "";
            try {
              var parsedAvatarUrl = new URL(proxyAvatarUrl, window.location.href);
              if (parsedAvatarUrl.pathname.indexOf("/proxy-roblox-avatar") !== -1) {
                directAvatarUrl = parsedAvatarUrl.searchParams.get("url") || "";
              }
            } catch (_) {}
            var avatarCandidates = [];
            if (proxyAvatarUrl) avatarCandidates.push(proxyAvatarUrl);
            if (directAvatarUrl && directAvatarUrl !== proxyAvatarUrl) avatarCandidates.push(directAvatarUrl);
            var avatarAttempt = 0;
            liveAvatarImage.addEventListener("error", function retryAvatar() {
              avatarAttempt += 1;
              if (avatarAttempt < avatarCandidates.length) {
                liveAvatarImage.src = avatarCandidates[avatarAttempt];
              } else {
                liveAvatarImage.removeAttribute("src");
                liveAvatarImage.alt = "Avatar unavailable";
                liveAvatarImage.title = "Roblox did not return a usable avatar image. Try checking again.";
                showSectionError(avatarErrors, "Avatar renderer", "Roblox didn't return a usable avatar image. Try checking again.");
              }
            });
            if (avatarCandidates.length) {
              // Attach fallback handling before the first request to avoid losing fast errors.
              liveAvatarImage.src = avatarCandidates[0];
            } else {
              liveAvatarImage.alt = "Avatar unavailable";
              liveAvatarImage.title = "No live avatar thumbnail URL was returned by Roblox.";
              showSectionError(avatarErrors, "Avatar renderer", "Roblox didn't return an avatar for this user.");
            }
          }

          function waybackImage(stamp, url) {
            if (!stamp || !url) return "";
            return "https://web.archive.org/web/" + stamp + "im_/" + url;
          }

          // Query the backend proxy so release downloads and gzip decompression work
          // consistently across browsers, including browsers without DecompressionStream.
          // Use the backend proxy because GitHub Release assets do not allow browser CORS.
          // The backend caches and decompresses each shard so repeat lookups are faster.
          // Use the backend proxy because GitHub Release assets do not allow browser CORS.
          // Cache each user's immutable release-index results locally for instant repeat lookups.
          function fetchSavedArchivedAvatars(userId) {
            var id = text(userId).trim();
            if (!/^\d+$/.test(id)) return Promise.resolve([]);
            var storageKey = "avatar-history-index-v17:" + id;
            var cachedItems = [];
            try {
              var cached = window.localStorage.getItem(storageKey);
              if (cached) {
                var parsedCache = JSON.parse(cached);
                if (Array.isArray(parsedCache)) cachedItems = parsedCache;
              }
            } catch (_) {}
            // The release index is immutable for this version. Paint a known user's
            // archive immediately from local storage instead of waiting for the backend
            // and its compressed release shards on every repeat lookup.
            if (cachedItems.length) return Promise.resolve(cachedItems);
            return fetch(API_BASE + "/proxy-roblox-history-index?userId=" + encodeURIComponent(id), {
              headers: { Accept: "application/json" },
              cache: "force-cache"
            }).then(function (response) {
              if (!response.ok) throw new Error("History index HTTP " + response.status);
              return response.json();
            }).then(function (payload) {
              var freshItems = Array.isArray(payload && payload.images) ? payload.images : [];
              var mergedItems = [];
              var seenItems = Object.create(null);
              cachedItems.concat(freshItems).forEach(function (item) {
                if (!item || typeof item !== "object") return;
                var url = text(item.url || item.wayback).trim();
                var timestamp = text(item.timestamp || "").trim();
                if (!/^https?:\/\//i.test(url)) return;
                if (timestamp && !/^\d{8,14}$/.test(timestamp)) return;
                var key = timestamp + "|" + url;
                if (seenItems[key]) return;
                seenItems[key] = true;
                mergedItems.push({ url: url, timestamp: timestamp, source: text(item.source || "cached-index") });
              });
              mergedItems.sort(function (a, b) {
                return text(a.timestamp).localeCompare(text(b.timestamp));
              });
              try { window.localStorage.setItem(storageKey, JSON.stringify(mergedItems)); } catch (_) {}
              return mergedItems;
            }).catch(function () {
              // Keep the last persisted copy available when the backend is temporarily down.
              return cachedItems;
            });
          }

          function normalizeArchivedItem(item) {
            if (!item || typeof item !== "object") return null;
            var url = text(item.url || item.wayback).trim();
            // Damaged index rows sometimes put a date where the image URL belongs.
            // Reject those rows before creating an image element or network request.
            if (!/^https?:\/\//i.test(url) || /^\d{4}[-/]?\d{2}[-/]?\d{2}(?:\D.*)?$/.test(url)) return null;
            try {
              var parsed = new URL(url);
              if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
                  !parsed.hostname || parsed.hostname.indexOf(".") === -1) return null;
            } catch (_) { return null; }
            var timestamp = text(item.timestamp || "");
            if (timestamp && !/^\d{8,14}$/.test(timestamp)) timestamp = "";
            return { url: url, timestamp: timestamp };
          }

          var oldContainer = document.getElementById("oldAvatars");
          if (oldContainer) oldContainer.textContent = "Loading archived renders…";
          fetchSavedArchivedAvatars(roblox.id).then(function (saved) {
            if (sequence !== lookupSequence) return [];
            // The prebuilt index is the fast path. Render it immediately instead
            // of blocking every image on a separate Wayback discovery request.
            // Only use discovery when the index has no saved entries at all.
            if (Array.isArray(saved) && saved.length) return saved;
            return fetch(API_BASE + "/proxy-roblox-archived?userId=" + encodeURIComponent(text(roblox.id)), {
              headers: { Accept: "application/json" },
              cache: "no-store"
            }).then(function (response) {
              return response.ok ? response.json() : { images: [] };
            }).then(function (payload) {
              if (sequence !== lookupSequence) return [];
              var waybackItems = Array.isArray(payload && payload.images) ? payload.images : [];
              return (Array.isArray(saved) ? saved : []).concat(waybackItems);
            }).catch(function () {
              return Array.isArray(saved) ? saved : [];
            });
          }).then(function (rawItems) {
            if (sequence !== lookupSequence) return;
            if (!oldContainer || !document.body.contains(oldContainer)) return;
            var merged = [];
            var seen = Object.create(null);
            rawItems.forEach(function (raw) {
              var item = normalizeArchivedItem(raw);
              // The same image URL can have many valid archived captures.
              // Deduplicate exact URL+timestamp pairs, never the URL alone.
              var captureKey = item ? item.timestamp + "|" + item.url : "";
              if (!item || seen[captureKey]) return;
              seen[captureKey] = true;
              merged.push(item);
            });
            // Sort by capture time, earliest first. Unknown dates go last.
            function archiveSortKey(item) {
              var digits = text(item.timestamp).replace(/\D/g, "");
              if (!digits) return Number.MAX_SAFE_INTEGER;
              // Archive timestamps are YYYYMMDD[hhmmss]. Pad missing time
              // components on the right so date-only captures sort by date.
              return Number((digits + "000000").slice(0, 14));
            }
            // Explicit oldest-to-newest ordering, with undated items at the end.
            merged.sort(function (a, b) {
              return archiveSortKey(a) - archiveSortKey(b);
            });
            if (!merged.length) {
              oldContainer.textContent = "No archived renders.";
              return;
            }
            oldContainer.innerHTML = "";
            var label = document.createElement("div");
            label.style.gridColumn = "1 / -1";
            label.style.marginBottom = "4px";
            label.textContent = "Archived renders";
            oldContainer.appendChild(label);
            var status = document.createElement("div");
            status.style.gridColumn = "1 / -1";
            status.style.marginBottom = "4px";
            status.setAttribute("role", "status");
            oldContainer.appendChild(status);
            var loadedCount = 0;
            var failedCount = 0;
            function updateArchiveStatus() {
              status.textContent = merged.length + " indexed · " + loadedCount + " loaded · " +
                failedCount + " unavailable";
            }
            updateArchiveStatus();
            merged.forEach(function (item, index) {
              var card = document.createElement("div");
              card.className = "old-avatar-card";
              card.style.minWidth = "0";
              card.style.width = "100%";
              card.style.boxSizing = "border-box";
              card.style.display = "flex";
              card.style.flexDirection = "column";
              card.style.overflow = "hidden";
              card.style.border = "1px solid #7f9db9";
              card.style.background = "#ece9d8";
              card.style.boxShadow = "inset 1px 1px 0 #fff, inset -1px -1px 0 #c2c2c2";
              card.style.alignSelf = "stretch";

              var img = document.createElement("img");
              var archivedSrc = item.url;
              if (archivedSrc && archivedSrc.indexOf("/proxy-roblox-avatar") === -1) {
                archivedSrc = API_BASE + "/proxy-roblox-avatar?url=" + encodeURIComponent(item.url);
              }
              img.alt = "Archived avatar from " + (item.timestamp || "an unknown date");
              // Use identical square viewports and prioritize the first visible rows.
              img.loading = index < 16 ? "eager" : "lazy";
              img.decoding = "async";
              img.fetchPriority = index < 8 ? "high" : index < 16 ? "auto" : "low";
              img.className = "old-avatar-thumb";
              img.style.display = "block";
              img.style.width = "100%";
              img.style.aspectRatio = "1 / 1";
              img.style.height = "auto";
              img.style.flex = "0 0 auto";
              img.style.boxSizing = "border-box";
              img.style.objectFit = "contain";
              img.style.padding = "4px";
              img.style.background = "#dce6f1";
              img.style.cursor = "pointer";
              img.title = "Open archived avatar";
              // Never request legacy Roblox CDN hosts directly from the HTTPS page.
              // Old t0-t7.roblox.com certificates are invalid, and direct HTTP fallbacks
              // cause mixed-content warnings. Keep every attempt behind the HTTPS proxy.
              var imageCandidates = [];
              function addProxyCandidate(url) {
                if (!url) return;
                var proxyUrl = API_BASE + "/proxy-roblox-avatar?url=" + encodeURIComponent(url);
                if (imageCandidates.indexOf(proxyUrl) === -1) imageCandidates.push(proxyUrl);
              }
              addProxyCandidate(item.url);

              // Wayback replay pages can reject the backend's server-side fetch even
              // when the browser can display the archived image directly. Add the HTTPS
              // archive URL as a fallback, but never request old Roblox CDN URLs directly.
              try {
                var archiveUrl = new URL(item.url);
                if (archiveUrl.protocol === "https:" &&
                    (archiveUrl.hostname === "web.archive.org" ||
                     archiveUrl.hostname === "wayback.archive-it.org") &&
                    imageCandidates.indexOf(item.url) === -1) {
                  imageCandidates.push(item.url);
                }
              } catch (_) {}

              // Keep a small fallback chain so one proxy miss does not instantly mark
              // an otherwise browser-loadable archived capture unavailable.
              var imageCandidateIndex = 0;
              var imageResolved = false;
              img.addEventListener("load", function () {
                if (imageResolved) return;
                imageResolved = true;
                loadedCount += 1;
                updateArchiveStatus();
              });
              img.addEventListener("error", function () {
                imageCandidateIndex += 1;
                if (imageCandidateIndex < imageCandidates.length) {
                  img.src = imageCandidates[imageCandidateIndex];
                  return;
                }
                // Remove failed images from the render grid and report them only in the status.
                if (!imageResolved) {
                  imageResolved = true;
                  failedCount += 1;
                  updateArchiveStatus();
                }
                card.remove();
              });

              // Assign only after the fallback error handler is attached.
              img.src = imageCandidates[0] || archivedSrc;
              img.addEventListener("click", function () {
                window.open(item.url, "_blank", "noopener,noreferrer");
              });
              card.appendChild(img);

              var dateLabel = document.createElement("div");
              dateLabel.className = "old-avatar-date";
              dateLabel.style.boxSizing = "border-box";
              dateLabel.style.display = "flex";
              dateLabel.style.alignItems = "center";
              dateLabel.style.justifyContent = "center";
              dateLabel.style.width = "100%";
              dateLabel.style.minHeight = "27px";
              dateLabel.style.marginTop = "auto";
              dateLabel.style.padding = "5px 3px";
              dateLabel.style.borderTop = "1px solid #7f9db9";
              dateLabel.style.background = "linear-gradient(#f8f8f2,#d9e3ef)";
              dateLabel.style.color = "#24364b";
              dateLabel.style.fontSize = "10px";
              dateLabel.style.fontWeight = "bold";
              dateLabel.style.lineHeight = "1.2";
              dateLabel.style.textAlign = "center";
              dateLabel.style.whiteSpace = "nowrap";
              dateLabel.style.overflow = "hidden";
              dateLabel.style.textOverflow = "ellipsis";
              var digits = text(item.timestamp).replace(/\D/g, "");
              if (digits.length >= 8) {
                dateLabel.textContent = digits.slice(0, 4) + "-" + digits.slice(4, 6) + "-" + digits.slice(6, 8);
                dateLabel.title = digits.length >= 14
                  ? digits.slice(0, 4) + "-" + digits.slice(4, 6) + "-" + digits.slice(6, 8) + " " + digits.slice(8, 10) + ":" + digits.slice(10, 12) + ":" + digits.slice(12, 14) + " UTC"
                  : "Archive capture date";
              } else {
                dateLabel.textContent = "Date unknown";
              }
              card.appendChild(dateLabel);
              oldContainer.appendChild(card);
            });
          }).catch(function () {
            if (sequence !== lookupSequence) return;
            if (oldContainer && document.body.contains(oldContainer)) oldContainer.textContent = "";
            showSectionError(avatarErrors, "Avatar renderer", "archived renders couldn't load right now.");
          });

        })
        .catch(function (error) {
          if (sequence !== lookupSequence) return;
          // Expected lookup failures are shown in the renderer UI; keep the browser console clean.
          loadingIndicator.style.display = "none";
          showError(
            error && error.message && error.message.indexOf("Failed to fetch") !== -1
              ? "Avatar renderer error: the checker service is unavailable. Try again in a moment."
              : "User not found (◞‸◟；)"
          );
        });
    }

    checkBtn.addEventListener("click", runLookup);

    usernameInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.keyCode === 13) {
        event.preventDefault();
        runLookup();
      }
    });

    var observer = new MutationObserver(function () {
      if (!document.body.contains(checkBtn)) {
        cleanup();
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return true;
  }

  // The Renderer window can be closed and reopened without reloading the site.
  // Expose a safe reinitializer so each newly mounted window gets fresh handlers.
  window.initLegacyRenderer = initRenderer;

  var tries = 0;
  var timer = setInterval(function () {
    tries += 1;

    if (initRenderer() || tries >= RETRY_LIMIT) {
      clearInterval(timer);
    }
  }, 100);
}());