import React, { useEffect, useMemo } from "react";
import styled from "styled-components";

import { WindowDropDowns } from "components";
import dropDownData from "./dropDownData";

// IE icons
import ie from "assets/windowsIcons/ie-paper.png";
import printer from "assets/windowsIcons/17(32x32).png";
import go from "assets/windowsIcons/290.png";
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

function Renderer({ onClose }) {
  // Address text shown in IE bar
  const addressText = useMemo(() => "https://bagof.fish/renderer", []);

  useEffect(() => {
    // inject legacy script once
    if (document.getElementById("legacy-renderer-script")) return;

    const s = document.createElement("script");
    s.id = "legacy-renderer-script";
    s.src = "/js/renderer.js?v=20261012-headshot-grid-v14"; // themed square archive cards, capture dates, contextual Coy reactions
    s.async = true;
    document.body.appendChild(s);
  }, []);

  function onClickOptionItem(item) {
    switch (item) {
      case "Close":
        onClose?.();
        break;
      // For IE menu items you already handle in other apps
      case "Home Page":
      case "Back":
      default:
    }
  }

  return (
    <Div>
      <section className="ie__toolbar">
        <div className="ie__options">
          <WindowDropDowns
            items={dropDownData}
            onClickItem={onClickOptionItem}
            height={21}
          />
        </div>
        <img className="ie__windows-logo" src={windows} alt="windows" />
      </section>

      <section className="ie__function_bar">
        <div className="ie__function_bar__button--disable">
          <img className="ie__function_bar__icon" src={back} alt="" />
          <div className="ie__function_bar__arrow" />
        </div>

        <div className="ie__function_bar__button--disable">
          <img className="ie__function_bar__icon" src={forward} alt="" />
          <div className="ie__function_bar__arrow" />
        </div>

        <div className="ie__function_bar__button--disable">
          <img className="ie__function_bar__icon--margin-1" src={stop} alt="" />
        </div>

        <div className="ie__function_bar__button--disable">
          <img
            className="ie__function_bar__icon--margin-1"
            src={refresh}
            alt=""
          />
        </div>

        <div className="ie__function_bar__button--disable">
          <img className="ie__function_bar__icon--margin-1" src={home} alt="" />
        </div>

        <div className="ie__function_bar__separate" />

        <div className="ie__function_bar__button--disable">
          <img
            className="ie__function_bar__icon--normalize"
            src={search}
            alt=""
          />
          <span className="ie__function_bar__text">Search</span>
        </div>

        <div className="ie__function_bar__button--disable">
          <img
            className="ie__function_bar__icon--normalize"
            src={favorite}
            alt=""
          />
          <span className="ie__function_bar__text">Favorites</span>
        </div>

        <div className="ie__function_bar__button--disable">
          <img className="ie__function_bar__icon" src={history} alt="" />
        </div>

        <div className="ie__function_bar__separate" />

        <div className="ie__function_bar__button--disable">
          <img className="ie__function_bar__icon--margin-1" src={mail} alt="" />
          <div className="ie__function_bar__arrow--margin-11" />
        </div>

        <div className="ie__function_bar__button--disable">
          <img className="ie__function_bar__icon--margin12" src={printer} alt="" />
        </div>

        <div className="ie__function_bar__button--disable">
          <img className="ie__function_bar__icon" src={edit} alt="" />
        </div>

        <div className="ie__function_bar__button--disable">
          <img className="ie__function_bar__icon--margin12" src={msn} alt="" />
        </div>
      </section>

      <section className="ie__address_bar">
        <div className="ie__address_bar__title">Address</div>

        <div className="ie__address_bar__content" title={addressText}>
          <img src={ie} alt="ie" className="ie__address_bar__content__img" />
          <div className="ie__address_bar__content__text">{addressText}</div>
          <img
            src={dropdown}
            alt="dropdown"
            className="ie__address_bar__content__img"
          />
        </div>

        <div className="ie__address_bar__go">
          <img className="ie__address_bar__go__img" src={go} alt="go" />
          <span className="ie__address_bar__go__text">Go</span>
        </div>

        <div className="ie__address_bar__separate" />

      </section>

      <div className="ie__content">
        <div className="ie__content__inner">
          {/* XP-style Renderer app content */}
          <div className="rendererRoot">
            <div className="rendererPanel">
              <div className="rendererContent">
                <div id="renderer-container" className="rendererContainer">
                  <h1 className="rendererTitle">AVATAR RENDERER</h1>

                  <div id="input-wrapper" className="inputWrapper">
                    <div id="input-row" className="inputRow">
                      <input
                        id="usernameInput"
                        placeholder="ENTER USERNAME"
                        className="xpInput"
                      />
                      <button id="checkBtn" className="xpButton" type="button">
                        CHECK USER
                      </button>
                    </div>

                    <div id="messageBox" className="messageBox" />
                  </div>

                  <div id="loadingIndicator" className="loadingIndicator">
                    <span>ACCESSING DATABASE</span>
                    <span id="spinner" className="spinner">-</span>
                  </div>

                  <div id="centerPanel" className="centerPanel" />
                </div>
              </div>

            </div>

            <style>{legacyCss}</style>
          </div>
        </div>
      </div>

      <footer className="ie__footer">
        <div className="ie__footer__status">
          <img className="ie__footer__status__img" src={ie} alt="" />
          <span className="ie__footer__status__text">Done</span>
        </div>
        <div className="ie__footer__block" />
        <div className="ie__footer__block" />
        <div className="ie__footer__block" />
        <div className="ie__footer__block" />
        <div className="ie__footer__right">
          <img className="ie__footer__right__img" src={earth} alt="" />
          <span className="ie__footer__right__text">Internet</span>
          <div className="ie__footer__right__dots" />
        </div>
      </footer>
    </Div>
  );
}

