import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Webamp from 'webamp';
import { initialTracks } from './config';

function Winamp({ onClose, onMinimize }) {
  const ref = useRef(null);
  const webamp = useRef(null);
  const handlers = useRef({ onClose, onMinimize });

  // Keep the callbacks fresh without repeatedly registering Webamp listeners.
  handlers.current = { onClose, onMinimize };

  useEffect(() => {
    const target = ref.current;
    if (!target) return undefined;

    let disposed = false;
    const instance = new Webamp({ initialTracks });
    const taskbar = document.querySelector('[data-xp-taskbar="true"]');
    const updateBounds = () => {
      const rect = taskbar?.getBoundingClientRect();
      const bottom = rect && rect.height > 0 ? window.innerHeight - rect.top : 30;
      target.style.bottom = `${Math.max(0, bottom)}px`;
    };
    updateBounds();
    const taskbarObserver = typeof ResizeObserver !== 'undefined' && taskbar
      ? new ResizeObserver(updateBounds)
      : null;
    taskbarObserver?.observe(taskbar);
    const hitTestingStyle = document.createElement('style');
    hitTestingStyle.textContent = '#webamp, #webamp * { pointer-events: auto; }';
    document.head.appendChild(hitTestingStyle);
    window.addEventListener('resize', updateBounds);
    webamp.current = instance;

    instance.onClose(() => {
      if (!disposed) handlers.current.onClose?.();
    });
    instance.onMinimize(() => {
      if (!disposed) handlers.current.onMinimize?.();
    });

    // renderWhenReady can reject if the component is removed before Webamp
    // finishes loading; handle that path instead of leaving an unhandled error.
    Promise.resolve(instance.renderWhenReady(target)).then(() => {
      if (disposed || !target.isConnected) return;
      // Webamp 1.x portals its windows to <body>; move its root into the bounded
      // desktop area so the windows cannot spill over the XP taskbar.
      const webampNode = document.getElementById('webamp');
      if (webampNode && webampNode.parentNode !== target) target.appendChild(webampNode);
      updateBounds();
    }).catch(error => {
      if (!disposed) {
        // Disposal is still handled by the effect cleanup below.
        console.error('Winamp failed to initialize:', error);
      }
    });

    return () => {
      disposed = true;
      taskbarObserver?.disconnect();
      hitTestingStyle.remove();
      window.removeEventListener('resize', updateBounds);
      if (webamp.current === instance) webamp.current = null;
      try {
        instance.dispose();
      } catch (error) {
        // Webamp may already have partially disposed itself during initialization.
        console.warn('Winamp cleanup encountered an error:', error);
      }
    };
  }, []);

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 30, overflow: 'hidden', clipPath: 'inset(0)', transform: 'translateZ(0)', zIndex: 9998, pointerEvents: 'none' }}
      aria-label="Winamp player"
    />,
    document.body
  );
}

export default Winamp;
