import React, { useMemo } from "react";
import styled from "styled-components";

import { WindowDropDowns } from "components";
import dropDownData from "./dropDownData";

import ie from "assets/windowsIcons/ie-paper.png";
import back from "assets/windowsIcons/back.png";
import forward from "assets/windowsIcons/forward.png";
import stop from "assets/windowsIcons/stop.png";
import refresh from "assets/windowsIcons/refresh.png";
import home from "assets/windowsIcons/home.png";
import search from "assets/windowsIcons/299(32x32).png";
import favorite from "assets/windowsIcons/744(32x32).png";
import history from "assets/windowsIcons/history.png";
import mail from "assets/windowsIcons/mail.png";
import printer from "assets/windowsIcons/17(32x32).png";
import edit from "assets/windowsIcons/edit.png";
import msn from "assets/windowsIcons/msn.png";
import earth from "assets/windowsIcons/earth.png";
import windows from "assets/windowsIcons/windows.png";
import go from "assets/windowsIcons/290.png";
import links from "assets/windowsIcons/links.png";
import dropdown from "assets/windowsIcons/dropdown.png";

export default function Lain({ onClose }) {
  const addressText = useMemo(() => "https://bagof.fish/lain", []);

  return (
    <Div>
      <section className="ie__toolbar">
        <div className="ie__options">
          <WindowDropDowns items={dropDownData} onClickItem={(item) => item === "Close" && onClose?.()} />
        </div>
        <img className="ie__windows-logo" src={windows} alt="windows" />
      </section>

      <section className="ie__function_bar">
        <Tool icon={back} text="Back" arrow />
        <Tool icon={forward} arrow />
        <Tool icon={stop} />
        <Tool icon={refresh} />
        <Tool icon={home} />
        <div className="sep" />
        <Tool icon={search} text="Search" />
        <Tool icon={favorite} text="Favorites" />
        <Tool icon={history} />
        <div className="sep" />
        <Tool icon={mail} />
        <Tool icon={printer} />
        <Tool icon={edit} />
        <Tool icon={msn} />
      </section>

      <section className="ie__address_bar">
        <span className="address-title">Address</span>
        <div className="address">
          <img src={ie} alt="" />
          <span>{addressText}</span>
          <img src={dropdown} alt="" />
        </div>
        <div className="go"><img src={go} alt="" /><span>Go</span></div>
        <div className="sep-small" />
        <div className="links"><img src={links} alt="" /><span>Links</span></div>
      </section>

      <main className="content">
        <div className="lain-page">
          <div className="lain-title">serial experiments lain</div>
          <div className="lain-rule" />
          <img src="/images/lain.gif" alt="Serial Experiments Lain" className="lain-gif" />
          <div className="lain-caption">present day, present time…</div>
        </div>
      </main>

      <footer>
        <div className="status"><img src={ie} alt="" /> <span>Done</span></div>
        <div className="footer-spacer" />
        <div className="internet"><img src={earth} alt="" /> Internet</div>
      </footer>
    </Div>
  );
}

function Tool({ icon, text, arrow }) {
  return (
    <div className="tool">
      <img src={icon} alt="" />
      {text && <span>{text}</span>}
      {arrow && <i />}
    </div>
  );
}

const Div = styled.div`
  width: 100%;
  height: 100%;
  position: absolute;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #ece9d8;
  font-family: Tahoma, sans-serif;

  .ie__toolbar { height: 24px; display: flex; align-items: center; flex-shrink: 0; border-bottom: 1px solid rgba(255,255,255,.7); }
  .ie__options { flex: 1; height: 23px; padding-left: 2px; border-right: 1px solid rgba(0,0,0,.15); }
  .ie__windows-logo { height: 100%; border-left: 1px solid white; }
  .ie__function_bar { height: 36px; display: flex; align-items: center; gap: 2px; padding: 1px 3px 0; border-bottom: 1px solid rgba(0,0,0,.1); }
  .tool { height: 100%; display: flex; align-items: center; font-size: 11px; filter: grayscale(1); opacity: .72; }
  .tool img { width: 22px; height: 22px; }
  .tool span { margin-left: 2px; }
  .tool i { width: 0; height: 0; margin-left: 3px; border-left: 3px solid transparent; border-right: 3px solid transparent; border-top: 3px solid #000; }
  .sep { width: 1px; height: 28px; margin: 0 4px; background: rgba(0,0,0,.15); }
  .ie__address_bar { height: 24px; display: flex; align-items: center; gap: 4px; padding: 0 4px; border-bottom: 1px solid rgba(0,0,0,.1); flex-shrink: 0; font-size: 11px; }
  .address-title { color: rgba(0,0,0,.5); }
  .address { flex: 1; height: 18px; display: flex; align-items: center; padding: 0 2px; background: white; border: 1px solid #7f9db9; overflow: hidden; }
  .address img { width: 14px; height: 14px; }
  .address span { flex: 1; margin: 0 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .go, .links { display: flex; align-items: center; gap: 2px; }
  .go img { width: 16px; height: 16px; }
  .links img { width: 16px; height: 16px; }
  .sep-small { width: 1px; height: 18px; background: rgba(0,0,0,.15); }
  .content { flex: 1; overflow: auto; background: #000; }
  .lain-page { min-height: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; background: #000; color: #aaa; }
  .lain-title { font: 14px "Courier New", monospace; letter-spacing: 2px; margin-bottom: 8px; }
  .lain-rule { width: min(500px, 90%); border-top: 1px dotted #444; margin-bottom: 14px; }
  .lain-gif { max-width: 100%; height: auto; image-rendering: auto; }
  .lain-caption { margin-top: 10px; font: 11px "Courier New", monospace; color: #666; }
  footer { height: 22px; display: flex; align-items: center; flex-shrink: 0; padding: 0 4px; border-top: 1px solid white; background: #ece9d8; font-size: 11px; }
  .status, .internet { display: flex; align-items: center; gap: 4px; }
  .status img, .internet img { width: 14px; height: 14px; }
  .footer-spacer { flex: 1; }
`;

