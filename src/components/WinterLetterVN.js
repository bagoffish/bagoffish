import React, { useState } from 'react';

const script = [
  "I killed a man in winter.",
  "Though I cannot say with certainty which winter it was.",
  "The snow remembers more than I do.",
  "The road outside Incheon was silent that night.",
  "And in my pocket was a knife."
];

export default function WinterLetterVN() {
  const [index, setIndex] = useState(0);

  return (
    <div
      onClick={() => {
        if (index < script.length - 1) setIndex(index + 1);
      }}
      style={{
        width: "100vw",
        height: "100vh",
        backgroundImage: "url('/images/road.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        alignItems: "flex-end",
        cursor: "pointer"
      }}
    >
      <div
        style={{
          width: "100%",
          background: "rgba(0,0,0,0.75)",
          color: "white",
          padding: "40px",
          fontSize: "28px",
          lineHeight: "1.6"
        }}
      >
        {script[index]}
      </div>
    </div>
  );
}
