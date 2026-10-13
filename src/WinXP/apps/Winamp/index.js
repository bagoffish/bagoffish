import React, { useEffect, useRef } from 'react';
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
    webamp.current = instance;

    instance.onClose(() => {
      if (!disposed) handlers.current.onClose?.();
    });
    instance.onMinimize(() => {
      if (!disposed) handlers.current.onMinimize?.();
    });

    // renderWhenReady can reject if the component is removed before Webamp
    // finishes loading; handle that path instead of leaving an unhandled error.
    Promise.resolve(instance.renderWhenReady(target)).catch(error => {
      if (!disposed) {
        // Disposal is still handled by the effect cleanup below.
        console.error('Winamp failed to initialize:', error);
      }
    });

    return () => {
      disposed = true;
      if (webamp.current === instance) webamp.current = null;
      try {
        instance.dispose();
      } catch (error) {
        // Webamp may already have partially disposed itself during initialization.
        console.warn('Winamp cleanup encountered an error:', error);
      }
    };
  }, []);

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', inset: '0 0 30px', overflow: 'hidden', transform: 'translateZ(0)' }}
      aria-label="Winamp player"
    />
  );
}

export default Winamp;
