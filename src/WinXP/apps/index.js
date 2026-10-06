import AboutMe from "./AboutMe";
import Renderer from "./Renderer";
import ErrorBox from "./ErrorBox";
import Minesweeper from "./Minesweeper";
import Paint from "./Paint";
import Poems from "./Poems";
import Socials from "./Socials";
import Winamp from "./Winamp";

/* ===== icons ===== */
import iePaper from "assets/windowsIcons/ie-paper.png";
import mine from "assets/minesweeper/mine-icon.png";
import winamp from "assets/windowsIcons/winamp.png";
import error from "assets/windowsIcons/897(16x16).png";
import paintLarge from "assets/windowsIcons/680(32x32).png";
import paintSmall from "assets/windowsIcons/680(16x16).png";

/* placeholders for your custom apps */
import poemsIcon from "assets/windowsIcons/327(32x32).png";
import poemsIconSmall from "assets/windowsIcons/327(16x16).png";
import socialsIcon from "assets/windowsIcons/ie.png";
import socialsIconSmall from "assets/windowsIcons/ie-paper.png";
import RendererIcon from "assets/windowsIcons/299(32x32).png";
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
    header: {
      title: "About Me",
      icon: iePaper,
    },
    defaultSize: {
      width: 700,
      height: 500,
    },
    defaultOffset: {
      x: 130,
      y: 20,
    },
    resizable: true,
    minimized: false,
    maximized: window.innerWidth < 800,
    id: genId(),
    zIndex: genIndex(),
  },
  {
    component: Minesweeper,
    header: {
      title: "Minesweeper",
      icon: mine,
    },
    defaultSize: {
      width: 0,
      height: 0,
    },
    defaultOffset: {
      x: 180,
      y: 170,
    },
    resizable: false,
    minimized: false,
    maximized: false,
    id: genId(),
    zIndex: genIndex(),
  },
];

/* desktop icons */
export const defaultIconState = [
  {
    id: 0,
    icon: iePaper,
    title: "About Me",
    component: AboutMe,
    isFocus: false,
  },
  {
    id: 1,
    icon: socialsIcon,
    title: "Socials",
    component: Socials,
    isFocus: false,
  },
  {
    id: 2,
    icon: poemsIcon,
    title: "Poems",
    component: Poems,
    isFocus: false,
  },
  {
    id: 3,
    icon: RendererIcon,
    title: "Renderer",
    component: Renderer,
    isFocus: false,
  },
  {
    id: 4,
    icon: mine,
    title: "Minesweeper",
    component: Minesweeper,
    isFocus: false,
  },
  {
    id: 5,
    icon: paintLarge,
    title: "Paint",
    component: Paint,
    isFocus: false,
  },
  {
    id: 6,
    icon: winamp,
    title: "Shoegazefy",
    component: Winamp,
    isFocus: false,
  },
];

/* start menu / openApp settings */
export const appSettings = {
  "About Me": {
    header: {
      icon: iePaper,
      title: "About Me",
    },
    component: AboutMe,
    defaultSize: {
      width: 700,
      height: 500,
    },
    defaultOffset: {
      x: 140,
      y: 30,
    },
    resizable: true,
    minimized: false,
    maximized: window.innerWidth < 800,
    multiInstance: true,
  },

  Poems: {
    header: {
      icon: poemsIconSmall,
      title: "Poems",
    },
    component: Poems,
    defaultSize: {
      width: 660,
      height: 520,
    },
    defaultOffset: {
      x: 160,
      y: 60,
    },
    resizable: true,
    minimized: false,
    maximized: window.innerWidth < 800,
    multiInstance: true,
  },

  Socials: {
    header: {
      icon: socialsIconSmall,
      title: "Socials",
    },
    component: Socials,
    defaultSize: {
      width: 520,
      height: 420,
    },
    defaultOffset: {
      x: 190,
      y: 80,
    },
    resizable: true,
    minimized: false,
    maximized: window.innerWidth < 800,
    multiInstance: true,
  },

  Renderer: {
    header: {
      icon: RendererIconSmall,
      title: "Renderer",
    },
    component: Renderer,
    defaultSize: {
      width: 660,
      height: 600,
    },
    defaultOffset: {
      x: 210,
      y: 90,
    },
    resizable: true,
    minimized: false,
    maximized: window.innerWidth < 800,
    multiInstance: true,
  },

  Minesweeper: {
    header: {
      icon: mine,
      title: "Minesweeper",
    },
    component: Minesweeper,
    defaultSize: {
      width: 0,
      height: 0,
    },
    defaultOffset: {
      x: 190,
      y: 180,
    },
    resizable: false,
    minimized: false,
    maximized: false,
    multiInstance: true,
  },

  Error: {
    header: {
      icon: error,
      title: "C:\\",
      buttons: ["close"],
      noFooterWindow: true,
    },
    component: ErrorBox,
    defaultSize: {
      width: 380,
      height: 0,
    },
    defaultOffset: {
      x: window.innerWidth / 2 - 190,
      y: window.innerHeight / 2 - 60,
    },
    resizable: false,
    minimized: false,
    maximized: false,
    multiInstance: true,
  },

  Paint: {
    header: {
      icon: paintSmall,
      title: "Untitled - Paint",
    },
    component: Paint,
    defaultSize: {
      width: 660,
      height: 500,
    },
    defaultOffset: {
      x: 280,
      y: 70,
    },
    resizable: true,
    minimized: false,
    maximized: window.innerWidth < 800,
    multiInstance: true,
  },

  Winamp: {
    header: {
      icon: winamp, // ← FIX HERE
      title: "Shoegazefy",
      invisible: true,
    },
    component: Winamp,
    defaultSize: {
      width: 0,
      height: 0,
    },
    defaultOffset: {
      x: 0,
      y: 0,
    },
    resizable: false,
    minimized: false,
    maximized: false,
    multiInstance: false,
  },

};

/* export list */
export {
  AboutMe,
  Socials,
  Poems,
  Renderer,
  Minesweeper,
  ErrorBox,
  Paint,
  Winamp,
};
