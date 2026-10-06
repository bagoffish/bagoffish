import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";

import { WindowDropDowns } from "components";
import dropDownData from "./dropDownData";

/* icons */
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

function AboutMe({ onClose }) {
  const [showLain, setShowLain] = useState(false);
  const [visitorCount, setVisitorCount] = useState(0);

useEffect(() => {
let cancelled = false;
    fetch("https://winxp-backend-live.onrender.com/visitor-count", { cache: "no-store" })
.then((response) => {
if (!response.ok) throw new Error("Visitor counter unavailable");
        return response.json();
      })
.then((data) => {
if (!cancelled && Number.isFinite(Number(data.count))) {
setVisitorCount(Number(data.count));
        }
})
.catch(() => {
if (!cancelled) setVisitorCount(0);
      });
    return () => { cancelled = true; };
  }, []);
  const addressText = showLain ? "https://bagof.fish/lain" : "https://bagof.fish/about";

  const functionMap = useMemo(
    () => ({
      Close: onClose,
    }),
    [onClose]
  );

  const openLain = () => setShowLain(true);
  const goBack = () => setShowLain(false);

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
        <button
          type="button"
          className={showLain ? "ie__function_bar__button" : "ie__function_bar__button--disable"}
          onClick={showLain ? goBack : undefined}
          disabled={!showLain}
          aria-label="Back"
        >
          <img className="ie__function_bar__icon" src={back} alt="" />
          <span className="ie__function_bar__text">Back</span>
          <div className="ie__function_bar__arrow" />
        </button>
        <div className="ie__function_bar__button--disable">
          <img className="ie__function_bar__icon" src={forward} alt="" />
          <div className="ie__function_bar__arrow" />
        </div>
        <div className="ie__function_bar__button--disable">
          <img className="ie__function_bar__icon--margin-1" src={stop} alt="" />
        </div>
        <div className="ie__function_bar__button--disable">
          <img className="ie__function_bar__icon--margin-1" src={refresh} alt="" />
        </div>
        <div className="ie__function_bar__button--disable" title="Home">
          <img className="ie__function_bar__icon--margin-1" src={home} alt="" />
        </div>
        <div className="ie__function_bar__separate" />
        <div className="ie__function_bar__button--disable">
          <img className="ie__function_bar__icon--normalize" src={search} alt="" />
          <span className="ie__function_bar__text">Search</span>
        </div>
        <div className="ie__function_bar__button--disable">
          <img className="ie__function_bar__icon--normalize" src={favorite} alt="" />
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
          <img src={dropdown} alt="dropdown" className="ie__address_bar__content__img" />
        </div>
        <div className="ie__address_bar__go">
          <img className="ie__address_bar__go__img" src={go} alt="go" />
          <span className="ie__address_bar__go__text">Go</span>
        </div>
        <div className="ie__address_bar__separate" />
      </section>

      <div className="ie__content">
        {showLain ? (
          <div className="ie__lain-page">
            <img src="/images/lain.gif" alt="serial experiments lain" />
          </div>
        ) : (
        <div className="ie__content__inner">
          <div className="about">
            <div className="about__site-header">
              <div className="about__site-header__top">
                <div>
                  <div className="about__site-kicker">PERSONAL HOMEPAGE</div>
                  <h1 className="about__title">★ Welcome to Coy's Homepage ★</h1>
                  <div className="about__subtitle">~ a little corner of the internet ~</div>
                </div>
                <div className="about__badge">
                  <img src={earth} alt="" />
                  <span>YOU ARE<br /><b>VISITOR #{String(visitorCount).padStart(6, "0")}</b></span>
                </div>
              </div>
              <div className="about__nav">
                <a href="#about">ABOUT ME</a><span>|</span>
                <a href="#interests">INTERESTS</a><span>|</span>
                <a href="#recs">RECS</a><span>|</span>
                <a href="#links">LINKS</a>
              </div>
            </div>

            <div className="about__welcome">
              <span>WELCOME!</span> Thanks for stopping by. This page is best viewed at 1024×768 with Internet Explorer 6.0.
            </div>

            <section className="about__section about__section--intro" id="about">
              <div className="about__section-title"><span>01</span> ABOUT ME</div>
              <pre className="about__text">{ABOUT_TEXT}</pre>
              </section>

            <section className="about__section" id="interests">
              <div className="about__section-title"><span>02</span> INTERESTS</div>
              <pre className="about__text">{INTERESTS_TEXT}</pre>
            </section>

            <section className="about__section" id="recs">
              <div className="about__section-title"><span>03</span> RECOMMENDATIONS</div>
              <pre className="about__text">{RECS_TEXT.split("Serial Experiments Lain").map((part, index, parts) => (
                <React.Fragment key={index}>
                  {part}
                  {index < parts.length - 1 && (
                    <a className="about__lain" href="#lain" onClick={(event) => { event.preventDefault(); openLain(); }}>
                      Serial Experiments Lain
                    </a>
                  )}
                </React.Fragment>
              ))}</pre>
            </section>

            <section className="about__section about__links-section" id="links">
              <div className="about__section-title"><span>04</span> LINKS / ELSEWHERE</div>
              <div className="links">
                <a href="https://github.com/bagoffish" target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
                <a href="https://open.spotify.com/user/fossils-mx" target="_blank" rel="noopener noreferrer">
                  Spotify
                </a>
                <a href="https://www.last.fm/user/drum" target="_blank" rel="noopener noreferrer">
                  Last.fm
                </a>
                <a href="https://soundcloud.com/coral" target="_blank" rel="noopener noreferrer">
                  SoundCloud
                </a>
                <a href="https://rateyourmusic.com/~bagoffish" target="_blank" rel="noopener noreferrer">
                  Rate Your Music
                </a>
                <a href="https://open.spotify.com/artist/567cGc3PvmxiZFQCwjcaRq" target="_blank" rel="noopener noreferrer">
                  Music Project - Spotify
                </a>
                <a href="https://bagoffish.bandcamp.com" target="_blank" rel="noopener noreferrer">
                  Music Project - Bandcamp
                </a>
                <a href="mailto:fossils@gmail.com">Email - fossils@gmail.com</a>
              </div>
            </section>
          </div>
        </div>
        )}
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

const ABOUT_TEXT = `My name is Coy

I'm deeply into philosophy; I'm an optimistic nihilist & an antinatalist.
Favorite philosophers: Nietzsche, Schopenhauer, Camus & Sartre. (In order)

I like feminine terms, but still call me a he.
i.e "Ms/Queen/whateverthehell Coy wow, he's so pretty"
but don't glaze me like that unjokingly, I think that's a little weird.

I'm fine with adults interacting with me if you aren't a creep.
That's all I'll say due to limited space, just talk to me if you're interested.
If normal, there's 0 biting.`;

const INTERESTS_TEXT = `Hobbies: Playing guitar, writing, photographing, illustrating & dissecting
Genres: Philosophy, horror eroge, ero guro, body horror,
        psychological horror, speculative evolution,
        post-apocalyptic sci-fi`;

const RECS_TEXT = `TV Shows: Mr. Robot & American Gods
Visual Novels: Saya no Uta, Steins;Gate, Katawa Shoujo,
               Teaching Feeling, Higurashi & SubaHibi
Mangas: Tokyo Akazukin, Null-Meta, Sayonara Zetsubou Sensei, Ashizuri Suizokukan,
        Shadow Star, Made in Abyss, Mai-chan's Daily Life & Shimeji Simulation
Animes: A Silent Voice, Monster, Inuyashiki, Bungo Stray Dogs,
        Alien Nine, Evangelion, Parasyte, Nichijou,
        Girls Last Tour, Haibane Renmei & Serial Experiments Lain`;

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
  .ie__content {
    flex: 1;
    overflow: auto;
    position: relative;
    background:
      linear-gradient(rgba(255,255,255,.72), rgba(255,255,255,.72)),
      repeating-linear-gradient(0deg, #dbe8f3 0, #dbe8f3 1px, #eef5fa 1px, #eef5fa 3px);
  }
  .ie__content__inner {
    min-height: 100%;
    padding: 18px 22px 28px;
  }
  .ie__lain-page {
    min-height: 100%;
    width: 100%;
    background: #fff;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    position: relative;
    overflow: auto;
  }
  .ie__lain-page img {
    display: block;
    max-width: 100%;
    height: auto;
  }
  .about {
    width: min(760px, 100%);
    margin: 0 auto;
    box-sizing: border-box;
    border: 1px solid #7f9db9;
    background: #fff;
    box-shadow: 2px 2px 0 rgba(0,0,0,.18);
  }
  .about__site-header {
    border-bottom: 1px solid #7f9db9;
    background: linear-gradient(#f8fbff, #d8e8f7);
  }
  .about__site-header__top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
    padding: 12px 14px 9px;
  }
  .about__site-kicker {
    font: bold 9px Tahoma, sans-serif;
    letter-spacing: 1px;
    color: #777;
    margin-bottom: 3px;
  }
  .about__title {
    font: bold 22px Georgia, "Times New Roman", serif;
    color: #003399;
    text-shadow: 1px 1px #fff;
    margin: 0;
  }
  .about__subtitle {
    font: italic 11px "Courier New", monospace;
    color: #555;
    margin-top: 3px;
  }
  .about__badge {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 7px;
    border: 1px solid #aaa;
    background: #f4f4f4;
    font: 9px Tahoma, sans-serif;
    color: #555;
    text-align: center;
    box-shadow: inset 1px 1px #fff;
    flex-shrink: 0;
  }
  .about__badge img {
    width: 22px;
    height: 22px;
  }
  .about__badge b {
    color: #003399;
  }
  .about__nav {
    padding: 5px 10px;
    background: #003399;
    color: #fff;
    font: bold 10px Tahoma, sans-serif;
    letter-spacing: .2px;
  }
  .about__nav a {
    color: #fff;
    text-decoration: none;
    margin: 0 6px;
  }
  .about__nav a:hover {
    color: #ffff00;
    text-decoration: underline;
  }
  .about__welcome {
    margin: 12px 14px 0;
    padding: 6px 8px;
    border: 1px dashed #999;
    background: #ffffe1;
    color: #444;
    font: 10px Verdana, sans-serif;
  }
  .about__welcome span {
    color: #cc0000;
    font-weight: bold;
  }
  .about__section {
    margin: 12px 14px 0;
    padding: 0 0 12px;
    border-bottom: 1px dotted #aaa;
  }
  .about__section:last-child {
    border-bottom: 0;
    padding-bottom: 18px;
  }
  .about__section-title {
    color: #fff;
    background: linear-gradient(#5d9bd3, #2d6fa8);
    border: 1px solid #174f80;
    box-shadow: inset 1px 1px rgba(255,255,255,.45);
    padding: 3px 6px;
    margin-bottom: 8px;
    font: bold 11px Tahoma, sans-serif;
  }
  .about__section-title span {
    color: #d9edff;
    margin-right: 8px;
    font-family: "Courier New", monospace;
  }
  .about__text {
    font: 12px/1.5 "Courier New", Courier, monospace;
    white-space: pre-wrap;
    margin: 0;
    color: #111;
  }
  .about__lain-line {
    font: 11px "Courier New", Courier, monospace;
    margin: 8px 0 0;
    padding: 5px 7px;
    background: #f1f5f9;
    border-left: 3px solid #7f9db9;
  }
  .about__lain {
    color: #0066cc;
    text-decoration: underline;
    cursor: url("/images/Link%20Select.cur") 3 3, pointer;
  }
  .about__lain:hover {
    color: #cc0000;
  }
  .links {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 5px 12px;
    padding: 7px;
    border: 1px solid #c4c4c4;
    background: #f5f5f5;
    font: 11px Tahoma, sans-serif;
  }
  .links a {
    color: #0066cc;
    text-decoration: underline;
    cursor: url("/images/Link%20Select.cur") 3 3, pointer;
  }
  .links a:hover {
    color: #cc0000;
  }
  @media (max-width: 620px) {
    .about__site-header__top { align-items: flex-start; }
    .about__title { font-size: 18px; }
    .about__badge { display: none; }
    .links { grid-template-columns: 1fr; }
    .ie__content__inner { padding: 10px; }
  }

  .ie__footer {
    height: 22px;
    display: flex;
    align-items: center;
    padding: 0 2px;
    border-top: 1px solid #fff;
    background: #ece9d8;
    font-size: 11px;
    flex-shrink: 0;
  }
  .ie__footer__status {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 6px;
    min-width: 120px;
  }
  .ie__footer__status__img {
    width: 14px;
    height: 14px;
  }
  .ie__footer__block {
    flex: 1;
    height: 16px;
    border-left: 1px solid rgba(0, 0, 0, 0.1);
  }
  .ie__footer__right {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 6px;
  }
  .ie__footer__right__img {
    width: 14px;
    height: 14px;
  }
  .ie__footer__right__dots {
    width: 20px;
  }
  @media (max-width: 700px) {
  .ie__toolbar {
    min-height: 24px;
  }
  .ie__function_bar {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .ie__function_bar::-webkit-scrollbar {
    display: none;
  }
  .ie__function_bar__text {
    display: none;
  }
  .ie__address_bar {
    min-width: 0;
  }
  .ie__address_bar__title {
    display: none;
  }
  .ie__address_bar__content {
    min-width: 0;
    flex: 1;
  }
  .ie__address_bar__content__text {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .ie__address_bar__go {
    flex-shrink: 0;
  }
  .about__container,
  .about__page,
  .about__content {
    max-width: 100% !important;
    width: 100% !important;
    box-sizing: border-box;
  }
  .about__section,
  .about__links,
  .links {
    max-width: 100%;
  }
  .about__lain-line {
    overflow-wrap: anywhere;
  }
  .ie__lain-page {
    overflow: auto;
    -webkit-overflow-scrolling: touch;
  }
}

`;

export default AboutMe;
