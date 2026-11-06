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

// The resize hook (hooks/useElementResize.js) puts data-xp-resize="<edge>" on <body> while the
// pointer is on a window edge and for the whole drag. Nothing used to read it, so the resize cursors
// never showed. :not(#xp-resize-active) adds an id's worth of specificity so these beat the
// shell-wide "* { cursor: ... !important }" rules (and the same rules in Container below). No hotspot
// is given: the .cur files carry their own, at the centre of the arrow.
const RESIZE_EDGE_CURSORS = [
  [['left', 'right'], 'Horizontal%20Resize.cur', 'ew-resize'],
  [['top', 'bottom'], 'Vertical%20Resize.cur', 'ns-resize'],
  [['topLeft', 'bottomRight'], 'Diagonal%20Resize%201.cur', 'nwse-resize'],
  [['topRight', 'bottomLeft'], 'Diagonal%20Resize%202.cur', 'nesw-resize'],
];
const resizeEdgeRules = () => RESIZE_EDGE_CURSORS.map(([edges, file, fallback]) => {
  const selector = edges
    .map(edge => `html body[data-xp-resize="${edge}"]:not(#xp-resize-active), html body[data-xp-resize="${edge}"]:not(#xp-resize-active) *`)
    .join(', ');
  return `${selector} { cursor: url("/images/${file}"), ${fallback} !important; }`;
});

function injectXpCursors() {
  if (typeof document === 'undefined' || !document.head) return;
  let style = document.getElementById('xp-cursor-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'xp-cursor-style';
    document.head.appendChild(style);
  }
  // Resize mode has stronger specificity than the shell-wide cursor rules.
  style.textContent = [
    'html, body, body * { cursor: url("/images/Normal%20Select.cur") 3 3, default !important; }',
    'body a, body a *, body button, body button *, body [role="button"], body [role="button"] *, body label, body label *, body summary, body summary *, body select, body option, body .xpButton, body .xpButton *, body .ie__function_bar__button, body .ie__function_bar__button *, body .inline-link, body .inline-link *, body [onclick], body [onclick] *, body [data-clickable], body [data-clickable] *, body input[type="button"], body input[type="submit"], body input[type="reset"], body input[type="checkbox"], body input[type="radio"], body input[type="file"] { cursor: url("/images/Link%20Select.cur") 3 3, pointer !important; }',
    'body .app__header button, body .app__header [role="button"], body .app__header [onclick] { cursor: url("/images/Link%20Select.cur") 3 3, pointer !important; }',
    'body .xp-cursor-horizontal, body [data-resize="horizontal"] { cursor: url("/images/Horizontal%20Resize.cur") 8 8, ew-resize !important; }',
    'body .xp-cursor-vertical, body [data-resize="vertical"] { cursor: url("/images/Vertical%20Resize.cur") 8 8, ns-resize !important; }',
    'body .xp-cursor-diagonal-1, body [data-resize="diagonal-1"] { cursor: url("/images/Diagonal%20Resize%201.cur") 8 8, nwse-resize !important; }',
    'body .xp-cursor-diagonal-2, body [data-resize="diagonal-2"] { cursor: url("/images/Diagonal%20Resize%202.cur") 8 8, nesw-resize !important; }',
    'body *::-webkit-scrollbar, body *::-webkit-scrollbar-thumb, body *::-webkit-scrollbar-track, body *::-webkit-scrollbar-button { cursor: url("/images/Normal%20Select.cur") 3 3, default !important; }',
    'body .xp-cursor-normal { cursor: url("/images/Normal%20Select.cur") 3 3, default !important; }',
    'body input[type="text"], body input[type="password"], body input[type="search"], body input[type="email"], body input[type="number"], body input[type="url"], body input:not([type]), body textarea, body [contenteditable="true"] { cursor: text !important; }',
    'body textarea::-webkit-resizer { cursor: url("/images/Diagonal%20Resize%201.cur") 8 8, nwse-resize !important; }',
    // Only active while the hook has marked <body> (edge hover or an active drag); the hook clears it on
    // mouseup, blur and when the pointer leaves the window, so it can't stick.
    ...resizeEdgeRules(),
  ].join('\n');
  const mark = () => {
    document.querySelectorAll('#root button, #root a, #root label, #root [role="button"], #root select').forEach(el => {
      if (!el.hasAttribute('data-clickable')) el.setAttribute('data-clickable', '1');
    });
  };
  mark();
  if (!window.__xpCursorObserver) {
    const obs = new MutationObserver(mark);
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
    dispatch({ type: DEL_APP, payload: id });
  }, []);

  function onMouseDownFooterApp(id) {
    if (focusedAppId === id) {
      dispatch({ type: MINIMIZE_APP, payload: id });
    } else {
      dispatch({ type: FOCUS_APP, payload: id });
    }
  }

  function onClickPinnedApp(icon) {
    if (!icon || icon.title === 'Coy') return;
    const setting = Object.values(appSettings).find(
      item => item.component === icon.component,
    );
    if (!setting) return;
    const runningApp = state.apps.find(app => app.component === icon.component);
    if (!runningApp) {
      dispatch({ type: ADD_APP, payload: setting });
    } else if (focusedAppId === runningApp.id) {
      dispatch({ type: MINIMIZE_APP, payload: runningApp.id });
    } else {
      dispatch({ type: FOCUS_APP, payload: runningApp.id });
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
    if (o === 'Paint')
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
        icons={defaultIconState}
        onClickPinnedApp={onClickPinnedApp}
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
const CURSOR_LINK = `url("/images/Link%20Select.cur") 3 3, pointer`;
const CURSOR_NORMAL = `url("/images/Normal%20Select.cur") 3 3, default`;
const CURSOR_RESIZE_HORIZONTAL = `url("/images/Horizontal%20Resize.cur") 8 8, ew-resize`;
const CURSOR_RESIZE_VERTICAL = `url("/images/Vertical%20Resize.cur") 8 8, ns-resize`;
const CURSOR_RESIZE_DIAGONAL_1 = `url("/images/Diagonal%20Resize%201.cur") 8 8, nwse-resize`;
const CURSOR_RESIZE_DIAGONAL_2 = `url("/images/Diagonal%20Resize%202.cur") 8 8, nesw-resize`;

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
    cursor: text !important;
  }
  textarea::-webkit-resizer {
    cursor: ${CURSOR_RESIZE_DIAGONAL_1} !important;
  }

  .xp-cursor-horizontal, [data-resize="horizontal"] {
    cursor: ${CURSOR_RESIZE_HORIZONTAL} !important;
  }
  .xp-cursor-vertical, [data-resize="vertical"] {
    cursor: ${CURSOR_RESIZE_VERTICAL} !important;
  }
  .xp-cursor-diagonal-1, [data-resize="diagonal-1"] {
    cursor: ${CURSOR_RESIZE_DIAGONAL_1} !important;
  }
  .xp-cursor-diagonal-2, [data-resize="diagonal-2"] {
    cursor: ${CURSOR_RESIZE_DIAGONAL_2} !important;
  }
  }
`;

export default WinXP;
