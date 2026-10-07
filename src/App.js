import React from 'react';
import WinXP from 'WinXP';
import WinterLetterVN from './components/WinterLetterVN';

function App() {
  if (window.location.pathname === '/vn') {
    return <WinterLetterVN />;
  }

  return <WinXP />;
}

export default App;