const legacyCss = `
@keyframes shake {
  0% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  50% { transform: translateX(5px); }
  75% { transform: translateX(-5px); }
  100% { transform: translateX(0); }
}
.shake { animation: shake 0.5s; }

.rendererRoot{
  height: 100%;
  padding: 10px;
  box-sizing: border-box;
}
.rendererPanel{
  height: 100%;
  display: flex;
  flex-direction: column;
  border: 1px solid #808080;
  box-shadow: inset 0 0 0 1px #fff;
  background: #ece9d8;
}
.rendererContent{
  flex: 1;
  background: #fff;
  border-top: 1px solid #fff;
  padding: 10px;
  overflow: auto;
  font-family: Tahoma, Verdana, sans-serif;
  color: #000;
}
.rendererContainer{
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.rendererTitle{
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: bold;
}
.inputWrapper{
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.inputRow{
  display: flex;
  gap: 8px;
  width: 100%;
}
.xpInput{
  flex: 1;
  height: 30px;
  font-size: 12px;
  padding: 0 8px;
  border: 1px inset #808080;
  font-family: Tahoma, Verdana, sans-serif;
  outline: none;
  box-sizing: border-box;
}
.xpButton{
  width: 120px;
  height: 30px;
  font-size: 12px;
  font-family: Tahoma, Verdana, sans-serif;
  border: 1px solid #000;
  background: linear-gradient(#f5f5f5, #c0c0c0);
  cursor: url("/images/Link Select.cur") 3 3, pointer;
}
.messageBox{
  display: none; /* renderer.js toggles to flex */
  height: 30px;
  border: 1px solid #c75050;
  color: #c75050;
  font-weight: bold;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  box-sizing: border-box;
  background: #fff;
}
.loadingIndicator{
  display: none; /* renderer.js toggles to flex */
  gap: 8px;
  font-weight: bold;
  font-family: Tahoma, Verdana, sans-serif;
  font-size: 12px;
  align-items: center;
  justify-content: center;
}
.spinner{
  display: inline-block;
  width: 14px;
  text-align: center;
}
.centerPanel{
  width: 100%;
  box-sizing: border-box;
}

/* Your result boxes (used by renderer.js) */
.info-box{
  width: 100%;
  border: 1px solid #808080;
  box-shadow: inset 0 0 0 1px #fff;
  background: #ece9d8;
  padding: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  font-family: Tahoma, Verdana, sans-serif;
  font-size: 12px;
}
.avatar-container img{
  width: 120px;
  height: 120px;
  border: 1px solid #808080;
  box-shadow: inset 0 0 0 1px #fff;
  object-fit: cover;
  cursor: url("/images/Link Select.cur") 3 3, pointer;
  background: #fff;
}
.old-avatar-thumb{
  width: 100%;
  height: 140px;
  border: 1px solid #808080;
  box-shadow: inset 0 0 0 1px #fff;
  object-fit: contain;
  cursor: url("/images/Link Select.cur") 3 3, pointer;
  background: #fff;
}
#oldAvatars{
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
  justify-items: stretch;
  margin-top: 10px;
}
.info-line{ text-align: center; }

/* Scrollbars */
::-webkit-scrollbar{ width: 16px; }
::-webkit-scrollbar-track{ background: #ece9d8; }
::-webkit-scrollbar-thumb{
  background: linear-gradient(#f5f5f5, #c0c0c0);
  border: 1px solid #808080;
}
/* Renderer controls */
.rendererPanel{border-color:#316ac5;border-radius:6px 6px 0 0;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.28),inset 0 0 0 1px #fff;}
.rendererContent{padding:14px;background:linear-gradient(180deg,#f7fbff,#fff 35%);}
.rendererTitle{width:100%;box-sizing:border-box;padding:7px 10px;margin:0 0 2px;color:#fff;text-shadow:1px 1px 1px #194a91;letter-spacing:.2px;border:1px solid #174ea6;border-radius:5px 5px 2px 2px;background:linear-gradient(180deg,#7db3f4,#3c7bd6 45%,#245edc);box-shadow:inset 0 1px 0 rgba(255,255,255,.75),0 1px 2px rgba(0,0,0,.2);}
.inputWrapper{padding:9px;border:1px solid #a6a6a6;border-radius:4px;background:linear-gradient(180deg,#f9f9f9,#e9e9e9);box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(0,0,0,.12);}
.xpInput{border:1px solid #7f9db9;border-radius:2px;box-shadow:inset 1px 1px 2px rgba(0,0,0,.12),0 1px 0 #fff;}
.xpInput:focus{border-color:#3c7bd6;box-shadow:inset 1px 1px 2px rgba(0,0,0,.12),0 0 0 1px rgba(60,123,214,.18);}
.xpButton{border:1px solid #5b7da8;border-radius:3px;color:#123b70;text-shadow:0 1px #fff;background:linear-gradient(180deg,#fff,#edf5ff 45%,#c9def7);box-shadow:inset 0 1px 0 #fff,0 1px 1px rgba(0,0,0,.18);}
.xpButton:hover{border-color:#315f9e;background:linear-gradient(180deg,#fff,#e8f3ff 45%,#b9d7f7);}
.xpButton:active{padding-top:1px;box-shadow:inset 0 1px 3px rgba(0,0,0,.25);}
.messageBox{border-radius:3px;background:linear-gradient(180deg,#fff,#fff0f0);box-shadow:inset 0 1px 0 #fff;}
.info-box{padding:12px;border:1px solid #7d9bc2;border-radius:5px;background:linear-gradient(180deg,#f8fbff,#e7f0fb);box-shadow:inset 0 1px 0 #fff,0 2px 4px rgba(0,0,0,.16);}
.avatar-container{padding:4px;border:1px solid #7598c6;border-radius:4px;background:linear-gradient(135deg,#fff,#d9e7f8);box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(0,0,0,.2);}
.avatar-container img,.old-avatar-thumb{border-color:#5d7fa9;box-shadow:inset 0 0 0 1px #fff;}
.avatar-container img:hover,.old-avatar-thumb:hover{border-color:#245edc;box-shadow:0 0 0 1px #7db3f4,inset 0 0 0 1px #fff;}
.rendererName{margin-top:2px;font-size:13px;}
.info-line{width:min(100%,520px);padding:5px 8px;text-align:left;border:1px solid #d1dbe8;border-radius:2px;background:rgba(255,255,255,.72);box-sizing:border-box;}
.info-line b{color:#174a88;}
#terminationLine{text-align:center;}
#terminationLine:empty{display:none;}
.rendererTermination{display:inline-block;margin:2px auto 0;padding:4px 10px;border:1px solid #c33;border-radius:3px;color:#fff;background:linear-gradient(#e45b5b,#a90000);text-shadow:1px 1px #700;box-shadow:inset 0 1px 0 rgba(255,255,255,.45);font-weight:bold;}
#oldAvatars{gap:7px;padding-top:8px;margin-top:5px;border-top:1px solid #aebfd4;}
.old-avatar-thumb{transition:transform .08s ease,box-shadow .08s ease;}
.old-avatar-thumb:hover{transform:translateY(-1px);}
`;

