import React from 'react';

// Keep the original visual novel intact: its title screen, full English/Korean
// story, character art, music, sound effects, letter scenes, and credits all live
// in public/vn. Embedding that existing game avoids maintaining a cut-down copy.
export default function WinterLetter() {
  return (
    <iframe
      title="Winter Letter visual novel"
      src="/winter-letter/index.html"
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        minHeight: 320,
        border: 0,
        background: '#000',
      }}
      allow="autoplay"
    />
  );
}
