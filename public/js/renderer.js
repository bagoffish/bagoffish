(function () {
  "use strict";

  var API_BASE = window.RENDERER_API_BASE || "https://winxp-7yes.onrender.com";
  var RETRY_LIMIT = 60;

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

    function fetchRobloxDirect(username) {
      return fetch("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
      })
        .then(function (response) {
          if (!response.ok) throw new Error("Roblox HTTP " + response.status);
          return response.json();
        })
        .then(function (userResult) {
          var user = userResult && userResult.data && userResult.data[0];
          if (!user || !user.id) throw new Error("User not found");

          return Promise.all([
            fetch("https://users.roblox.com/v1/users/" + encodeURIComponent(user.id)).then(function (r) {
              if (!r.ok) throw new Error("Profile HTTP " + r.status);
              return r.json();
            }),
            fetch("https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=" + encodeURIComponent(user.id) + "&size=180x180&format=Png").then(function (r) {
              if (!r.ok) throw new Error("Thumbnail HTTP " + r.status);
              return r.json();
            })
          ]).then(function (parts) {
            return {
              roblox: {
                id: user.id,
                username: parts[0].name || user.name || username,
                displayName: parts[0].displayName || user.displayName || user.name || username,
                joinDate: parts[0].created ? new Date(parts[0].created).toUTCString().replace(" GMT", "") : "Unknown",
                avatarUrl: parts[1] && parts[1].data && parts[1].data[0] ? parts[1].data[0].imageUrl : "",
                oldAvatars: [],
                pastUsernames: []
              },
              rolimons: {}
            };
          });
        });
    }

    function fetchRendererData(username) {
      // Direct Roblox APIs are the primary path, so a sleeping/broken Render
      // instance cannot break the renderer or flood the console with CORS errors.
      return fetchRobloxDirect(username).catch(function (directError) {
        return fetch(API_BASE + "/proxy-roblox?username=" + encodeURIComponent(username), {
          headers: { "Accept": "application/json" }
        }).then(function (response) {
          if (!response.ok) throw new Error("Backend HTTP " + response.status);
          return response.json();
        }).catch(function (backendError) {
          throw directError || backendError;
        });
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
          showError(
            error && error.message && error.message.indexOf("Failed to fetch") !== -1
              ? "Renderer service unavailable. Try again in a moment."
              : "User not found (◞‸◟；)"
          );
        });
    });

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