const Div = styled.div`
  height: 100%;
  width: 100%;
  position: absolute;
  display: flex;
  overflow: hidden;
  flex-direction: column;
  background: linear-gradient(to right, #edede5 0%, #ede8cd 100%);

  /* --- YOUR IE CSS (unchanged) --- */
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
    padding-left: 2px;
    flex: 1;
  }
  .ie__windows-logo {
    height: 100%;
    border-left: 1px solid white;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
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
    border: 1px solid rgba(0, 0, 0, 0);
    border-radius: 3px;
    &:hover {
      border: 1px solid rgba(0, 0, 0, 0.1);
      box-shadow: inset 0 -1px 1px rgba(0, 0, 0, 0.1);
    }
    &:hover:active {
      border: 1px solid rgb(185, 185, 185);
      background-color: #dedede;
      box-shadow: inset 0 -1px 1px rgba(255, 255, 255, 0.7);
      color: rgba(255, 255, 255, 0.7);
      & > * {
        transform: translate(1px, 1px);
      }
    }
  }
  .ie__function_bar__button--disable {
    filter: grayscale(1);
    opacity: 0.7;
    display: flex;
    height: 100%;
    align-items: center;
    border: 1px solid rgba(0, 0, 0, 0);
  }
  .ie__function_bar__text {
    margin-right: 4px;
  }
  .ie__function_bar__icon {
    height: 30px;
    width: 30px;
    &--normalize {
      height: 22px;
      width: 22px;
      margin: 0 4px 0 1px;
    }
    &--margin12 {
      height: 22px;
      width: 22px;
      margin: 0 1px 0 2px;
    }
    &--margin-1 {
      margin: 0 -1px;
      height: 30px;
      width: 30px;
    }
  }
  .ie__function_bar__separate {
    height: 90%;
    width: 1px;
    background-color: rgba(0, 0, 0, 0.2);
    margin: 0 2px;
  }
  .ie__function_bar__arrow {
    height: 100%;
    display: flex;
    align-items: center;
    margin: 0 4px;
    &:before {
      content: "";
      display: block;
      border-width: 3px 3px 0;
      border-color: #000 transparent;
      border-style: solid;
    }
  }
  .ie__function_bar__arrow--margin-11 {
    height: 100%;
    display: flex;
    align-items: center;
    margin: 0 1px 0 -1px;
    &:before {
      content: "";
      display: block;
      border-width: 3px 3px 0;
      border-color: #000 transparent;
      border-style: solid;
    }
  }
  .ie__address_bar {
    border-top: 1px solid rgba(255, 255, 255, 0.7);
    height: 22px;
    font-size: 11px;
    display: flex;
    align-items: center;
    padding: 0 2px 2px;
    box-shadow: inset 0 -2px 3px -1px #2d2d2d;
  }
  .ie__address_bar__title {
    line-height: 100%;
    color: rgba(0, 0, 0, 0.5);
    padding: 5px;
  }
  .ie__address_bar__content {
    border: rgba(122, 122, 255, 0.6) 1px solid;
    height: 100%;
    display: flex;
    flex: 1;
    align-items: center;
    background-color: white;
    position: relative;
    &__img {
      width: 14px;
      height: 14px;
    }
    &__img:last-child {
      width: 15px;
      height: 15px;
      right: 1px;
      position: absolute;
    }
    &__img:last-child:hover {
      filter: brightness(1.1);
    }
    &__text {
      position: absolute;
      white-space: nowrap;
      left: 16px;
      right: 17px;
      overflow: hidden;
    }
  }
  .ie__address_bar__go {
    display: flex;
    align-items: center;
    padding: 0 18px 0 5px;
    height: 100%;
    position: relative;
    &__img {
      height: 95%;
      border: 1px solid rgba(255, 255, 255, 0.2);
      margin-right: 3px;
    }
  }
  .ie__address_bar__separate {
    height: 100%;
    width: 1px;
    background-color: rgba(0, 0, 0, 0.1);
    box-shadow: 1px 0 rgba(255, 255, 255, 0.7);
  }
  .ie__content {
    flex: 1;
    overflow: auto;
    padding-left: 1px;
    border-left: 1px solid #6f6f6f;
    background-color: #f1f1f1;
    position: relative;
  }
  .ie__content__inner {
    position: relative;
    min-height: 100%;
    min-width: 100%;
    width: 100%;
    height: 100%;
  }
  .ie__footer {
    height: 20px;
    border-top: 1px solid transparent;
    box-shadow: inset 0 1px 3px rgba(50, 50, 50, 0.8);
    background-color: rgb(236, 233, 216);
    display: flex;
    align-items: center;
    padding-top: 2px;
  }
  .ie__footer__status {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: center;
    padding-left: 2px;
    &__text {
      font-size: 11px;
    }
    &__img {
      height: 14px;
      width: 14px;
      margin-right: 3px;
    }
  }
  .ie__footer__block {
    height: 85%;
    width: 22px;
    border-left: 1px solid rgba(0, 0, 0, 0.15);
    box-shadow: inset 1px 0 rgba(255, 255, 255, 0.7);
  }
  @media (max-width: 700px) {
    .rendererRoot { padding: 4px; }
    .rendererContent { padding: 6px; }
    .rendererContainer { max-width: none; }
    .inputRow { flex-direction: column; gap: 6px; }
    .xpInput, .xpButton { width: 100%; min-height: 36px; height: 36px; font-size: 13px; }
    #oldAvatars {
      grid-template-columns: repeat(2, minmax(80px, 1fr));
      width: 100%;
    }
    .avatar-container img, .old-avatar-thumb {
      width: 84px;
      height: 84px;
    }
    .info-box { overflow-wrap: anywhere; }
    .ie__function_bar { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  }

  .ie__footer__right {
    display: flex;
    align-items: center;
    width: 150px;
    height: 80%;
    border-left: 1px solid rgba(0, 0, 0, 0.11);
    box-shadow: inset 1px 0 rgba(255, 255, 255, 0.7);
    padding-left: 5px;
    position: relative;
    &__text {
      font-size: 11px;
    }
    &__img {
      height: 14px;
      width: 14px;
      margin-right: 3px;
    }
    &__dots {
      position: absolute;
      right: 11px;
      bottom: -1px;
      width: 2px;
      height: 2px;
      box-shadow: 2px 0px rgba(0, 0, 0, 0.25),
        5.5px 0px rgba(0, 0, 0, 0.25), 9px 0px rgba(0, 0, 0, 0.25),
        5.5px -3.5px rgba(0, 0, 0, 0.25), 9px -3.5px rgba(0, 0, 0, 0.25),
        9px -7px rgba(0, 0, 0, 0.25), 3px 1px rgba(255, 255, 255, 1),
        6.5px 1px rgba(255, 255, 255, 1), 10px 1px rgba(255, 255, 255, 1),
        10px -2.5px rgba(255, 255, 255, 1), 10px -6px rgba(255, 255, 255, 1);
    }
  }
`;

export default Renderer;

