import React, { useMemo, useState, useEffect } from "react";
import styled from "styled-components";

import { WindowDropDowns } from "components";
import dropDownData from "./dropDownData";

const writings = [
  "Chrysalis of Light",
  "Rising from Ashes",
  "If I Forget",
  "The Edge of Meaning",
  "Sweetness of the Grave",
  "After You",
  "Echoes Between Us",
  "I Ought to Be Thy Adam",
  "Some thoughts",
  "I don't think you can get away with it for long",
  "Talking about love",
  "After reading 920London",
  "After reading Your Wings My Wings",
  "Untitled",
  "Goodnight",
];

export default function Writings({ onClose }) {
  const [wordWrap, setWordWrap] = useState(true);
  const [selectedWriting, setSelectedWriting] = useState("Chrysalis of Light");
  const [writingContent, setWritingContent] = useState("");

  useEffect(() => {
    loadWriting(selectedWriting);
  }, [selectedWriting]);

  async function loadWriting(title) {
    try {
      const response = await fetch(`/writings/${encodeURIComponent(title)}.txt`);
      const text = await response.text();
      setWritingContent(text);
    } catch (error) {
      console.error("Failed to load writing:", error);
      setWritingContent("Failed to load writing.");
    }
  }

  function onClickOptionItem(item) {
    switch (item) {
      case "Exit":
      case "Close":
        onClose?.();
        break;
      case "Word Wrap":
        setWordWrap(w => !w);
        break;
      default:
        if (writings.includes(item)) {
          setSelectedWriting(item);
        }
    }
  }

  const enhancedDropDownData = useMemo(() => {
    const fileMenu = [...dropDownData.File];
    const separatorIndex = fileMenu.findIndex(item => item.type === 'separator');
    if (separatorIndex !== -1) {
      const writingsMenuItems = writings.map(writing => ({
        type: 'item',
        text: writing,
      }));
      fileMenu.splice(separatorIndex, 0, ...writingsMenuItems, { type: 'separator' });
    }
    return { ...dropDownData, File: fileMenu };
  }, []);

  return (
    <Div>
      <section className="np__toolbar">
        <WindowDropDowns items={enhancedDropDownData} onClickItem={onClickOptionItem} />
      </section>

      <StyledTextarea
        readOnly
        wordWrap={wordWrap}
        value={writingContent}
        spellCheck={false}
      />
    </Div>
  );
}

const Div = styled.div`
  height: 100%;
  background: linear-gradient(to right, #edede5 0%, #ede8cd 100%);
  display: flex;
  flex-direction: column;
  align-items: stretch;

  .np__toolbar {
    position: relative;
    height: 21px;
    flex-shrink: 0;
    border-bottom: 1px solid white;
  }
`;

const StyledTextarea = styled.textarea`
  flex: auto;
  outline: none;
  font-family: "Courier New", monospace;
  font-size: 12px;
  line-height: 1.35;
  resize: none;
  padding: 10px;
  overflow-y: scroll;
  border: 1px solid #96abff;
  background: #fff;
  color: #000;

  ${({ wordWrap }) =>
    wordWrap ? "" : "white-space: nowrap; overflow-x: scroll;"}
`;
