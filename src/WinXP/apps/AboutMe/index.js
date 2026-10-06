import React, { useMemo, useState } from "react";
import styled from "styled-components";

import { WindowDropDowns } from "components";
import dropDownData from "./dropDownData";

/* icons */
import ie from "assets/windowsIcons/ie-paper.png";
import ie16 from "assets/windowsIcons/ie-paper(16x16).png";
import computer from "assets/windowsIcons/computer.png";
import back from "assets/windowsIcons/back.png";
import forward from "assets/windowsIcons/forward.png";
import up from "assets/windowsIcons/up.png";
import search from "assets/windowsIcons/search.png";
import links from "assets/windowsIcons/links.png";
import folder from "assets/windowsIcons/folder-open.png";

function AboutMe({
  onClose,
  onMaximize,
  onMinimize,
  isMaximized,
}) {
  const [url, setUrl] = useState("about:blank");
  const [displayUrl, setDisplayUrl] = useState("about:coy");

  const functionMap = useMemo(
    () => ({
      Close: onClose,
    }),
    [onClose]
  );

  function go(target) {
    setDisplayUrl(target);
  }

  return (
    <Div>
      <section className="ie__toolbar">
        <div className="ie__options">
          <WindowDropDowns
            items={dropDownData}
            onClickItem={(item) => {
              const act = functionMap[item];
              if (typeof act === "function") act();
            }}
          />
        </div>
      </section>
      <section className="ie__function_bar">
        <div className="ie__function_bar__button" onClick={() => go("about:coy")}>
          <img className="ie__function_bar__icon" src={back} alt="" />
          <span className="ie__function_bar__text">Back</span>
        </div>
        <div className="ie__function_bar__button">
          <img className="ie__function_bar__icon" src={forward} alt="" />
          <span className="ie__function_bar__text">Forward</span>
        </div>
        <div className="ie__function_bar__button">
          <img className="ie__function_bar__icon" src={up} alt="" />
          <span className="ie__function_bar__text">Up</span>
        </div>
        <div className="ie__function_bar__button">
          <img className="ie__function_bar__icon" src={search} alt="" />
          <span className="ie__function_bar__text">Search</span>
        </div>
        <div className="ie__function_bar__button">
          <img className="ie__function_bar__icon" src={folder} alt="" />
          <span className="ie__function_bar__text">Favorites</span>
        </div>
        <div className="ie__function_bar__button">
          <img className="ie__function_bar__icon" src={links} alt="" />
          <span className="ie__function_bar__text">Media</span>
        </div>
      </section>
      <section className="ie__address_bar">
        <div className="ie__address_bar__title">Address</div>
        <div className="ie__address_bar__content">
          <img src={ie16} alt="ie" className="ie__address_bar__content__img" />
          <input
            className="ie__address_bar__content__text"
            value={displayUrl}
            onChange={(e) => setDisplayUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") go(displayUrl);
            }}
          />
          <div className="ie__address_bar__content__go">Go</div>
        </div>
      </section>
      <div className="ie__content">
        <div className="ie__content__inner">
          <div className="about">
            <div className="about__header">
              <img src={computer} alt="" className="about__avatar" />
              <div>
                <h1 className="about__name">coy</h1>
                <p className="about__tagline">bagof.fish</p>
              </div>
            </div>
            <div className="about__section">
              <h2>About</h2>
              <p>
                Welcome to my Windows XP desktop. This is a little corner of the
                web that pretends it is still 2001.
              </p>
            </div>
            <div className="about__section">
              <h2>Interests</h2>
              <ul>
                <li>Old computers & OS nostalgia</li>
                <li>Roblox history / classic avatars</li>
                <li>Music & MIDI experiments</li>
                <li>Building weird web toys</li>
              </ul>
            </div>
            <div className="about__section">
              <h2>Links</h2>
              <ul>
                <li>
                  <a href="https://bagof.fish" target="_blank" rel="noreferrer">
                    bagof.fish
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/bagoffish"
                    target="_blank"
                    rel="noreferrer"
                  >
                    github.com/bagoffish
                  </a>
                </li>
              </ul>
            </div>
            <div className="about__footer">
              <img src={ie} alt="" width={16} height={16} /> Internet Explorer
            </div>
          </div>
        </div>
      </div>
      <footer className="ie__status">
        <div className="ie__status__left">Done</div>
        <div className="ie__status__right">Internet</div>
      </footer>
    </Div>
  );
}

