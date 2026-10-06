import React from "react";

// Winamp-style shoegaze converter. The page lives in public/shoegaze/index.html.
function Shoegaze({ isFocus }) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#0b0b10" }}>
      <iframe
        title="shoegazefier"
        src="/shoegaze/"
        style={{ width: "100%", height: "100%", border: 0, display: "block" }}
      />
      {/* unfocused window: catch the first click so the window focuses/drags normally */}
      {!isFocus && <div style={{ position: "absolute", inset: 0 }} />}
    </div>
  );
}

export default Shoegaze;
