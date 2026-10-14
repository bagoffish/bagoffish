import React, { lazy, Suspense } from "react";
import AboutMe from "./AboutMe";
const Renderer = lazyApp(() => import("./Renderer"));
import ErrorBox from "./ErrorBox";
const Paint = lazyApp(() => import("./Paint"));
const Minesweeper = lazyApp(() => import("./Minesweeper"));
const Poems = lazyApp(() => import("./Poems"));
import Winamp from "./Winamp";
const Bloxify = lazyApp(() => import("./MusicAI"));

/* ===== icons ===== */
import iePaper from "assets/windowsIcons/ie-paper.png";
import winamp from "assets/windowsIcons/winamp.png";
import musicIcon from "assets/windowsIcons/550(32x32).png";
import error from "assets/windowsIcons/897(16x16).png";
import paintLarge from "assets/windowsIcons/680(32x32).png";
import paintSmall from "assets/windowsIcons/680(16x16).png";
import minesweeperIcon from "assets/windowsIcons/spider.png";

/* icons for custom apps */
import poemsIcon from "assets/windowsIcons/327(32x32).png";
import poemsIconSmall from "assets/windowsIcons/327(16x16).png";
import socialsIcon from "assets/windowsIcons/ie.png";
import socialsIconSmall from "assets/windowsIcons/ie-paper.png";
import winterLetterIcon from "assets/windowsIcons/mail.png";
import coyChatIcon from "assets/windowsIcons/at.png";
import RendererIcon from "assets/windowsIcons/299(32x32).png";

// Heavy apps are loaded only when opened. This keeps the XP desktop fast
// without changing how the window manager invokes app components.
function lazyApp(loader) {
  const LazyComponent = lazy(loader);
  return function LazyApp(props) {
    return (
      <Suspense fallback={<div style={{ padding: 16, fontFamily: 'Tahoma, sans-serif', fontSize: 12 }}>Loading…</div>}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

const WinterLetter = lazyApp(() => import("./WinterLetter"));
const CoyChat = lazyApp(() => import("./Coy"));

import RendererIconSmall from "assets/windowsIcons/299(32x32).png";

const gen = () => {
  let id = -1;
  return () => {
    id += 1;
    return id;
  };
};

const genId = gen();
const genIndex = gen();

/* windows that spawn by default on load */
export const defaultAppState = [
  {
    component: AboutMe,
    header: { title: "About Me", icon: socialsIcon },
    defaultSize: { width: 700, height: 500 },
    defaultOffset: { x: 130, y: 20 },
    resizable: true,
    minimized: false,
    maximized: window.innerWidth < 800,
    id: genId(),
    zIndex: genIndex(),
  },
];

/* desktop icons */
export const defaultIconState = [
  { id: 0, icon: socialsIcon, title: "About Me", component: AboutMe, isFocus: false },
  { id: 2, icon: poemsIcon, title: "Poems", component: Poems, isFocus: false },
  { id: 3, icon: RendererIcon, title: "Renderer", component: Renderer, isFocus: false },
  { id: 7, icon: musicIcon, title: "Bloxify", component: Bloxify, isFocus: false },
  { id: 9, icon: winterLetterIcon, title: "Winter_Letter", component: WinterLetter, isFocus: false },
  { id: 5, icon: paintLarge, title: "Paint", component: Paint, isFocus: false },
  { id: 6, icon: winamp, title: "Winamp", component: Winamp, isFocus: false },
  { id: 10, icon: minesweeperIcon, title: "Minesweeper", component: Minesweeper, isFocus: false },
];

/* start menu / openApp settings */
export const appSettings = {
  Coy: {
    header: { icon: coyChatIcon, title: "Coy", buttons: ["minimize", "maximize", "close"] },
    component: CoyChat,
    defaultSize: { width: 500, height: 520 },
    defaultOffset: { x: 180, y: 45 },
    resizable: true,
    minimized: false,
    maximized: window.innerWidth < 800,
    multiInstance: false,
  },

  Winter_Letter: {
    header: { icon: winterLetterIcon, title: "Winter_Letter" },
    component: WinterLetter,
    defaultSize: { width: 760, height: 520 },
    defaultOffset: { x: 100, y: 45 },
    resizable: true,
    minimized: false,
    maximized: window.innerWidth < 800,
    multiInstance: false,
  },

  "About Me": {
    header: { icon: socialsIconSmall, title: "About Me" },
    component: AboutMe,
    defaultSize: { width: 700, height: 500 },
    defaultOffset: { x: 140, y: 30 },
    resizable: true,
    minimized: false,
    maximized: window.innerWidth < 800,
    multiInstance: false,
  },

  Poems: {
    header: { icon: poemsIconSmall, title: "Poems" },
    component: Poems,
    defaultSize: { width: 660, height: 520 },
    defaultOffset: { x: 160, y: 60 },
    resizable: true,
    minimized: false,
    maximized: window.innerWidth < 800,
    multiInstance: false,
  },

  Renderer: {
    header: { icon: RendererIconSmall, title: "Renderer" },
    component: Renderer,
    defaultSize: { width: 660, height: 600 },
    defaultOffset: { x: 210, y: 90 },
    resizable: true,
    minimized: false,
    maximized: window.innerWidth < 800,
    multiInstance: false,
  },

  Bloxify: {
    header: { icon: musicIcon, title: "Bloxify" },
    component: Bloxify,
    defaultSize: { width: 800, height: 520 },
    defaultOffset: { x: 220, y: 70 },
    resizable: true,
    minimized: false,
    maximized: window.innerWidth < 800,
    multiInstance: false,
  },

  Error: {
    header: { icon: error, title: "C:\\", buttons: ["close"], noFooterWindow: true },
    component: ErrorBox,
    defaultSize: { width: 380, height: 0 },
    defaultOffset: { x: window.innerWidth / 2 - 190, y: window.innerHeight / 2 - 60 },
    resizable: false,
    minimized: false,
    maximized: false,
    multiInstance: false,
  },

  Minesweeper: {
    header: { icon: minesweeperIcon, title: "Minesweeper" },
    component: Minesweeper,
    defaultSize: { width: 340, height: 430 },
    defaultOffset: { x: 260, y: 80 },
    resizable: false,
    minimized: false,
    maximized: false,
    multiInstance: false,
  },

  Paint: {
    header: { icon: paintSmall, title: "Untitled - Paint" },
    component: Paint,
    defaultSize: { width: 660, height: 500 },
    defaultOffset: { x: 280, y: 70 },
    resizable: true,
    minimized: false,
    maximized: window.innerWidth < 800,
    multiInstance: false,
  },

  Winamp: {
    header: { icon: winamp, title: "Winamp", invisible: true },
    component: Winamp,
    defaultSize: { width: 0, height: 0 },
    defaultOffset: { x: 0, y: 0 },
    resizable: false,
    minimized: false,
    maximized: false,
    multiInstance: false,
  },
};

export {
  AboutMe,
  Poems,
  Renderer,
  ErrorBox,
  Paint,
  Minesweeper,
  Winamp,
  Bloxify,
  WinterLetter,
};
