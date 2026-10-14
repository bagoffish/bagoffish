// Shared styling for the 2013-era Roblox dialog bubbles (NPC speech + choice boxes).
//
// Everything is sized in `em`, so a bubble scales with the font-size you give its
// container. The proportions were measured from the reference screenshots:
//   - texture 9-slice: 16px of the 96px bkg texture is border (glow + ring + inner fade)
//   - border thickness  = 0.4em      (16px at a 40px font)
//   - text padding      = 0.15em / 0.35em  (vertical / horizontal)
//   - line height       = 1.125em
//   - side tail         = 2.17em x 1.85em, overlapping the box edge by 0.43em
//   - overhead tail     = 2.7em square, centred under the box
// Set `fontSize` on the element (or a parent) to scale the whole bubble.

export const ROBLOX_DIALOG_BASE =
  (process.env.PUBLIC_URL || "").replace(/\/$/, "") + "/images/roblox-dialog/";

// Roblox's UI font. Loaded in assets/font.css; falls back to Arial if it can't load.
export const ROBLOX_FONT = "'Source Sans 3', 'Source Sans Pro', 'SourceSansPro', Arial, Helvetica, sans-serif";

const TEXTURES = {
  green: {
    bkg: "chatBubble_botGreen_bkg.png",
    tailDown: "chatBubble_botGreen_tail.png",
    tailSide: "chatBubble_botGreen_tailRight.png",
  },
  red: {
    bkg: "chatBubble_botRed_bkg.png",
    // The original package has no downward red tail, only the side one.
    tailDown: "chatBubble_botGreen_tail.png",
    tailSide: "chatBubble_botRed_tailRight.png",
  },
};

export const robloxTexture = (variant, part) =>
  ROBLOX_DIALOG_BASE + (TEXTURES[variant] || TEXTURES.green)[part];

// The rounded, glowing box. Deliberately has NO `background`: the texture's own
// "fill" paints the dark centre, and a background colour would show up as a
// square behind the rounded glow corners.
export function robloxBoxStyle(variant = "green") {
  return {
    position: "relative",
    boxSizing: "border-box",
    border: "0.4em solid transparent",
    borderImageSource: `url(${robloxTexture(variant, "bkg")})`,
    borderImageSlice: "16 fill",
    borderImageWidth: "0.4em",
    borderImageRepeat: "stretch",
    padding: "0.15em 0.35em",
    color: "#fff",
    fontFamily: ROBLOX_FONT,
    fontWeight: 400,
    lineHeight: 1.125,
    textShadow: "none",
    zIndex: 1,
  };
}

// Lightning-bolt tail on the side of a box (used by the chat window).
// side: "right" points right (original texture); "left" mirrors it.
export function robloxSideTailStyle(side = "right") {
  const base = {
    position: "absolute",
    top: "calc(50% - 0.1em)",
    width: "2.17em",
    height: "1.85em",
    pointerEvents: "none",
    zIndex: 2,
  };
  return side === "left"
    ? { ...base, right: "calc(100% - 0.43em)", transform: "translateY(-50%) scaleX(-1)" }
    : { ...base, left: "calc(100% - 0.43em)", transform: "translateY(-50%)" };
}

// Lightning-bolt tail hanging below an overhead speech bubble.
// The first ~12 rows of the tail texture are a copy of the box's bottom border (fade, bright
// ring, glow), with the ring opened up over the dark fill. To look seamless the tail has to
// (a) start exactly where the box's bottom border starts, i.e. 0.4em above the bottom edge, and
// (b) be drawn at the same pixel scale as that border (0.4em / 16px = 0.025em per texel; 0.031
// em/texel for the tail keeps its ring within a texel of the box ring). The old 2.7em / 0.15em
// overlap left the box's own bright ring running straight across the tail's opening.
export function robloxDownTailStyle() {
  return {
    position: "absolute",
    top: "calc(100% - 0.4em)",
    left: "50%",
    width: "2em",
    height: "2em",
    transform: "translateX(-50%)",
    pointerEvents: "none",
    zIndex: 2,
  };
}
