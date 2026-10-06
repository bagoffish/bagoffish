import React, { useEffect, useRef } from 'react';
import Webamp from 'webamp';
import { initialTracks } from './config';

function Winamp({ onClose, onMinimize }) {
  const targetRef = useRef(null);
  const webampRef = useRef(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return undefined;

    if (Webamp.browserIsSupported && !Webamp.browserIsSupported()) {
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
      .renderWhenReady(target)
      .catch(error => {
        console.error('Winamp failed to render:', error);
      });

    return () => {
      if (webampRef.current) {
        webampRef.current.dispose();
        webampRef.current = null;
      }
    };
  }, [onClose, onMinimize]);

  return (
    <div
      ref={targetRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'auto',
      }}
    />
  );
}

export default Winamp;
