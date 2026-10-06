import React, { useMemo, useState } from "react";
import styled from "styled-components";

import { WindowDropDowns } from "components";
import dropDownData from "./dropDownData";

/* icons */
import ie from "assets/windowsIcons/ie-paper.png";
import printer from "assets/windowsIcons/17(32x32).png";
import go from "assets/windowsIcons/290.png";
import links from "assets/windowsIcons/links.png";
import search from "assets/windowsIcons/299(32x32).png";
import favorite from "assets/windowsIcons/744(32x32).png";
import back from "assets/windowsIcons/back.png";
import earth from "assets/windowsIcons/earth.png";
import edit from "assets/windowsIcons/edit.png";
import forward from "assets/windowsIcons/forward.png";
import history from "assets/windowsIcons/history.png";
import home from "assets/windowsIcons/home.png";
import mail from "assets/windowsIcons/mail.png";
import msn from "assets/windowsIcons/msn.png";
import refresh from "assets/windowsIcons/refresh.png";
import stop from "assets/windowsIcons/stop.png";
import windows from "assets/windowsIcons/windows.png";
import dropdown from "assets/windowsIcons/dropdown.png";

function AboutMe({ onClose }) {
  const [url, setUrl] = useState("about:coy");

  const functionMap = useMemo(
    () => ({
      Close: onClose,
    }),
    [onClose]
  );

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
        <div className="ie__function_bar__button">
          <img className="ie__function_bar__icon" src={back} alt="" height={22} />
          <span className="ie__function_bar__text">Back</span>
          <div className="ie__function_bar__arrow" />
        </div>
        <div className="ie__function_bar__button">
          <img className="ie__function_bar__icon" src={forward} alt="" height={22} />
          <div className="ie__function_bar__arrow" />
        </div>
        <div className="ie__function_bar__button">
          <img className="ie__function_bar__icon" src={stop} alt="" height={22} />
        </div>
        <div className="ie__function_bar__button">
          <img className="ie__function_bar__icon" src={refresh} alt="" height={22} />
        </div>
        <div className="ie__function_bar__button">
          <img className="ie__function_bar__icon" src={home} alt="" height={22} />
        </div>
        <div className="ie__function_bar__separate" />
        <div className="ie__function_bar__button">
          <img className="ie__function_bar__icon" src={search} alt="" height={22} />
          <span className="ie__function_bar__text">Search</span>
        </div>
        <div className="ie__function_bar__button">
          <img className="ie__function_bar__icon" src={favorite} alt="" height={22} />
          <span className="ie__function_bar__text">Favorites</span>
        </div>
        <div className="ie__function_bar__button">
          <img className="ie__function_bar__icon" src={history} alt="" height={22} />
          <span className="ie__function_bar__text">History</span>
        </div>
        <div className="ie__function_bar__separate" />
        <div className="ie__function_bar__button">
          <img className="ie__function_bar__icon" src={mail} alt="" height={22} />
          <div className="ie__function_bar__arrow" />
        </div>
        <div className="ie__function_bar__button">
          <img className="ie__function_bar__icon" src={msn} alt="" height={22} />
        </div>
        <div className="ie__function_bar__button">
          <img className="ie__function_bar__icon" src={printer} alt="" height={22} />
        </div>
      </section>
      <section className="ie__address_bar">
        <div className="ie__address_bar__title">Address</div>
        <div className="ie__address_bar__content">
          <img src={ie} alt="ie" className="ie__address_bar__ie-icon" />
          <input
            className="ie__address_bar__input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <img className="ie__address_bar__dropdown" src={dropdown} alt="" />
        </div>
        <div className="ie__address_bar__go">
          <img src={go} alt="Go" height={20} />
          <span>Go</span>
        </div>
        <div className="ie__address_bar__links">
          <img src={links} alt="" height={20} />
          <span>Links</span>
        </div>
      </section>
      <div className="ie__content">
        <div className="about">
          <div className="about__hero">
            <img src={earth} alt="" className="about__earth" />
            <div>
              <h1>coy</h1>
              <p className="about__sub">bagof.fish · Windows XP desktop</p>
            </div>
          </div>
          <div className="about__block">
            <h2>About</h2>
            <p>
              This site is a Windows XP–style desktop in the browser. Open apps
              from the Start menu or the desktop icons.
            </p>
          </div>
          <div className="about__block">
            <h2>Interests</h2>
            <ul>
              <li>Classic OS / UI nostalgia</li>
              <li>Roblox history &amp; old avatars</li>
              <li>Music, MIDI, and weird web tools</li>
            </ul>
          </div>
          <div className="about__block">
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
        </div>
      </div>
      <footer className="ie__status">
        <div className="ie__status__left">
          <img src={ie} alt="" width={14} height={14} />
          <span>Done</span>
        </div>
        <div className="ie__status__right">
          <img src={earth} alt="" width={14} height={14} />
          <span>Internet</span>
        </div>
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
  .ie__function_bar__arrow {
    width: 0;
    height: 0;
    border-left: 3px solid transparent;
    border-right: 3px solid transparent;
    border-top: 3px solid #000;
    margin-left: 4px;
  }
  .ie__function_bar__separate {
    height: 28px;
    width: 1px;
    background: rgba(0, 0, 0, 0.15);
    margin: 0 4px;
  }
  .ie__address_bar {
    height: 24px;
    display: flex;
    align-items: center;
    padding: 0 4px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    gap: 4px;
  }
  .ie__address_bar__title {
    color: rgba(0, 0, 0, 0.5);
    padding: 0 4px;
    font-size: 11px;
  }
  .ie__address_bar__content {
    flex: 1;
    border: solid 1px rgba(0, 0, 0, 0.4);
    background: #fff;
    display: flex;
    align-items: center;
    padding: 0 2px;
    height: 20px;
  }
  .ie__address_bar__ie-icon {
    width: 14px;
    height: 14px;
  }
  .ie__address_bar__input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 11px;
    padding: 0 3px;
    background: transparent;
  }
  .ie__address_bar__dropdown {
    width: 14px;
    height: 14px;
  }
  .ie__address_bar__go,
  .ie__address_bar__links {
    display: flex;
    align-items: center;
    gap: 2px;
    font-size: 11px;
    padding: 0 4px;
    height: 20px;
    border: 1px solid transparent;
    border-radius: 2px;
    cursor: url("/images/Link Select.cur") 3 3, pointer;
  }
  .ie__address_bar__go:hover,
  .ie__address_bar__links:hover {
    border-color: rgba(0, 0, 0, 0.15);
  }
  .ie__content {
    flex: 1;
    overflow: auto;
    background: #fff;
  }
  .about {
    max-width: 720px;
    margin: 0 auto;
    padding: 28px 24px;
    font-family: Tahoma, Arial, sans-serif;
    font-size: 13px;
    color: #000;
  }
  .about__hero {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid #ccc;
  }
  .about__earth {
    width: 48px;
    height: 48px;
  }
  .about h1 {
    margin: 0;
    font-size: 24px;
  }
  .about__sub {
    margin: 4px 0 0;
    color: #555;
  }
  .about__block {
    margin-bottom: 18px;
  }
  .about__block h2 {
    font-size: 14px;
    margin: 0 0 8px;
    color: #003399;
  }
  .about__block p,
  .about__block ul {
    margin: 0;
    line-height: 1.55;
  }
  .about__block a {
    color: #0066cc;
  }
  .ie__status {
    height: 22px;
    display: flex;
    background: #f1efe2;
    font-size: 11px;
    padding: 0 6px;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
  }
  .ie__status__left,
  .ie__status__right {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .ie__status__left {
    flex: 1;
  }
  .ie__status__right {
    padding-left: 10px;
    border-left: 1px solid rgba(0, 0, 0, 0.1);
  }
`;

export default AboutMe;
