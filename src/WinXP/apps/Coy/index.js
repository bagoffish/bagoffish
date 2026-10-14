import React, { useEffect, useRef, useState } from 'react';

const API_BASE = (process.env.REACT_APP_API_BASE || 'https://fossils.onrender.com').replace(/\/$/, '');
const GREETINGS = ['Sup', 'Hi', 'Hello', 'Haii', 'Hai', 'Yo'];
const randomGreeting = () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
const ALLOWED_COY_EMOJIS = ["😭", "💀", "👀", "🖤", "💔", "🥀"];
function removeUnwantedCoyEmojis(value) {
  let text = String(value ?? "");
  const protectedTokens = [];
  ALLOWED_COY_EMOJIS.forEach((emoji, index) => {
    const token = `__COY_ALLOWED_EMOJI_${index}__`;
    text = text.split(emoji).join(token);
    protectedTokens.push([token, emoji]);
  });
  text = text.replace(/(?:\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*)|(?:\p{Regional_Indicator}{2})|\p{Emoji_Modifier}/gu, "");
  for (const [token, emoji] of protectedTokens) text = text.split(token).join(emoji);
  return text;
}

const renderCoyEmoji = value => String(value ?? "").split(/(:ono:)/gi).map((part, index) => part.toLowerCase() === ":ono:"
  ? <img key={index} src="/images/ono.png" onError={event => { event.currentTarget.replaceWith(document.createTextNode("😬")); }} alt="nervous, awkward, or startled" title="Nervous / awkward / startled" style={{ width: "1.6em", height: "1.6em", objectFit: "contain", verticalAlign: "-0.3em", display: "inline-block" }} />
  : part);

// ... (full content continues - this is a placeholder note for the call construction)