const Div = styled.div`
  height: 100%;
  width: 100%;
  position: absolute;
  display: flex;
  overflow: hidden;
  flex-direction: column;
  background: linear-gradient(to right, #edede5 0%, #ede8cd 100%);

  .ie__toolbar {
    position: relative;
    display: flex;
    align-items: center;
    line-height: 100%;
    height: 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.7);
    flex-shrink: 0;
  }
  .ie__options {
    height: 23px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.15);
    border-right: 1px solid rgba(0, 0, 0, 0.15);
    padding: 1px 0 1px 2px;
    border-left: 0;
    flex: 1;
  }
  .ie__function_bar {
    height: 36px;
    display: flex;
    align-items: center;
    font-size: 11px;
    padding: 1px 3px 0;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  }
  .ie__function_bar__button {
    display: flex;
    height: 100%;
    align-items: center;
    border: 1px solid transparent;
    border-radius: 3px;
    padding: 0 4px;
    margin-right: 2px;
    cursor: url("/images/Link Select.cur") 3 3, pointer;
  }
  .ie__function_bar__button:hover {
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: inset 0 -1px 1px rgba(0, 0, 0, 0.1);
  }
  .ie__function_bar__icon {
    height: 22px;
    width: 22px;
  }
  .ie__function_bar__text {
    margin-left: 3px;
  }
  .ie__address_bar {
    height: 24px;
    display: flex;
    align-items: center;
    padding: 0 4px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  }
  .ie__address_bar__title {
    color: rgba(0, 0, 0, 0.5);
    padding: 4px;
    font-size: 11px;
  }
  .ie__address_bar__content {
    flex: 1;
    border: solid 1px rgba(0, 0, 0, 0.4);
    background: #fff;
    display: flex;
    align-items: center;
    padding: 0 2px;
  }
  .ie__address_bar__content__img {
    width: 14px;
    height: 14px;
  }
  .ie__address_bar__content__text {
    flex: 1;
    border: none;
    outline: none;
    font-size: 11px;
    padding: 0 3px;
    background: transparent;
  }
  .ie__address_bar__content__go {
    font-size: 11px;
    padding: 0 6px;
    height: 18px;
    display: flex;
    align-items: center;
    border: 1px solid transparent;
    border-radius: 2px;
    cursor: url("/images/Link Select.cur") 3 3, pointer;
  }
  .ie__content {
    flex: 1;
    overflow: auto;
    padding: 0;
    position: relative;
  }
  .ie__content__inner {
    min-height: 100%;
    background: #fff;
  }
  .about {
    max-width: 640px;
    margin: 0 auto;
    padding: 24px 20px;
    font-family: Tahoma, Arial, sans-serif;
    font-size: 13px;
    color: #000;
  }
  .about__header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid #ccc;
  }
  .about__avatar {
    width: 48px;
    height: 48px;
  }
  .about__name {
    margin: 0;
    font-size: 22px;
  }
  .about__tagline {
    margin: 2px 0 0;
    color: #555;
  }
  .about__section {
    margin-bottom: 16px;
  }
  .about__section h2 {
    font-size: 14px;
    margin: 0 0 6px;
    color: #003399;
  }
  .about__section p,
  .about__section ul {
    margin: 0;
    line-height: 1.5;
  }
  .about__section a {
    color: #0066cc;
  }
  .about__footer {
    margin-top: 24px;
    padding-top: 10px;
    border-top: 1px solid #ccc;
    font-size: 11px;
    color: #666;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .ie__status {
    height: 20px;
    display: flex;
    border-top: 1px solid transparent;
    background: #f1efe2;
    font-size: 11px;
    padding: 0 4px;
  }
  .ie__status__left {
    flex: 1;
    display: flex;
    align-items: center;
  }
  .ie__status__right {
    display: flex;
    align-items: center;
    padding: 0 8px;
    border-left: 1px solid rgba(0, 0, 0, 0.1);
  }
`;

export default AboutMe;
