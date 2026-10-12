import React from 'react';

// The visual novel runs inside the Windows XP app window. Its story, artwork,
// audio, and styling remain in public/winter-letter; there is no standalone page.
const gameDocument = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Winter Letter</title>
  <link rel="stylesheet" href="/winter-letter/styles.css">
</head>
<body>
  <div id="title-screen">
    <div class="top-menu">
      <a onclick="startGame()">START</a>
      <a onclick="toggleLanguage()">KOREAN</a>
    </div>
    <div id="title-art"><img src="/winter-letter/images/title.png" alt="WINTER LETTER"></div>
    <div class="footer">winter_letter</div>
  </div>
  <div id="game-screen">
    <div id="background"></div>
    <div id="overlay"></div>
    <img id="character" src="" alt="">
    <div id="textbox"><div id="namebox"></div><div id="text"></div></div>
    <div id="letter-box" style="display:none"><div id="letter-paper"><div id="letter-text"></div></div></div>
  </div>
  <div id="credits-screen">
    <h1>WINTER LETTER</h1>
    <p>Story by <a href="https://github.com/bagoffish" target="_blank" rel="noopener noreferrer">Coy</a></p>
    <button onclick="returnToTitle()">RETURN TO TITLE</button>
  </div>
  <audio id="bgMusic" loop></audio>
  <audio id="titleMusic" loop></audio>
  <audio id="sfx"></audio>
  <script src="/winter-letter/script.js"></script>
</body>
</html>`;

export default function WinterLetter() {
  return (
    <iframe
      title="Winter Letter visual novel"
      srcDoc={gameDocument}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        minHeight: 320,
        border: 0,
        background: '#000',
      }}
      allow="autoplay"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  );
}
