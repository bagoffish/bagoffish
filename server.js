// Render backend entrypoint. The API implementation lives in ./backend/server.js.
// A static import makes Node warn, because the site package.json has no
// "type": "module". Dynamic import keeps this file CommonJS.
import("./backend/server.js").catch((error) => {
  console.error(error);
  process.exit(1);
});
