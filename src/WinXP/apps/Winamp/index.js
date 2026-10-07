import React, { useEffect, useRef } from 'react';
import Webamp from 'webamp';
import { initialTracks } from './config';

function Winamp({ onClose, onMinimize, isFocus }) {
  const targetRef = useRef(null);
  const webampRef = useRef(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return undefined;

    target.classList.add('winamp-host');

    const focusParents = [];
    let focusNode = target.parentElement;
    for (let i = 0; i < 5 && focusNode; i += 1) {
      focusNode.classList.add('winamp-focus-suppressor');
      focusParents.push(focusNode);
      focusNode = focusNode.parentElement;
    }

    const style = document.createElement('style');
    style.textContent = `
      .winamp-host,
      .winamp-host:focus,
      .winamp-host:focus-visible,
      .winamp-host *:focus,
      .winamp-host *:focus-visible,
      .winamp-focus-suppressor:focus,
      .winamp-focus-suppressor:focus-visible {
        outline: 0 !important;
        box-shadow: none !important;
        -webkit-focus-ring-color: transparent !important;
      }
      .winamp-host,
      .winamp-host * {
        -webkit-tap-highlight-color: transparent !important;
      }
    `;
    document.head.appendChild(style);

    if (Webamp.browserIsSupported && !Webamp.browserIsSupported()) {
      style.remove();
      target.classList.remove('winamp-host');
      return undefined;
    }

    const webamp = new Webamp({
      initialTracks,
      enableMediaSession: true,
    });

    webampRef.current = webamp;
    webamp.onClose(onClose);
    webamp.onMinimize(onMinimize);

    webamp
      .renderInto(target)
      .catch(error => {
        console.error('Winamp failed to render:', error);
      });

    return () => {
      style.remove();
      target.classList.remove('winamp-host');
      focusParents.forEach(node => node.classList.remove('winamp-focus-suppressor'));
      if (webampRef.current) {
        webampRef.current.dispose();
        webampRef.current = null;
      }
    };
  }, [onClose, onMinimize]);

  useEffect(() => {
    if (isFocus && webampRef.current) {
      webampRef.current.reopen();
    }
  }, [isFocus]);

  return (
    <div
      ref={targetRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        overflow: 'visible',
        pointerEvents: 'auto',
        zIndex: 1,
        background: 'transparent',
        border: 0,
        outline: 0,
        boxShadow: 'none',
      }}
    />
  );
}

export default Winamp;
