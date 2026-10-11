import React, { useReducer, useRef, useCallback, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import useMouse from 'react-use/lib/useMouse';

import {
  ADD_APP,
  DEL_APP,
  FOCUS_APP,
  MINIMIZE_APP,
  TOGGLE_MAXIMIZE_APP,
  FOCUS_ICON,
  SELECT_ICONS,
  FOCUS_DESKTOP,
  START_SELECT,
  END_SELECT,
  POWER_OFF,
  CANCEL_POWER_OFF,
} from './constants/actions';
import { FOCUSING, POWER_STATE } from './constants';
import { defaultIconState, appSettings } from './apps';
import Modal from './Modal';
import Footer from './Footer';
import Windows from './Windows';
import CoyCompanion from './CoyCompanion';
import Icons from './Icons';
import { DashedBox } from 'components';

/* start with no windows open */
const defaultAppState = [];

const initState = {
  apps: defaultAppState,
  nextAppID: defaultAppState.length,
  nextZIndex: defaultAppState.length,
  focusing: FOCUSING.DESKTOP,
  icons: defaultIconState,
  selecting: false,
  powerState: POWER_STATE.START,
};

const reducer = (state, action = { type: '' }) => {
  switch (action.type) {
    case ADD_APP: {
      const app = state.apps.find(
        _app => _app.component === action.payload.component,
      );
      if (action.payload.multiInstance || !app) {
        return {
          ...state,
          apps: [
            ...state.apps,
            {
              ...action.payload,
              id: state.nextAppID,
              zIndex: state.nextZIndex,
            },
          ],
          nextAppID: state.nextAppID + 1,
          nextZIndex: state.nextZIndex + 1,
          focusing: FOCUSING.WINDOW,
        };
      }
      const apps = state.apps.map(app =>
        app.component === action.payload.component
          ? { ...app, zIndex: state.nextZIndex, minimized: false }
          : app,
      );
      return {
        ...state,
        apps,
        nextZIndex: state.nextZIndex + 1,
        focusing: FOCUSING.WINDOW,
      };
    }
    case DEL_APP:
      // Closing is an explicit action from the app itself (e.g. Winamp's
      // custom close button), so it must work even when the desktop is focused.
      return {
        ...state,
        apps: state.apps.filter(app => app.id !== action.payload),
        focusing:
          state.apps.length > 1
            ? FOCUSING.WINDOW
            : state.icons.find(icon => icon.isFocus)
            ? FOCUSING.ICON
            : FOCUSING.DESKTOP,
      };
    case FOCUS_APP: {
      const apps = state.apps.map(app =>
        app.id === action.payload
          ? { ...app, zIndex: state.nextZIndex, minimized: false }
          : app,
      );
      return {
        ...state,
        apps,
        nextZIndex: state.nextZIndex + 1,
        focusing: FOCUSING.WINDOW,
      };
    }
    case MINIMIZE_APP: {
      if (state.focusing !== FOCUSING.WINDOW) return state;
      const apps = state.apps.map(app =>
        app.id === action.payload ? { ...app, minimized: true } : app,
      );
      return {
        ...state,
        apps,
        focusing: FOCUSING.WINDOW,
      };
    }
    case TOGGLE_MAXIMIZE_APP: {
      if (state.focusing !== FOCUSING.WINDOW) return state;
      const apps = state.apps.map(app =>
        app.id === action.payload ? { ...app, maximized: !app.maximized } : app,
      );
      return {
        ...state,
        apps,
        focusing: FOCUSING.WINDOW,
      };
    }
    case FOCUS_ICON: {
      const icons = state.icons.map(icon => ({
        ...icon,
        isFocus: icon.id === action.payload,
      }));
      return {
        ...state,
        focusing: FOCUSING.ICON,
        icons,
      };
    }
    case SELECT_ICONS: {
      const icons = state.icons.map(icon => ({
        ...icon,
        isFocus: action.payload.includes(icon.id),
      }));
      return {
        ...state,
        icons,
        focusing: FOCUSING.ICON,
      };
    }
    case FOCUS_DESKTOP:
      return {
        ...state,
        focusing: FOCUSING.DESKTOP,
        icons: state.icons.map(icon => ({
          ...icon,
          isFocus: false,
        })),
      };
    case START_SELECT:
      return {
        ...state,
        focusing: FOCUSING.DESKTOP,
        icons: state.icons.map(icon => ({
          ...icon,
          isFocus: false,
        })),
        selecting: action.payload,
      };
    case END_SELECT:
      return {
        ...state,
        selecting: null,
      };
    case POWER_OFF:
      return {
        ...state,
        powerState: action.payload,
      };
    case CANCEL_POWER_OFF:
      return {
        ...state,
        powerState: POWER_STATE.START,
      };
    default:
      return state;
  }
};

function injectXpCursors() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('xp-cursor-style')) return;
  const style = document.createElement('style');
  style.id = 'xp-cursor-style';
  style.textContent = [
    'html, body, #root, #root * { cursor: url("/images/Normal%20Select.cur") 3 3, default !important; }',
    '#root a, #root a *, #root button, #root button *, #root [role="button"], #root [role="button"] *, #root label, #root label *, #root summary, #root summary *, #root select, #root option, #root .xpButton, #root .xpButton *, #root .ie__function_bar__button, #root .ie__function_bar__button *, #root .inline-link, #root .inline-link *, #root [onclick], #root [onclick] *, #root [data-clickable], #root [data-clickable] *, #root input[type="button"], #root input[type="submit"], #root input[type="reset"], #root input[type="checkbox"], #root input[type="radio"], #root input[type="file"] { cursor: url("/images/Link%20Select.cur") 3 3, pointer !important; }',
    '#root .app__header button, #root .app__header [role="button"], #root .app__header [onclick] { cursor: url("/images/Link%20Select.cur") 3 3, pointer !important; }',
    '#root .xp-cursor-horizontal { cursor: url("/images/Horizontal%20Resize.cur") 8 8, ew-resize !important; }',
    '#root .xp-cursor-vertical { cursor: url("/images/Vertical%20Resize.cur") 8 8, ns-resize !important; }',
    '#root .xp-cursor-diagonal-1 { cursor: url("/images/Diagonal%20Resize%201.cur") 8 8, nwse-resize !important; }',
    '#root .xp-cursor-diagonal-2 { cursor: url("/images/Diagonal%20Resize%202.cur") 8 8, nesw-resize !important; }',
    '#root *::-webkit-scrollbar, #root *::-webkit-scrollbar-thumb, #root *::-webkit-scrollbar-track, #root *::-webkit-scrollbar-button { cursor: url("/images/Link%20Select.cur") 3 3, pointer !important; }',
    '#root .xp-cursor-normal { cursor: url("/images/Normal%20Select.cur") 3 3, default !important; }',
    'input[type="text"], input[type="password"], input[type="search"], input[type="email"], input[type="number"], input[type="url"], input:not([type]), textarea, [contenteditable="true"] { cursor: url("/images/Normal%20Select.cur") 3 3, text !important; }',
    'body.xp-resizing, body.xp-resizing * { cursor: var(--xp-resize-cursor, inherit) !important; }',
    'body.xp-resizing .xp-cursor-cover { cursor: var(--xp-resize-cursor, inherit) !important; }',
    '.xp-cursor-cover { cursor: var(--xp-resize-cursor, url("/images/Normal%20Select.cur") 3 3, default) !important; }',
  ].join('\n');
  document.head.appendChild(style);
  const mark = () => {
    try {
      document.querySelectorAll('#root button, #root a, #root label, #root [role="button"], #root select').forEach(el => {
        el.setAttribute('data-clickable', '1');
      });
    } catch (e) {}
  };
  mark();
  if (!window.__xpCursorObserver) {
    const obs = new MutationObserver(() => mark());
    obs.observe(document.documentElement, { childList: true, subtree: true });
    window.__xpCursorObserver = obs;
  }
}

