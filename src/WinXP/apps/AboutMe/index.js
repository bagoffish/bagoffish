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
  const [route, setRoute] = useState("about"); // "about" | "lain"

  const addressText = useMemo(() => {
    if (route === "lain") return "https://bagof.fish/lain";
    return "https://bagof.fish/about";
  }, [route]);

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
        <img className="ie__windows-logo" src={windows} alt="windows" />
      </section>

      <section className="ie__function_bar">
        <div className="ie__function_bar__button--disable">
          <img className="ie__function_bar__icon" src={back} alt="" />
          <span className="ie__function_bar__text">Back</span>
          <div className="ie__function_bar__arrow" />
        </div>
        <div className="ie__function_bar__button--disable">
          <img className="ie__function_bar__icon" src={forward} alt="" />
          <div className="ie__function_bar__arrow" />
        </div>
        <div className="ie__function_bar__button--disable">
          <img className="ie__function_bar__icon" src={stop} alt="" />
        </div>
        <div className="ie__function_bar__button--disable">
          <img className="ie__function_bar__icon" src={refresh} alt="" />
        </div>
        <div className="ie__function_bar__button--disable" title="Home">
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
          <img
            className="ie__function_bar__icon--margin12"
            src={printer}
            alt=""
          />
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

        <div className="ie__address_bar__links">
          <img
            src={links}
            alt="links"
            className="ie__address_bar__links__img"
          />
          <div className="ie__address_bar__links__text">Links</div>
        </div>
      </section>

      <div className="ie__content">
        <div className="ie__content__inner">
          <div className="about">
            <div className="about__header">
              <button
                type="button"
                className={route === "about" ? "about__tab about__tab--active" : "about__tab"}
                onClick={() => setRoute("about")}
              >
                About
              </button>
              <button
                type="button"
                className={route === "lain" ? "about__tab about__tab--active" : "about__tab"}
                onClick={() => setRoute("lain")}
              >
                Lain
              </button>
            </div>

            {route === "about" && (
              <pre className="about__text">
                {ABOUT_TEXT_BEFORE}
              </pre>
            )}

            {route === "lain" && (
              <div className="about__lain">
                <p>
                  present day, present time.
                </p>
                <p>
                  ha ha ha ha ha ha ha ha...
                </p>
              </div>
            )}

            {route === "about" && ABOUT_TEXT_AFTER ? (
              <pre className="about__text">{ABOUT_TEXT_AFTER}</pre>
            ) : null}
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

const ABOUT_TEXT_BEFORE = `My name is Coy

I'm deeply into philosophy; I'm an optimistic nihilist & an antinatalist.
Favorite philosophers: Nietzsche, Schopenhauer, Camus & Sartre. (In order)

I like feminine terms, but still call me a he. 
i.e "Ms/Queen/whateverthehell Coy wow, he's so pretty" 
but don't glaze me like that unjokingly, I think that's a little weird.

I'm fine with adults interacting with me if you aren't a creep.
That's all I'll say due to limited space, just talk to me if you're interested. 
If normal, there's 0 biting.

INTERESTS —
Hobbies: Playing guitar, writing, photographing, illustrating & dissecting
Genres: Philosophy, horror eroge, ero guro, body horror,
        psychological horror, speculative evolution,
        post-apocalyptic sci-fi

RECOMMENDATIONS —
TV Shows: Mr. Robot & American Gods
Visual Novels: Saya no Uta, Steins;Gate, Katawa Shoujo,
               Teaching Feeling, Higurashi & SubaHibi
Mangas: Tokyo Akazukin, Null-Meta, Sayonara Zetsubou Sensei, Ashizuri Suizokukan,
        Shadow Star, Made in Abyss, Mai-chan’s Daily Life & Shimeji Simulation
Animes: A Silent Voice, Monster, Inuyashiki, Bungo Stray Dogs,
        Alien Nine, Evangelion, Parasyte, Nichijou, 
        Girls Last Tour, Haibane Renmei & `;

const ABOUT_TEXT_AFTER = ``;

