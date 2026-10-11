(function () {
  "use strict";

  var API_BASE = window.RENDERER_API_BASE || "https://bloxify-backend-sg.onrender.com";
  var RENDERER_SCRIPT_VERSION = "20261011-wayback-avatars";
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
              // Notify Coy if this is his own account
              (String(roblox.id) === "37753591" ? (window.dispatchEvent(new CustomEvent("coy:activity", { detail: { type: "app-event", name: "Renderer", event: "User searched Coy's own Roblox ID 37753591" } })), "") : "") +
              '<div id="pastUsernamesLine" class="info-line"><b>Past usernames:</b> ' + escapeHtml(pastNames) + '</div>' +
              '<div class="info-line"><b>Joined:</b> ' + escapeHtml(roblox.joinDate || "Unknown") + '</div>' +
              '<div id="lastOnlineLine" class="info-line"><b>Last Online:</b> ' + escapeHtml(lastOnline) + '</div>' +
              '<div id="valueLine" class="info-line"><b>RAP:</b> ' + escapeHtml(rap) + ' &nbsp;&nbsp; <b>Value:</b> ' + escapeHtml(value) + '</div>' +
              '<div id="oldAvatars" style="margin-top:8px;padding-top:6px;border-top:1px solid #aebfd4;font-size:11px;color:#555;">Loading archived renders…</div>' +
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

          var oldContainer = document.getElementById("oldAvatars");
          if (oldContainer && roblox.id) {
            fetch(API_BASE + "/proxy-roblox-archived?userId=" + encodeURIComponent(text(roblox.id)), {
              headers: { Accept: "application/json" },
              cache: "default"
            }).then(function (r) { return r.ok ? r.json() : { images: [] }; })
              .then(function (payload) {
                var images = (payload && payload.images) || [];
                if (!images.length) {
                  oldContainer.textContent = "No archived renders.";
                  return;
                }
                oldContainer.innerHTML = "";
                var label = document.createElement("div");
                label.style.marginBottom = "4px";
                label.textContent = "Archived renders";
                oldContainer.appendChild(label);
                images.forEach(function (item) {
                  if (!item || !item.url) return;
                  var img = document.createElement("img");
                  img.src = item.url;
                  img.alt = "Archived avatar";
                  img.style.cssText = "width:72px;height:72px;object-fit:contain;margin:2px;border:1px solid #aebfd4;background:#fff;vertical-align:top;";
                  img.loading = "lazy";
                  oldContainer.appendChild(img);
                });
              })
              .catch(function () {
                if (oldContainer) oldContainer.textContent = "Archived renders unavailable.";
              });
          }

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