function WinXP() {
  if (typeof window !== 'undefined') injectXpCursors();
  const [state, dispatch] = useReducer(reducer, initState);
  const ref = useRef(null);
  const mouse = useMouse(ref);
  const focusedAppId = getFocusedAppId();
  const previousOpenApps = useRef([]);

  // Let Coy open real XP-shell apps without reaching outside the website/browser.
  useEffect(() => {
    const findSetting = name => {
      const normalized = String(name || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
      const aliases = {
        'about': 'About Me', 'about me': 'About Me', 'profile': 'About Me',
        'letters': 'Winter_Letter', 'winter letter': 'Winter_Letter',
        'winterletter': 'Winter_Letter', 'music ai': 'Bloxify', 'music generator': 'Bloxify',
        'paint': 'Paint', 'ms paint': 'Paint', 'minesweeper': 'Minesweeper',
        'mine sweeper': 'Minesweeper', 'music player': 'Winamp', 'winamp': 'Winamp',
        'poem': 'Poems', 'poems': 'Poems', 'roblox renderer': 'Renderer',
        'avatar renderer': 'Renderer', 'renderer': 'Renderer', 'coy chat': 'Coy', 'coy': 'Coy',
      };
      const key = aliases[normalized] || Object.keys(appSettings).find(key => key.toLowerCase().replace(/[_-]+/g, ' ') === normalized);
      return key ? { name: key, setting: appSettings[key] } : null;
    };
    const onCoyOpenApp = event => {
      const found = findSetting(event.detail && event.detail.name);
      if (found) dispatch({ type: ADD_APP, payload: found.setting });
    };
    const onCoyDesktopAction = event => {
      const detail = event.detail || {};
      const action = String(detail.action || '').toLowerCase();
      const found = findSetting(detail.name);
      if (!found) return;
      const title = found.setting.header.title;
      const matching = state.apps.filter(app =>
        String(app.header && app.header.title || '').toLowerCase() === String(title).toLowerCase()
      );
      if (action === 'open' || action === 'launch') {
        dispatch({ type: ADD_APP, payload: found.setting });
        return;
      }
      const app = matching.sort((a, b) => b.zIndex - a.zIndex)[0];
      if (!app) {
        if (action === 'focus' || action === 'maximize' || action === 'minimize' || action === 'restore') {
          dispatch({ type: ADD_APP, payload: found.setting });
        }
        return;
      }
      if (action === 'focus') dispatch({ type: FOCUS_APP, payload: app.id });
      else if (action === 'minimize') dispatch({ type: MINIMIZE_APP, payload: app.id });
      else if (action === 'maximize') {
        if (!app.maximized) dispatch({ type: FOCUS_APP, payload: app.id });
        if (!app.maximized) dispatch({ type: TOGGLE_MAXIMIZE_APP, payload: app.id });
      } else if (action === 'restore') {
        if (app.maximized) dispatch({ type: TOGGLE_MAXIMIZE_APP, payload: app.id });
        dispatch({ type: FOCUS_APP, payload: app.id });
      } else if (action === 'close') {
        const risky = ['Paint', 'Winter_Letter'].includes(found.name);
        if (risky && !window.confirm('Close ' + title + '? Any unsaved work in this window may be lost.')) return;
        dispatch({ type: DEL_APP, payload: app.id });
        if (found.name === 'Coy') window.dispatchEvent(new CustomEvent('coy:close-chat'));
      }
    };
    window.addEventListener('coy:open-app', onCoyOpenApp);
    window.addEventListener('coy:desktop-action', onCoyDesktopAction);
    return () => {
      window.removeEventListener('coy:open-app', onCoyOpenApp);
      window.removeEventListener('coy:desktop-action', onCoyDesktopAction);
    };
  }, [state.apps]);

  // Open Coy's conversation inside the same XP window manager used by every app.
  useEffect(() => {
    const onCoyOpenChat = event => {
      const setting = appSettings.Coy;
      if (!setting) return;
      const existing = state.apps.find(app => app.header?.title === 'Coy');
      if (existing) {
        // Clicking Coy again should focus the existing chat, never close it.
        dispatch({ type: FOCUS_APP, payload: existing.id });
        return;
      }
      const image = event.detail && event.detail.image;
      dispatch({
        type: ADD_APP,
        payload: {
          ...setting,
          injectProps: image ? { initialImage: image } : undefined,
        },
      });
    };
    const onCoyCloseChat = () => {
      state.apps.filter(app => app.header?.title === 'Coy').forEach(app => {
        dispatch({ type: DEL_APP, payload: app.id });
      });
    };
    window.addEventListener('coy:open-chat', onCoyOpenChat);
    window.addEventListener('coy:close-chat', onCoyCloseChat);
    return () => {
      window.removeEventListener('coy:open-chat', onCoyOpenChat);
      window.removeEventListener('coy:close-chat', onCoyCloseChat);
    };
  }, [state.apps]);

  // Publish desktop activity so Coy can react to the apps the visitor actually opens.
  useEffect(() => {
    const publishAppState = () => {
      const openApps = state.apps.filter(app => !app.minimized).map(app => app.header && app.header.title).filter(Boolean);
      const newlyOpened = openApps.filter(name => !previousOpenApps.current.includes(name));
      previousOpenApps.current = openApps;
      const fullTabActive = state.apps.some(app => !app.minimized && app.maximized);
      window.dispatchEvent(new CustomEvent('coy:activity', {
        detail: { type: 'app-state', openApps, fullTabActive },
      }));
      newlyOpened.forEach(name => {
        window.dispatchEvent(new CustomEvent('coy:activity', { detail: { type: 'app-open', name } }));
      });
    };
    const onRequestAppState = () => {
      const openApps = state.apps.filter(app => !app.minimized).map(app => app.header && app.header.title).filter(Boolean);
      const fullTabActive = state.apps.some(app => !app.minimized && app.maximized);
      window.dispatchEvent(new CustomEvent('coy:activity', {
        detail: { type: 'app-state', openApps, fullTabActive },
      }));
    };
    window.addEventListener('coy:request-app-state', onRequestAppState);
    publishAppState();
    return () => window.removeEventListener('coy:request-app-state', onRequestAppState);
  }, [state.apps]);


  const onFocusApp = useCallback(id => {
    dispatch({ type: FOCUS_APP, payload: id });
  }, []);

  const onMaximizeWindow = useCallback(
    id => {
      if (focusedAppId === id) {
        dispatch({ type: TOGGLE_MAXIMIZE_APP, payload: id });
      }
    },
    [focusedAppId],
  );

  const onMinimizeWindow = useCallback(
    id => {
      if (focusedAppId === id) {
        dispatch({ type: MINIMIZE_APP, payload: id });
      }
    },
    [focusedAppId],
  );

  const onCloseApp = useCallback(id => {
    const closingApp = state.apps.find(app => app.id === id);
    dispatch({ type: DEL_APP, payload: id });
    if (closingApp && closingApp.header?.title === 'Coy') {
      window.dispatchEvent(new CustomEvent('coy:close-chat'));
    }
  }, [state.apps]);

  function onMouseDownFooterApp(id) {
    if (focusedAppId === id) {
      dispatch({ type: MINIMIZE_APP, payload: id });
    } else {
      dispatch({ type: FOCUS_APP, payload: id });
    }
  }

  function onMouseDownIcon(id) {
    dispatch({ type: FOCUS_ICON, payload: id });
  }

  function onDoubleClickIcon(component) {
    const appSetting = Object.values(appSettings).find(
      setting => setting.component === component,
    );
    if (appSetting) dispatch({ type: ADD_APP, payload: appSetting });
  }

  function getFocusedAppId() {
    if (state.focusing !== FOCUSING.WINDOW) return -1;
    const focusedApp = [...state.apps]
      .sort((a, b) => b.zIndex - a.zIndex)
      .find(app => !app.minimized);
    return focusedApp ? focusedApp.id : -1;
  }

  function onMouseDownFooter() {
    dispatch({ type: FOCUS_DESKTOP });
  }

  function onOpenApp(name) {
    const appSetting = appSettings[name];
    if (appSetting) dispatch({ type: ADD_APP, payload: appSetting });
  }

  function onClickMenuItem(o) {
    if (o === 'Minesweeper')
      dispatch({ type: ADD_APP, payload: appSettings.Minesweeper });
    else if (o === 'Paint')
      dispatch({ type: ADD_APP, payload: appSettings.Paint });
    else if (o === 'Log Off')
      dispatch({ type: POWER_OFF, payload: POWER_STATE.LOG_OFF });
    else if (o === 'Turn Off Computer')
      dispatch({ type: POWER_OFF, payload: POWER_STATE.TURN_OFF });
    else {
      const maybe = appSettings[o];
      if (maybe) dispatch({ type: ADD_APP, payload: maybe });
      else
        dispatch({
          type: ADD_APP,
          payload: {
            ...appSettings.Error,
            injectProps: { message: 'C:\\\nApplication not found' },
          },
        });
    }
  }

  function onMouseDownDesktop(e) {
    if (e.target === e.currentTarget)
      dispatch({
        type: START_SELECT,
        payload: { x: mouse.docX, y: mouse.docY },
      });
  }

  function onMouseUpDesktop(e) {
    dispatch({ type: END_SELECT });
  }

  const onIconsSelected = useCallback(
    iconIds => {
      dispatch({ type: SELECT_ICONS, payload: iconIds });
    },
    [dispatch],
  );

  function onClickModalButton(text) {
    dispatch({ type: CANCEL_POWER_OFF });
    dispatch({
      type: ADD_APP,
      payload: appSettings.Error,
    });
  }

  function onModalClose() {
    dispatch({ type: CANCEL_POWER_OFF });
  }

  return (
    <Container
      ref={ref}
      onMouseUp={onMouseUpDesktop}
      onMouseDown={onMouseDownDesktop}
      state={state.powerState}
    >
      <Icons
        icons={state.icons}
        onMouseDown={onMouseDownIcon}
        onDoubleClick={onDoubleClickIcon}
        displayFocus={state.focusing === FOCUSING.ICON}
        appSettings={appSettings}
        mouse={mouse}
        selecting={state.selecting}
        setSelectedIcons={onIconsSelected}
      />
      <DashedBox startPos={state.selecting} mouse={mouse} />
      <Windows
        apps={state.apps}
        onMouseDown={onFocusApp}
        onClose={onCloseApp}
        onMinimize={onMinimizeWindow}
        onMaximize={onMaximizeWindow}
        focusedAppId={focusedAppId}
        onOpenApp={onOpenApp}
      />
      <Footer
        apps={state.apps}
        onMouseDownApp={onMouseDownFooterApp}
        onMouseDown={onMouseDownFooter}
        focusedAppId={focusedAppId}
        onClickMenuItem={onClickMenuItem}
      />
      {state.powerState !== POWER_STATE.START && (
        <Modal
          onClose={onModalClose}
          onClickButton={onClickModalButton}
          mode={state.powerState}
        />
      )}
      <CoyCompanion />
    </Container>
  );
}

const powerOffAnimation = keyframes`
  0% {
    filter: brightness(1) grayscale(0);
  }
  30% {
    filter: brightness(1) grayscale(0);
  }
  100% {
    filter: brightness(0.6) grayscale(1);
  }
`;

const animation = {
  [POWER_STATE.START]: '',
  [POWER_STATE.TURN_OFF]: powerOffAnimation,
  [POWER_STATE.LOG_OFF]: powerOffAnimation,
};

/* XP cursors — also enforced in Container for the desktop shell */
const CURSOR_NORMAL = `url("/images/Normal%20Select.cur") 3 3, default`;
const CURSOR_LINK = `url("/images/Link%20Select.cur") 3 3, pointer`;

const Container = styled.div`
  @import url('https://fonts.googleapis.com/css?family=Noto+Sans');
  font-family: Tahoma, 'Noto Sans', sans-serif;
  height: 100%;
  width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  position: relative;
  background-color: #1d2530;
  background-image: url('${process.env.PUBLIC_URL || '.'}/images/bliss.png');
  background-repeat: no-repeat;
  background-position: center center;
  background-attachment: fixed;
  background-size: cover;
  animation: ${({ state }) => animation[state]} 5s forwards;

  cursor: ${CURSOR_NORMAL} !important;

  *:not(input):not(textarea):not(select) {
    user-select: none;
  }

  *,
  *::before,
  *::after {
    -webkit-tap-highlight-color: transparent;
    cursor: ${CURSOR_NORMAL} !important;
  }

  a, a *,
  button, button *,
  [role='button'], [role='button'] *,
  label, label *,
  summary, select, option,
  .xpButton, .xpButton *,
  .ie__function_bar__button, .ie__function_bar__button *,
  .inline-link, .inline-link *,
  [data-clickable], [data-clickable] *,
  [onclick], [onclick] * {
    cursor: ${CURSOR_LINK} !important;
  }

  input, textarea, [contenteditable='true'] {
    cursor: url("/images/Normal%20Select.cur") 3 3, text !important;
  }

  .xp-cursor-horizontal, [data-resize="horizontal"] {
    cursor: url("/images/Horizontal%20Resize.cur") 8 8, ew-resize !important;
  }
  .xp-cursor-vertical, [data-resize="vertical"] {
    cursor: url("/images/Vertical%20Resize.cur") 8 8, ns-resize !important;
  }
  .xp-cursor-diagonal-1, [data-resize="diagonal-1"] {
    cursor: url("/images/Diagonal%20Resize%201.cur") 8 8, nwse-resize !important;
  }
  .xp-cursor-diagonal-2, [data-resize="diagonal-2"] {
    cursor: url("/images/Diagonal%20Resize%202.cur") 8 8, nesw-resize !important;
  }
  }
  @media (max-width: 700px) {
    html, body, #root {
      width: 100%;
      height: 100%;
      min-height: 100%;
      overflow: hidden;
    }
    #root {
      position: fixed;
      inset: 0;
    }
  }
`;

export default WinXP;
