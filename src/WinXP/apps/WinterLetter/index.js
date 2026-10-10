import React, { useState } from 'react';

const script = [
  "I killed a man in winter.",
  "Though I cannot say with certainty which winter it was.",
  "The snow remembers more than I do.",
  "The road outside Incheon was silent that night.",
  "And in my pocket was a knife."
];

export default function WinterLetter() {
  const [index, setIndex] = useState(0);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Winter Letter. Click or press Enter to continue."
      onClick={() => {
        if (index < script.length - 1) setIndex(index + 1);
      }}
      onKeyDown={event => {
        if ((event.key === 'Enter' || event.key === ' ') && index < script.length - 1) {
          event.preventDefault();
          setIndex(index + 1);
        }
      }}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 320,
        boxSizing: "border-box",
        backgroundImage: "url('/images/road.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        alignItems: "flex-end",
        overflow: "hidden",
        cursor: "pointer",
        color: "white",
        fontFamily: "Tahoma, Arial, sans-serif",
        outline: "none"
      }}
    >
      <div
        style={{
          width: "100%",
          boxSizing: "border-box",
          background: "rgba(0,0,0,0.78)",
          color: "white",
          padding: "clamp(16px, 4vw, 40px)",
          fontSize: "clamp(16px, 2.5vw, 28px)",
          lineHeight: "1.6"
        }}
      >
        <div style={{ fontSize: 11, color: "#d8d8d8", marginBottom: 8 }}>Winter_Letter</div>
        {script[index]}
        {index < script.length - 1 && <div style={{ textAlign: "right", fontSize: 12, marginTop: 12, color: "#d8d8d8" }}>Click to continue ▸</div>}
      </div>
    </div>
  );
}
