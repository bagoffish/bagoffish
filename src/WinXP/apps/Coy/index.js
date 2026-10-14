// The Coy desktop window lazy-loads this module as its app component.
// Re-export the actual chat app instead of leaving a placeholder module,
// which has no default React component and can render as a blank window.
export { default } from "../PersonalAI";
