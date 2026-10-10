import React, { useState } from 'react';

// Static Coy portrait. Replace public/images/coy.png to update the artwork.
export default function CoyCompanion() {
  const [showMenu, setShowMenu] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [line, setLine] = useState('Just hanging out.');
  const expressions = [
    ['Normal', 'Just hanging out.'], ['Slightly happy', 'Oh, hi.'],
    ['Annoyed', 'I am judging you a normal amount.'], ['Sleepy', 'Five more minutes…'],
    ['Surprised', 'Wait, what?'], ['Smug', 'I know something you don’t.'],
    ['Embarrassed', 'Don’t look at me.'], ['Thinking', 'Hold on. Thinking.'],
    ['Waving', 'Hey.'], ['Cute pose', 'Behold. The creature.'],
  ];
  const styles = {
    root: { position: 'fixed', right: 14, bottom: 18, zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, fontFamily: 'Tahoma, Arial, sans-serif', pointerEvents: 'none' },
    imageButton: { pointerEvents: 'auto', display: 'block', border: 0, padding: 0, background: 'transparent', cursor: 'pointer', width: 'min(42vw, 280px)', maxWidth: 280, maxHeight: '62vh', touchAction: 'manipulation' },
    image: { display: 'block', width: '100%', height: 'auto', maxHeight: '62vh', objectFit: 'contain', objectPosition: 'bottom', filter: 'drop-shadow(0 3px 3px rgba(0,0,0,.2))' },
    bubble: { pointerEvents: 'auto', maxWidth: 230, padding: '8px 12px', border: '2px solid #555b63', borderRadius: 13, background: '#fff', color: '#202124', boxShadow: '1px 2px 0 rgba(0,0,0,.18)', fontSize: 12, lineHeight: 1.4, cursor: 'pointer', textAlign: 'left' },
    menu: { pointerEvents: 'auto', maxWidth: 240, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, padding: 7, background: '#fff', border: '2px solid #555b63', borderRadius: 7, boxShadow: '2px 3px 0 rgba(0,0,0,.18)' },
  };
  return <div style={styles.root}>
    {showBubble && <button type="button" style={styles.bubble} onClick={() => setShowBubble(false)}>{line}</button>}
    {showMenu && <div role="menu" aria-label="Coy expressions" style={styles.menu}>
      {expressions.map(([label, text]) => <button key={label} type="button" role="menuitem" onClick={() => { setLine(text); setShowBubble(true); setShowMenu(false); }} style={{ fontSize: 11, padding: '6px 5px', background: '#f7f7f7', border: '1px solid #bbb', borderRadius: 3 }}>{label}</button>)}
    </div>}
    <button type="button" style={styles.imageButton} onClick={() => { setLine('Just hanging out.'); setShowBubble(v => !v); }} onContextMenu={e => { e.preventDefault(); setShowMenu(v => !v); }} aria-label="Coy" title="Click Coy to say hello; right-click for expressions">
      <img src="/images/coy.png" alt="Coy" style={styles.image} />
    </button>
  </div>;
}
