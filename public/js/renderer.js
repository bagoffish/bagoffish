(function () {
  "use strict";

  var API_BASE = window.RENDERER_API_BASE || "https://bloxify-backend-sg.onrender.com";
  var RENDERER_SCRIPT_VERSION = "20261012-avatar-grid-v11";
  var RETRY_LIMIT = 60;
  var OLD_AVATAR_PAGE_SIZE = 12;

  function text(value) {
    return value == null ? "" : String(value);
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

    function runLookup() {
      var sequence = ++lookupSequence;
      var username = usernameInput.value.trim();
      if (!username) {
        centerPanel.innerHTML = "";
        showError("Enter a username first!");
        return;
      }

      messageBox.style.display = "none";
      // Keep the last successful result visible while the next lookup loads.
      loadingIndicator.style.display = "flex";
      fetchRendererData(username)
        .then(function (data) {
          if (sequence !== lookupSequence) return;
          var roblox = data && data.roblox ? data.roblox : {};
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
              '<div class="avatar-container">' +
                '<a href="https://www.roblox.com/users/' + encodeURIComponent(text(roblox.id)) + '/profile" target="_blank" rel="noopener noreferrer">' +
                  '<img src="' + escapeHtml(roblox.avatarUrl || "") + '" alt="" loading="eager" decoding="async">' +
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
              '<div id="oldAvatars" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));grid-auto-flow:row;gap:8px;width:100%;margin-top:12px;padding-top:10px;border-top:1px solid #7b9ebd;font-size:11px;color:#24364b;align-items:stretch;box-sizing:border-box;">Loading archived renders…</div>' +
            '</div>';

          centerPanel.innerHTML = html;
          loadingIndicator.style.display = "none";

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
                liveAvatarImage.alt = "Avatar unavailable";
                liveAvatarImage.title = "Roblox did not return a usable avatar image. Try checking again.";
              }
            });
            if (!avatarCandidates.length) {
              liveAvatarImage.alt = "Avatar unavailable";
              liveAvatarImage.title = "No live avatar thumbnail URL was returned by Roblox.";
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
            var storageKey = "avatar-history-index-v10:" + id;
            try {
              var cached = window.localStorage.getItem(storageKey);
              if (cached) {
                var cachedItems = JSON.parse(cached);
                if (Array.isArray(cachedItems) && cachedItems.length) return Promise.resolve(cachedItems);
              }
            } catch (_) {}
            return fetch(API_BASE + "/proxy-roblox-history-index?userId=" + encodeURIComponent(id), {
              headers: { Accept: "application/json" },
              cache: "no-store"
            }).then(function (response) {
              if (!response.ok) return { images: [] };
              return response.json();
            }).then(function (payload) {
              var images = Array.isArray(payload && payload.images) ? payload.images : [];
              if (images.length) {
                try { window.localStorage.setItem(storageKey, JSON.stringify(images)); } catch (_) {}
              }
              return images;
            }).catch(function () { return []; });
          }

          function normalizeArchivedItem(item) {
            if (!item) return null;
            var url = text(item.url || item.wayback).trim();
            if (!url) return null;
            return { url: url, timestamp: text(item.timestamp || "") };
          }

          var oldContainer = document.getElementById("oldAvatars");
          if (oldContainer) oldContainer.textContent = "Loading archived renders…";
          fetchSavedArchivedAvatars(roblox.id).then(function (saved) {
            if (sequence !== lookupSequence) return [];
            // Prefer the prebuilt index and skip live Wayback discovery entirely
            // when it already has renders for this user.
            if (sequence !== lookupSequence) return [];
            if (Array.isArray(saved) && saved.length) return saved;
            return fetch(API_BASE + "/proxy-roblox-archived?userId=" + encodeURIComponent(text(roblox.id)), {
              headers: { Accept: "application/json" },
              cache: "no-store"
            }).then(function (response) {
              return response.ok ? response.json() : { images: [] };
            }).then(function (payload) {
              if (sequence !== lookupSequence) return [];
              return Array.isArray(payload && payload.images) ? payload.images : [];
            }).catch(function () { return []; });
          }).then(function (rawItems) {
            if (sequence !== lookupSequence) return;
            if (!oldContainer || !document.body.contains(oldContainer)) return;
            var merged = [];
            var seen = Object.create(null);
            rawItems.forEach(function (raw) {
              var item = normalizeArchivedItem(raw);
              if (!item || seen[item.url]) return;
              seen[item.url] = true;
              merged.push(item);
            });
            // Sort by capture time, earliest first. Unknown dates go last.
            function archiveSortKey(item) {
              var digits = text(item.timestamp).replace(/\D/g, "");
              if (!digits) return "99999999999999";
              return (digits + "00000000000000").slice(0, 14);
            }
            merged.sort(function (a, b) {
              var aKey = archiveSortKey(a);
              var bKey = archiveSortKey(b);
              return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
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
              img.src = archivedSrc;
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
              // Try multiple replay forms before marking an image unavailable.
              // The index can have valid dates even when Wayback rejects the first image URL.
              var imageCandidates = [];
              function addImageCandidate(url) {
                if (url && imageCandidates.indexOf(url) === -1) imageCandidates.push(url);
              }
              addImageCandidate(archivedSrc);
              addImageCandidate(item.url);
              if (/^https?:\\/\\/web\\.archive\\.org\\/web\\/\\d{8,14}im_\\//i.test(item.url)) {
                addImageCandidate(item.url.replace(/\\/web\\/(\\d{8,14})im_\\//i, "/web/$1/"));
                var originalMatch = item.url.match(/^https?:\\/\\/web\\.archive\\.org\\/web\\/\\d{8,14}(?:im_)?\\/(https?:\\/\\/.*)$/i);
                if (originalMatch) addImageCandidate(originalMatch[1]);
              }
              var imageCandidateIndex = 0;
              img.addEventListener("error", function () {
                imageCandidateIndex += 1;
                if (imageCandidateIndex < imageCandidates.length) {
                  img.src = imageCandidates[imageCandidateIndex];
                  return;
                }
                // Keep the archive grid stable even when every source fails.
                img.removeAttribute("src");
                img.alt = "Archived avatar unavailable";
                img.style.objectFit = "contain";
                img.style.background = "#dce6f1";
                img.style.minHeight = "104px";
                img.style.opacity = "0.65";
                img.title = "Wayback and direct image fallbacks all failed for this capture";
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
            if (oldContainer && document.body.contains(oldContainer)) oldContainer.textContent = "Archived renders unavailable.";
          });

        })
        .catch(function (error) {
          if (sequence !== lookupSequence) return;
          // Expected lookup failures are shown in the renderer UI; keep the browser console clean.
          loadingIndicator.style.display = "none";
          showError(
            error && error.message && error.message.indexOf("Failed to fetch") !== -1
              ? "Renderer service unavailable. Try again in a moment."
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

  var tries = 0;
  var timer = setInterval(function () {
    tries += 1;

    if (initRenderer() || tries >= RETRY_LIMIT) {
      clearInterval(timer);
    }
  }, 100);
}());