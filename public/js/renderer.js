(function () {
  "use strict";

  var API_BASE = window.RENDERER_API_BASE || "https://winxp-backend-live.onrender.com";
  var RENDERER_SCRIPT_VERSION = "20261008-live-current-archive-old";
  var RETRY_LIMIT = 60;
  var OLD_AVATAR_PAGE_SIZE = 12;
  var ARCHIVE_SHARDS = 128;

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

    function runLookup() {
      var username = usernameInput.value.trim();
      if (!username) {
        centerPanel.innerHTML = "";
        showError("Enter a username, dumbass!");
        return;
      }

      messageBox.style.display = "none";
      centerPanel.innerHTML = "";
      loadingIndicator.style.display = "flex";
      fetchRendererData(username)
        .then(function (data) {
          var roblox = data && data.roblox ? data.roblox : {};
          var rolimons = data && data.rolimons ? data.rolimons : {};
          var oldAvatars = Array.isArray(roblox.oldAvatars) ? roblox.oldAvatars : [];
          var imageUrls = [];
          var i;

          if (roblox.avatarUrl) {
            imageUrls.push(roblox.avatarUrl);
          }

          var pastNames = "Loading…";
          var terminated = "";
          var html =
            '<div class="info-box">' +
              '<div class="avatar-container">' +
                '<a href="https://www.roblox.com/users/' + encodeURIComponent(text(roblox.id)) + '/profile" target="_blank" rel="noopener noreferrer">' +
                  '<img src="' + escapeHtml(roblox.avatarUrl || "") + '" alt="" loading="eager" decoding="async">' +
                '</a>' +
              '</div>' +
              '<div id="terminationLine"></div>' +
              '<div class="info-line rendererName"><b>' +
                escapeHtml(roblox.displayName || "") +
                '</b> [' +
                escapeHtml(roblox.username || username) +
                ']</div>' +
              '<div class="info-line"><b>User ID:</b> ' + escapeHtml(roblox.id) + '</div>' +
              '<div id="pastUsernamesLine" class="info-line"><b>Past usernames:</b> Loading…</div>' +
              '<div class="info-line"><b>Joined:</b> ' + escapeHtml(roblox.joinDate || "Unknown") + '</div>' +
              '<div id="lastOnlineLine" class="info-line"><b>Last Online:</b> Loading…</div>' +
              '<div id="valueLine" class="info-line"><b>RAP:</b> Loading… &nbsp;&nbsp; <b>Value:</b> Loading…</div>' +
              '<div id="oldAvatars"></div>' +
            '</div>';

          centerPanel.innerHTML = html;
          loadingIndicator.style.display = "none";

          function renderArchivedAvatars(archived) {
            var oldContainer = document.getElementById("oldAvatars");
            if (!oldContainer) return;
            oldContainer.innerHTML = "";
            if (!archived.length) {
              oldContainer.textContent = "No archived renders.";
              return;
            }
            var shown = 0;
            var more = null;
            function addPage() {
              var end = Math.min(shown + OLD_AVATAR_PAGE_SIZE, archived.length);
              var k;
              for (k = shown; k < end; k += 1) {
                if (archived[k] && (archived[k].url || archived[k].wayback)) {
                  var thumb = document.createElement("img");
                  thumb.src = archived[k].url || archived[k].wayback;
                  thumb.alt = "";
                  thumb.loading = "lazy";
                  thumb.decoding = "async";
                  thumb.className = "old-avatar-thumb";
                  thumb.title = "Open archived avatar";
                  (function (node) {
                    node.addEventListener("error", function () { node.style.display = "none"; });
                    node.addEventListener("click", function () {
                      window.open(node.src, "_blank", "noopener,noreferrer");
                    });
                  })(thumb);
                  if (more) oldContainer.insertBefore(thumb, more);
                  else oldContainer.appendChild(thumb);
                }
              }
              shown = end;
              if (more) {
                if (shown >= archived.length) more.remove();
                else more.textContent = "Load more archived renders (" + (archived.length - shown) + " more)";
              }
            }
            addPage();
            if (archived.length > shown) {
              more = document.createElement("button");
              more.type = "button";
              more.textContent = "Load more archived renders (" + (archived.length - shown) + " more)";
              more.style.marginTop = "8px";
              more.style.cursor = "pointer";
              more.addEventListener("click", addPage);
              oldContainer.appendChild(more);
            }
          }

          function waybackImage(stamp, url) {
            if (!stamp || !url) return "";
            return "https://web.archive.org/web/" + stamp + "im_/" + url;
          }

          function fetchArchivedAvatars(userId) {
            var id = text(userId).trim();
            var numeric = Math.abs(parseInt(id, 10));
            if (!id || !isFinite(numeric)) return Promise.resolve([]);
            var shard = numeric % ARCHIVE_SHARDS;
            return fetch("/avatar-history/s" + shard + ".txt?v=20261007c", { cache: "force-cache" })
              .then(function (response) {
                if (!response.ok) return "";
                return response.text();
              })
              .then(function (body) {
                if (!body) return [];
                var lines = body.split("\n");
                var prefix = id + "\t";
                var archived = [];
                var seen = {};
                var i;
                for (i = 0; i < lines.length; i += 1) {
                  if (lines[i].indexOf(prefix) !== 0) continue;
                  var parts = lines[i].split("\t");
                  var p;
                  for (p = 1; p + 1 < parts.length; p += 2) {
                    var wb = waybackImage(parts[p], parts[p + 1]);
                    if (!wb || seen[wb]) continue;
                    seen[wb] = 1;
                    archived.push({ wayback: wb });
                  }
                }
                archived.sort(function (a, b) {
                  return a.wayback < b.wayback ? -1 : a.wayback > b.wayback ? 1 : 0;
                });
                return archived;
              })
              .catch(function () { return []; });
          }

          var oldContainer = document.getElementById("oldAvatars");
          if (oldContainer) oldContainer.textContent = "Loading archived renders…";
          fetchArchivedAvatars(roblox.id).then(function (archived) {
            var fromApi = oldAvatars.filter(function (item) {
              return item && (item.url || item.wayback);
            });
            var seen = {};
            var merged = [];
            var n;
            for (n = 0; n < fromApi.length; n += 1) {
              var fromApiUrl = fromApi[n].url || fromApi[n].wayback;
              if (!seen[fromApiUrl]) {
                seen[fromApiUrl] = 1;
                merged.push(fromApi[n]);
              }
            }
            for (n = 0; n < archived.length; n += 1) {
              var archivedUrl = archived[n].url || archived[n].wayback;
              if (!seen[archivedUrl]) {
                seen[archivedUrl] = 1;
                merged.push(archived[n]);
              }
            }
            renderArchivedAvatars(merged);
          });

          fetch(API_BASE + "/proxy-roblox-details?userId=" + encodeURIComponent(text(roblox.id)), {
            headers: { "Accept": "application/json" },
            cache: "default"
          }).then(function (response) {
            if (!response.ok) throw new Error("Details HTTP " + response.status);
            return response.json();
          }).then(function (details) {
            var detailRobli = details && details.rolimons ? details.rolimons : {};
            var names = Array.isArray(details && details.pastUsernames) && details.pastUsernames.length
              ? details.pastUsernames.join(", ")
              : "None";
            var pastLine = document.getElementById("pastUsernamesLine");
            var lastLine = document.getElementById("lastOnlineLine");
            var valueLine = document.getElementById("valueLine");
            var terminationLine = document.getElementById("terminationLine");
            if (pastLine) pastLine.innerHTML = "<b>Past usernames:</b> " + escapeHtml(names);
            if (lastLine) lastLine.innerHTML = "<b>Last Online:</b> " + escapeHtml(detailRobli.lastOnline || "Unknown");
            if (valueLine) valueLine.innerHTML = "<b>RAP:</b> " + escapeHtml(detailRobli.rap || "Unknown") +
              " &nbsp;&nbsp; <b>Value:</b> " + escapeHtml(detailRobli.value || "Unknown");
            if (terminationLine && detailRobli.terminated) {
              terminationLine.innerHTML = '<p class="rendererTermination">Terminated</p>';
            }
          }).catch(function () {
            var pastLine = document.getElementById("pastUsernamesLine");
            var lastLine = document.getElementById("lastOnlineLine");
            var valueLine = document.getElementById("valueLine");
            if (pastLine) pastLine.innerHTML = "<b>Past usernames:</b> Unavailable";
            if (lastLine) lastLine.innerHTML = "<b>Last Online:</b> Unavailable";
            if (valueLine) valueLine.innerHTML = "<b>RAP:</b> Unavailable &nbsp;&nbsp; <b>Value:</b> Unavailable";
          });
        })
        .catch(function (error) {
          // Expected lookup failures are shown in the renderer UI; keep the browser console clean.
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