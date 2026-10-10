import React from 'react';
import WinXP from 'WinXP';
import WinterLetterVN from './components/WinterLetterVN';
import PersonalAI from './WinXP/apps/PersonalAI';

function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';

  // A dedicated, full-page chatbot at https://bagof.fish/coy
  if (path === '/coy') {
    return <PersonalAI standalone />;
  }

  if (path === '/vn') {
    return <WinterLetterVN />;
  }

  return <WinXP />;
}

export default App;
