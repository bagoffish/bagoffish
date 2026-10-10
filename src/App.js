import React from 'react';
import WinXP from 'WinXP';
import WinterLetterVN from './components/WinterLetterVN';
import CoyPage from './coy';

function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';

  if (path === '/coy') return <CoyPage />;
  if (path === '/vn') return <WinterLetterVN />;

  // Redirect unknown paths to the homepage.
  if (path !== '/') {
    window.location.replace('/');
    return null;
  }

  return <WinXP />;
}

export default App;
