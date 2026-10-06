(function () {
  // Use your Render backend (works right now)
  const API_BASE = "https://bagoffish-f4qd.onrender.com";

  function initRenderer() {
    const usernameInput = document.getElementById("usernameInput");
    const checkBtn = document.getElementById("checkBtn");
    const messageBox = document.getElementById("messageBox");
    const loadingIndicator = document.getElementById("loadingIndicator");
    const spinner = document.getElementById("spinner");
    const centerPanel = document.getElementById("centerPanel");

    if (!usernameInput || !checkBtn || !messageBox || !loadingIndicator || !spinner || !centerPanel) {
      return false;
    }

    // prevent double bind if window reopened
    if (checkBtn.dataset.bound === "1") return true;
    checkBtn.dataset.bound = "1";

    /* Spinner animation */
    const frames = ["-", "/", "|", "\\"];
    let fi = 0;

    const spinTimer = setInterval(() => {
      if (loadingIndicator.style.display === "flex") {
        spinner.textContent = frames[fi++ % frames.length];
      }
    }, 120);

    // clean up intervals if this app is removed from DOM
    const cleanupTimer = setInterval(() => {
      if (!document.body.contains(checkBtn)) {
        clearInterval(spinTimer);
        clearInterval(cleanupTimer);
      }
    }, 1000);

    function shakeError() {
      messageBox.classList.add("shake");
      setTimeout(() => messageBox.classList.remove("shake"), 500);
    }

    // Preload a list of image URLs in parallel and resolve once every
    // image has either loaded or failed. Browser caches the decoded
    // image, so injecting the same <img src="..."> afterwards renders
    // instantly instead of triggering a fresh (slow, sequential) fetch.
    function preloadImages(urls) {
      const unique = [...new Set(urls.filter(Boolean))];
      return Promise.all(
        unique.map(
          (src) =>
            new Promise((resolve) => {
              const img = new Image();
              img.decoding = "async";
              img.onload = () => resolve(src);
              img.onerror = () => resolve(src);
              img.src = src;
            })
        )
      );
    }

    usernameInput.addEventListener("input", () => {
      messageBox.style.display = "none";
      messageBox.textContent = "";
    });

    checkBtn.addEventListener("click", async () => {
      const username = usernameInput.value.trim();

      if (!username) {
        messageBox.textContent = "Enter a username, dumbass!";
        messageBox.style.display = "flex";
        shakeError();
        centerPanel.innerHTML = "";
        return;
      }

      messageBox.style.display = "none";
      centerPanel.innerHTML = "";
      loadingIndicator.style.display = "flex";

      try {
        const res = await fetch(`${API_BASE}/proxy-roblox?username=${encodeURIComponent(username)}`, {\n          credentials: "include",\n        });
        if (!res.ok) throw new Error("User not found");

        const data = await res.json();
        const roblox = data.roblox;
        const rolimons = data.rolimons || {};

        const oldAvatars = Array.isArray(roblox.oldAvatars) ? roblox.oldAvatars : [];

        // Kick off every image fetch at once (current avatar + all old
        // avatars) instead of letting the browser discover them one by
        // one as innerHTML is parsed. By the time we render, they're
        // already sitting in the browser's image cache.
        const imageUrls = [roblox.avatarUrl, ...oldAvatars.map((img) => img.wayback)];
        await preloadImages(imageUrls);

        const terminationText = rolimons.terminated
          ? `<p style="color:#c75050;font-weight:bold;margin:6px 0;">TERMINATED ACCOUNT</p>`
          : "";

        const pastNames =
          Array.isArray(roblox.pastUsernames) && roblox.pastUsernames.length
            ? roblox.pastUsernames.join(", ")
            : "None";

        centerPanel.innerHTML = `
          <div class="info-box">
            <div class="avatar-container">
              <a href="https://www.roblox.com/users/${roblox.id}/profile" target="_blank" rel="noopener">
                <img src="${roblox.avatarUrl || ""}" alt="" loading="eager" decoding="async">
              </a>
            </div>

            <div class="info-line" style="font-weight:bold;font-size:16px">
              ${roblox.displayName} [${roblox.username}]
            </div>

            ${terminationText}

            <div class="info-line"><b>User ID:</b> ${roblox.id}</div>
            <div class="info-line"><b>Past usernames:</b> ${pastNames}</div>
            <div class="info-line"><b>Joined:</b> ${roblox.joinDate}</div>
            <div class="info-line"><b>Last Online:</b> ${rolimons.lastOnline ?? "Unknown"}</div>
            <div class="info-line">
              <b>RAP:</b> ${rolimons.rap ?? "Unknown"} &nbsp;&nbsp;
              <b>Value:</b> ${rolimons.value ?? "Unknown"}
            </div>

            <div id="oldAvatars"></div>
          </div>
        `;

        const oldAvatarsContainer = document.getElementById("oldAvatars");
        if (oldAvatarsContainer) oldAvatarsContainer.innerHTML = "";

        if (oldAvatars.length && oldAvatarsContainer) {
          oldAvatars.forEach((img) => {
            const thumb = document.createElement("img");
            thumb.src = img.wayback;
            thumb.loading = "eager";
            thumb.decoding = "async";
            thumb.className = "old-avatar-thumb";
            thumb.onclick = () => window.open(img.wayback, "_blank", "noopener,noreferrer");
            oldAvatarsContainer.appendChild(thumb);
          });
        }

        loadingIndicator.style.display = "none";
      } catch (err) {
        loadingIndicator.style.display = "none";
        messageBox.textContent = "User not found (◞‸◟；)";
        messageBox.style.display = "flex";
        shakeError();
      }
    });

    return true;
  }

  // React mount timing: retry until the Renderer app DOM exists
  let tries = 0;
  const t = setInterval(() => {
    tries += 1;
    if (initRenderer() || tries > 80) clearInterval(t);
  }, 100);
})();
