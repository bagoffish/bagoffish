(function () {
  "use strict";

  var API_BASE = window.RENDERER_API_BASE || "https://winxp-backend-live.onrender.com";
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

  function preloadImages(urls) {
    var unique = [];
    var seen = {};
    var i;

    for (i = 0; i < urls.length; i += 1) {
      if (urls[i] && !seen[urls[i]]) {
        seen[urls[i]] = true;
        unique.push(urls[i]);
      }
    }

    return Promise.all(unique.slice(0, 2).map(function (src) {
      return new Promise(function (resolve) {
        var image = new Image();
        image.onload = function () { resolve(src); };
        image.onerror = function () { resolve(src); };
        image.src = src;
      });
    }));
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
    var elapsedTimer = null;
    var renderStartedAt = 0;
    var spinTimer = setInterval(function () {
      if (loadingIndicator.style.display === "flex") {
        spinner.textContent = frames[frameIndex % frames.length];
        frameIndex += 1;
      }
    }, 120);

    function stopElapsedTimer() {
      if (elapsedTimer) {
        clearInterval(elapsedTimer);
        elapsedTimer = null;
      }
    }

    function updateElapsedTime() {
      var elapsed = Math.max(0, Math.floor((Date.now() - renderStartedAt) / 1000));
      var elapsedNode = document.getElementById("renderElapsedTime");
      if (elapsedNode) elapsedNode.textContent = elapsed + "s";
    }

    function startElapsedTimer() {
      stopElapsedTimer();
      renderStartedAt = Date.now();
      updateElapsedTime();
      elapsedTimer = setInterval(updateElapsedTime, 1000);
    }

    function cleanup() {
      clearInterval(spinTimer);
      stopElapsedTimer();
    }

    function showError(message) {
      loadingIndicator.style.display = "none";
      stopElapsedTimer();
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
        cache: "default"
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
      startElapsedTimer();

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

          return preloadImages(imageUrls).then(function () {
            var pastNames = Array.isArray(roblox.pastUsernames) && roblox.pastUsernames.length
              ? roblox.pastUsernames.join(", ")
              : "None";

            var terminated = rolimons.terminated
              ? '<p class="rendererTermination">TERMINATED ACCOUNT</p>'
              : "";

            var html =
              '<div class="info-box">' +
                '<div class="avatar-container">' +
                  '<a href="https://www.roblox.com/users/' + encodeURIComponent(text(roblox.id)) + '/profile" target="_blank" rel="noopener noreferrer">' +
                    '<img src="' + escapeHtml(roblox.avatarUrl || "") + '" alt="" loading="eager">' +
                  '</a>' +
                '</div>' +
                '<div class="info-line rendererName"><b>' +
                  escapeHtml(roblox.displayName || "") +
                  '</b> [' +
                  escapeHtml(roblox.username || username) +
                  ']</div>' +
                terminated +
                '<div class="info-line"><b>User ID:</b> ' + escapeHtml(roblox.id) + '</div>' +
                '<div class="info-line"><b>Past usernames:</b> ' + escapeHtml(pastNames) + '</div>' +
                '<div class="info-line"><b>Joined:</b> ' + escapeHtml(roblox.joinDate || "Unknown") + '</div>' +
                '<div class="info-line"><b>Last Online:</b> ' + escapeHtml(rolimons.lastOnline || "Unknown") + '</div>' +
                '<div class="info-line"><b>RAP:</b> ' + escapeHtml(rolimons.rap || "Unknown") +
                  ' &nbsp;&nbsp; <b>Value:</b> ' + escapeHtml(rolimons.value || "Unknown") + '</div>' +
                '<div id="oldAvatars"></div>' +
              '</div>';

            centerPanel.innerHTML = html;

            function appendOldAvatar(container, url) {
              if (!url) return;
              var thumb = document.createElement("img");
              thumb.src = url;
              thumb.alt = "";
              thumb.loading = "lazy";
              thumb.decoding = "async";
              thumb.className = "old-avatar-thumb";
              thumb.title = "Open archived avatar";
              thumb.addEventListener("error", function () { thumb.style.display = "none"; });
              thumb.addEventListener("click", function () {
                window.open(url, "_blank", "noopener,noreferrer");
              });
              container.appendChild(thumb);
            }

            var oldContainer = document.getElementById("oldAvatars");
            if (oldContainer) {
              for (i = 0; i < oldAvatars.length; i += 1) {
                if (!oldAvatars[i] || !oldAvatars[i].wayback) {
                  continue;
                }

                if (i >= OLD_AVATAR_PAGE_SIZE) break;
                appendOldAvatar(oldContainer, oldAvatars[i].wayback);
              }
              if (oldAvatars.length > OLD_AVATAR_PAGE_SIZE) {
                var more = document.createElement("button");
                more.type = "button";
                more.textContent = "Load more archived renders (" + (oldAvatars.length - OLD_AVATAR_PAGE_SIZE) + " more)";
                more.style.marginTop = "8px";
                more.style.cursor = "pointer";
                var shown = OLD_AVATAR_PAGE_SIZE;
                more.addEventListener("click", function () {
                  var end = Math.min(shown + OLD_AVATAR_PAGE_SIZE, oldAvatars.length);
                  for (var j = shown; j < end; j += 1) appendOldAvatar(oldContainer, oldAvatars[j].wayback);
                  shown = end;
                  if (shown >= oldAvatars.length) more.remove();
                  else more.textContent = "Load more archived renders (" + (oldAvatars.length - shown) + " more)";
                });
                oldContainer.appendChild(more);
              }
            }

            loadingIndicator.style.display = "none";
            stopElapsedTimer();
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