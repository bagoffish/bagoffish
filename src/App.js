import React from 'react';
import WinXP from 'WinXP';
import WinterLetterVN from './components/WinterLetterVN';
import PersonalAI from './WinXP/apps/PersonalAI';

function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';

  // Keep the two dedicated pages available.
  if (path === '/coy') {
    return <PersonalAI standalone />;
  }

  if (path === '/vn') {
    return <WinterLetterVN />;
  }

  // Only the homepage is a valid fallback. Send every other path to bagof.fish/.
  if (path !== '/') {
    window.location.replace('/');
    return null;
  }

  return <WinXP />;
}

export default App;