const Div = styled.div`
  height: 100%;
  width: 100%;
  position: absolute;
  display: flex;
  overflow: hidden;
  flex-direction: column;
  background: linear-gradient(to right, #edede5 0%, #ede8cd 100%);

  /* ---- IE chrome (same layout as Socials) ---- */
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
  .ie__function_bar__button--disable {
    filter: grayscale(1);
    opacity: 0.7;
    display: flex;
    height: 100%;
    align-items: center;
    border: 1px solid rgba(0, 0, 0, 0);
  }
  .ie__function_bar__button--disable > * {
    pointer-events: none;
  }
  .ie__function_bar__button {
    display: flex;
    height: 100%;
    align-items: center;
    border: 1px solid rgba(0, 0, 0, 0);
    border-radius: 3px;
    padding: 0 4px;
    margin-right: 2px;
    cursor: url("/images/Link%20Select.cur") 3 3, pointer;
  }
  .ie__function_bar__button:hover {
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: inset 0 -1px 1px rgba(0, 0, 0, 0.1);
  }
  .ie__function_bar__icon {
    height: 22px;
    width: 22px;
  }
  .ie__function_bar__icon--normalize {
    height: 22px;
    width: 22px;
  }
  .ie__function_bar__icon--margin-1 {
    height: 22px;
    width: 22px;
    margin: 0 1px;
  }
  .ie__function_bar__icon--margin12 {
    height: 22px;
    width: 22px;
    margin: 0 1px 0 2px;
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
  .ie__function_bar__arrow--margin-11 {
    width: 0;
    height: 0;
    border-left: 3px solid transparent;
    border-right: 3px solid transparent;
    border-top: 3px solid #000;
    margin: 0 1px 0 11px;
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
    flex-shrink: 0;
  }
  .ie__address_bar__title {
    color: rgba(0, 0, 0, 0.5);
    font-size: 11px;
  }
  .ie__address_bar__content {
    flex: 1;
    height: 18px;
    display: flex;
    align-items: center;
    background: #fff;
    border: 1px solid #7f9db9;
    padding: 0 2px;
    overflow: hidden;
  }
  .ie__address_bar__content__img {
    width: 14px;
    height: 14px;
  }
  .ie__address_bar__content__text {
    flex: 1;
    font-size: 11px;
    margin: 0 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ie__address_bar__go {
    display: flex;
    align-items: center;
    height: 20px;
    padding: 0 4px;
    border: 1px solid transparent;
    border-radius: 2px;
  }
  .ie__address_bar__go__img {
    width: 16px;
    height: 16px;
  }
  .ie__address_bar__go__text {
    font-size: 11px;
    margin-left: 2px;
  }
  .ie__address_bar__separate {
    height: 18px;
    width: 1px;
    background: rgba(0, 0, 0, 0.15);
  }
  .ie__address_bar__links {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .ie__address_bar__links__img {
    width: 16px;
    height: 16px;
  }
  .ie__address_bar__links__text {
    font-size: 11px;
  }
  .ie__content {
    flex: 1;
    overflow: auto;
    background: #fff;
    position: relative;
  }
  .ie__content__inner {
    min-height: 100%;
    padding: 12px 16px;
  }
  .about__header {
    display: flex;
    gap: 4px;
    margin-bottom: 12px;
  }
  .about__tab {
    font-family: Tahoma, sans-serif;
    font-size: 11px;
    padding: 2px 10px;
    border: 1px solid #7f9db9;
    background: #ece9d8;
    cursor: url("/images/Link%20Select.cur") 3 3, pointer;
  }
  .about__tab--active {
    background: #fff;
    border-bottom-color: #fff;
  }
  .about__text {
    font-family: "Courier New", Courier, monospace;
    font-size: 12px;
    line-height: 1.45;
    white-space: pre-wrap;
    margin: 0;
    color: #000;
  }
  .about__lain {
    font-family: "Courier New", Courier, monospace;
    font-size: 13px;
    line-height: 1.6;
  }
  .ie__status {
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 6px;
    border-top: 1px solid #fff;
    background: #ece9d8;
    font-size: 11px;
    flex-shrink: 0;
  }
  .ie__status__left,
  .ie__status__right {
    display: flex;
    align-items: center;
    gap: 4px;
  }
`;

export default AboutMe;
