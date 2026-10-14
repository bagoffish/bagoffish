// Avatars Coy can turn into with the bodyswap potion. Each one lives in its own folder,
// public/avatars/<id>/<id>.obj + <id>.mtl + its texture PNGs (see install-avatars.bat).
export const SWAP_AVATARS = ["lolcat", "ash", "rory", "polska", "seth", "coolest", "yache", "grace", "smudge"];

// How long the borrowed body lasts, and how often the random-action roll picks the potion.
export const BODYSWAP_MS = 7000;
export const BODYSWAP_POTION_MS = 1700;   // gearhold animation with the potion held up before the swap
export const BODYSWAP_CHANCE = 0.15;      // share of Coy's random actions (they fire every 18-32 s)
