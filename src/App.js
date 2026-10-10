import React from 'react';
import WinXP from 'WinXP';

function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';

  // The XP desktop is the only app entry point. Unknown URLs return home.
  if (path !== '/') {
    window.location.replace('/');
    return null;
  }

  return <WinXP />;
}

export default App;
