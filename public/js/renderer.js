(function () {
  "use strict";

  var API_BASE = "https://bagoffish-f4qd.onrender.com";
  var RETRY_LIMIT = 100;

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

    return Promise.all(unique.map(function (src) {
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

    if (!usernameInput || !checkBtn || !messageBox ||
        !loadingIndicator || !spinner || !centerPanel) {
      return false;
    }

    if (checkBtn.getAttribute("data-renderer-bound") === "1") {
      return true;
    }

    checkBtn.setAttribute("data-renderer-bound", "1");

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

    checkBtn.addEventListener("click", function () {
      var username = usernameInput.value.trim();

      if (!username) {
        centerPanel.innerHTML = "";
        showError("Enter a username, dumbass!");
        return;
      }

      messageBox.style.display = "none";
      centerPanel.innerHTML = "";
      loadingIndicator.style.display = "flex";

      fetch(API_BASE + "/proxy-roblox?username=" + encodeURIComponent(username), {
        credentials: "include",
        headers: {
          "Accept": "application/json"
        }
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error("HTTP " + response.status);
          }
          return response.json();
        })
        .then(function (data) {
          var roblox = data && data.roblox ? data.roblox : {};
          var rolimons = data && data.rolimons ? data.rolimons : {};
          var oldAvatars = Array.isArray(roblox.oldAvatars) ? roblox.oldAvatars : [];
          var imageUrls = [];
          var i;

          if (roblox.avatarUrl) {
            imageUrls.push(roblox.avatarUrl);
          }

          for (i = 0; i < oldAvatars.length; i += 1) {
            if (oldAvatars[i] && oldAvatars[i].wayback) {
              imageUrls.push(oldAvatars[i].wayback);
            }
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

            var oldContainer = document.getElementById("oldAvatars");
            if (oldContainer) {
              for (i = 0; i < oldAvatars.length; i += 1) {
                if (!oldAvatars[i] || !oldAvatars[i].wayback) {
                  continue;
                }

                var thumb = document.createElement("img");
                thumb.src = oldAvatars[i].wayback;
                thumb.alt = "";
                thumb.loading = "eager";
                thumb.className = "old-avatar-thumb";
                thumb.title = "Open archived avatar";
                (function (url) {
                  thumb.addEventListener("click", function () {
                    window.open(url, "_blank", "noopener,noreferrer");
                  });
                }(oldAvatars[i].wayback));
                oldContainer.appendChild(thumb);
              }
            }

            loadingIndicator.style.display = "none";
          });
        })
        .catch(function (error) {
          console.error("Renderer request failed:", error);
          showError("User not found (◞‸◟；)");
        });
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