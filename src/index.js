import React from 'react';
import ReactDOM from 'react-dom';

import './index.css';
import 'assets/clear.css';
import 'assets/font.css';
import App from './App';
import * as serviceWorker from './serviceWorker';

// One-time cleanup for stale pre-redeploy assets and saved chatbot replies.
// Preserve visitor identity, player names, and other user settings.
(function resetStaleSiteCaches() {
  const resetKey = 'bagof-fish-cache-reset-v3';
  const resetVersion = '20261011-clean-sweep-1';
  let shouldReset = true;
  try {
    shouldReset = window.localStorage.getItem(resetKey) !== resetVersion;
  } catch (_) {}

  if (shouldReset) {
    try {
      const staleKeys = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (key && (/^bagof-fish-coy-chat-v\d+$/i.test(key) ||
          /^avatar-history-index-v\d+:/i.test(key) ||
          /^renderer-cache(?:-|$)/i.test(key) ||
          key === 'bagof-fish-visitor-count')) {
          staleKeys.push(key);
        }
      }
      staleKeys.forEach(key => window.localStorage.removeItem(key));
      window.localStorage.setItem(resetKey, resetVersion);
    } catch (_) {}

    // Remove old compact chat transcripts that could keep showing stale replies.
    ['coy_chat_log', 'coy_companion_chat'].forEach(name => {
      try {
        document.cookie = name + '=; Max-Age=0; path=/; SameSite=Lax';
        document.cookie = name + '=; Max-Age=0; path=/; domain=bagof.fish; SameSite=Lax';
      } catch (_) {}
    });

    // Remove any previously registered worker before the next navigation.
    if (navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === 'function') {
      navigator.serviceWorker.getRegistrations()
        .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
        .catch(() => {});
    }

    // The app does not rely on offline caches; remove stale CacheStorage entries.
    if (window.caches && typeof window.caches.keys === 'function') {
      window.caches.keys()
        .then(keys => Promise.all(keys.map(key => window.caches.delete(key))))
        .catch(() => {});
    }
  }
})();

ReactDOM.render(<App />, document.getElementById('root'));

serviceWorker.unregister();

if (module.hot && !window.frameElement) {
  console.log('HMR enabled');
  module.hot.accept('./App', () => {
    const NextApp = require('./App').default;
    ReactDOM.render(<NextApp />, document.getElementById('root'));
  });
}
