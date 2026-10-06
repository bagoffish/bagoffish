import React, { useMemo } from "react";
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
  const addressText = useMemo(() => "https://bagof.fish/about", []);

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
        <div className="ie__address_bar__links">
          <img src={links} alt="links" className="ie__address_bar__links__img" />
          <div className="ie__address_bar__links__text">Links</div>
        </div>
      </section>

      <div className="ie__content">
        <div className="ie__content__inner">
          <div className="about">
            <h1 className="about__title">About Me</h1>

            <section className="about__section">
              <pre className="about__text">{ABOUT_TEXT}</pre>
              <p className="about__lain-line">
               {" "}Also:{" "}
                <a
                  className="about__lain"
                  href="/vn/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Serial Experiments Lain
                </a>
                {" "}(present day, present time…)
              </p>
            </section>

            <section className="about__section">
              <h2 className="about__heading">INTERESTS</h2>
              <pre className="about__text">{INTERESTS_TEXT}</pre>
            </section>

            <section className="about__section">
              <h2 className="about__heading">RECOMMENDATIONS</h2>
              <pre className="about__text">{RECS_TEXT}</pre>
            </section>

            <section className="about__section about__links-section">
              <h2 className="about__heading">LINKS</h2>
              <div className="links">
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
                <a href="https://github.com/bagoffish" target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
                <a
                  className="about__lain"
                  href="/vn/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Lain
                </a>
              </div>
            </section>
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
    padding: 12px 16px 20px;
  }
  .about__title {
    font-family: Tahoma, sans-serif;
    font-size: 16px;
    margin: 0 0 10px;
  }
  .about__section {
    margin-bottom: 14px;
  }
  .about__heading {
    font-family: Tahoma, sans-serif;
    font-size: 12px;
    margin: 0 0 6px;
    color: #003399;
  }
  .about__text {
    font-family: "Courier New", Courier, monospace;
    font-size: 12px;
    line-height: 1.45;
    white-space: pre-wrap;
    margin: 0;
    color: #000;
  }
  .about__lain-line {
    font-family: "Courier New", Courier, monospace;
    font-size: 12px;
    margin: 8px 0 0;
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
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-family: Tahoma, sans-serif;
    font-size: 12px;
  }
  .links a {
    color: #0066cc;
    text-decoration: underline;
    cursor: url("/images/Link%20Select.cur") 3 3, pointer;
  }
  .links a:hover {
    color: #cc0000;
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
`;

export default AboutMe;
