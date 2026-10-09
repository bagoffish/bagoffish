import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Midi } from '@tonejs/midi';
import { buildRobloxArrangement, orchestraProgramsFor } from './orchestraArrange';
let workletSynthesizerPromise = null;
function loadWorkletSynthesizer() {
  if (!workletSynthesizerPromise) {
    workletSynthesizerPromise = import('spessasynth_lib').then(mod => {
      const loaded = mod && (mod.WorkletSynthesizer || (mod.default && mod.default.WorkletSynthesizer));
      if (typeof loaded !== 'function') throw new Error('SoundFont player failed to load');
      return loaded;
    }).catch(error => {
      workletSynthesizerPromise = null;
      throw error;
    });
  }
  return workletSynthesizerPromise;
}


const SPESSA_PROCESSOR_URL = '/spessasynth_processor.min.js';
const API_BASE = window.RENDERER_API_BASE || 'https://bloxify-backend-sg.onrender.com';
const MAX_SECONDS = 300;
const MAX_BYTES = 120 * 1024 * 1024;
const MODEL_URL = '/basic-pitch-model/model.json';
const SKY_URL = '/images/sky.png';

const SOUNDFONT_BUFFER_CACHE = new Map();
const SOUNDFONT_LOAD_PROMISES = new Map();
const BASIC_PITCH_IDB = 'bloxify-basic-pitch-v1';

const SOUNDFONT_LIBRARY = [
  { id: 'stealth-drums', name: 'StealthPilot MIDI Drums', url: '/soundfonts/Instruments/MIDI%20Compatible%20Soundfonts/StealthPilot_MIDI_DRUMS_ONLY.sf2', bankOffset: 1 },
  { id: 'strategy-midi', name: 'The Great Strategy MIDI', url: '/soundfonts/Instruments/MIDI%20Compatible%20Soundfonts/The_Great_Strategy_MIDI.sf2', bankOffset: 2 },
  { id: 'fjords-midi', name: 'Wind of Fjords MIDI', url: '/soundfonts/Instruments/MIDI%20Compatible%20Soundfonts/Wind_of_Fjords_MIDI.sf2', bankOffset: 3 },
  { id: 'aqua-mod', name: 'AquaDoesStuff Modified', url: '/soundfonts/Instruments/Other%20People/AquaDoesStuff%20-%20Modified.sf2', bankOffset: 4 },
  { id: 'roblox-other', name: 'Roblox Soundfont', url: '/soundfonts/Instruments/Other%20People/Roblox%20Soundfont.sf2', bankOffset: 5 },
  { id: 'beastmasters', name: 'Beastmasters Tale', url: '/soundfonts/Instruments/Soundfonts/Beastmasters%20Tale.sf2', bankOffset: 6 },
  { id: 'clan-raided', name: 'Clan Being Raided', url: '/soundfonts/Instruments/Soundfonts/Clan%20Being%20Raided.sf2', bankOffset: 7 },
  { id: 'classic-days', name: 'Classic Days', url: '/soundfonts/Instruments/Soundfonts/Classic%20Days.sf2', bankOffset: 8 },
  { id: 'crossroad', name: 'Crossroad Times', url: '/soundfonts/Instruments/Soundfonts/Crossroad%20Times.sf2', bankOffset: 9 },
  { id: 'dance-potion', name: 'Dance Potion', url: '/soundfonts/Instruments/Soundfonts/Dance%20Potion.sf2', bankOffset: 10 },
  { id: 'death-sounds', name: 'Death Sounds', url: '/soundfonts/Instruments/Soundfonts/Death%20Sounds.sf2', bankOffset: 11 },
  { id: 'explore-roblox', name: 'Explore Roblox', url: '/soundfonts/Instruments/Soundfonts/Explore%20Roblox.sf2', bankOffset: 12 },
  { id: 'gamehero', name: 'GameHero', url: '/soundfonts/Instruments/Soundfonts/GameHero%20Soundfont.sf2', bankOffset: 13 },
  { id: 'monster-mash', name: 'Monster Mash', url: '/soundfonts/Instruments/Soundfonts/Monster%20Mash.sf2', bankOffset: 14 },
  { id: 'noob-alert', name: 'Noob Alert', url: '/soundfonts/Instruments/Soundfonts/Noob%20Alert.sf2', bankOffset: 15 },
  { id: 'party-music', name: 'Party Music', url: '/soundfonts/Instruments/Soundfonts/Party%20Music.sf2', bankOffset: 16 },
  { id: 'roblox-horror', name: 'Roblox Horror', url: '/soundfonts/Instruments/Soundfonts/Roblox%20Horror.sf2', bankOffset: 17 },
  { id: 'roblox-old', name: 'Roblox Old Sounds', url: '/soundfonts/Instruments/Soundfonts/Roblox%20Old%20Sounds.sf2', bankOffset: 18 },
  { id: 'stealth-v2', name: 'StealthPilot v2', url: '/soundfonts/Instruments/Soundfonts/StealthPilot%20v2.sf2', bankOffset: 19 },
  { id: 'stealth', name: 'StealthPilot', url: '/soundfonts/Instruments/Soundfonts/StealthPilot.sf2', bankOffset: 20 },
  { id: 'strategy', name: 'The Great Strategy', url: '/soundfonts/Instruments/Soundfonts/The%20Great%20Strategy.sf2', bankOffset: 21 },
  { id: 'training-day', name: 'Training Day', url: '/soundfonts/Instruments/Soundfonts/Training%20Day.sf2', bankOffset: 22 },
  { id: 'trouble-ahead', name: 'Trouble Ahead', url: '/soundfonts/Instruments/Soundfonts/Trouble%20Ahead.sf2', bankOffset: 23 },
  { id: 'waapp', name: 'WAAPP Whistle', url: '/soundfonts/Instruments/Soundfonts/WAAPP%20Whistle.sf2', bankOffset: 24 },
  { id: 'wiley-bricks', name: 'Wiley Metal Bricks', url: '/soundfonts/Instruments/Soundfonts/Wiley,%20Metal%20Bricks.sf2', bankOffset: 25 },
  { id: 'fjords-voyage', name: 'Wind of Fjords + Voyage to Eternity', url: '/soundfonts/Instruments/Soundfonts/Wind%20of%20Fjords%20%2B%20Voyage%20to%20Eternity%20(They%20share%20same%20Instruments).sf2', bankOffset: 26 },
  { id: 'fjords-hq', name: 'Wind of Fjords HQ', url: '/soundfonts/Instruments/Soundfonts/Wind%20of%20fjords%20HQ.sf2', bankOffset: 27 },
  { id: 'nokia', name: 'Nokia Tongbao Bank', url: '/soundfonts/Instruments/WorkingR-Blox/Nokia_Tongbao_Bank.sf2', bankOffset: 28 },
  { id: 'roblox-1', name: 'Roblox Soundfont 1', url: '/soundfonts/Instruments/WorkingR-Blox/Roblox%20Soundfont-1.sf2', bankOffset: 29 },
  { id: 'fjords', name: 'Wind of Fjords v2.5.1a', url: '/soundfonts/Instruments/WorkingR-Blox/Wind_Of_Fjords_V2.5.1a/WindOfFjordsV2.5.1a.sf2', bankOffset: 30 },
  { id: 'general-user', name: 'GeneralUser GS Orchestra', url: '/soundfonts/Orchestra/GeneralUser-GS.sf2', bankOffset: 31 },
];
const FIXED_SOUNDFONT_ID = 'classic-roblox-palette';
const SOUND_FONT_BY_ROLE = {
  drums: 'stealth-drums',
  bass: 'fjords',
  guitar: 'gamehero',
  vocals: 'roblox-1',
  keys: 'general-user',
  pad: 'fjords-midi',
  strings: 'general-user',
  arp: 'general-user',
  cello: 'fjords',
  horn: 'general-user',
  flute: 'general-user',
  oboe: 'general-user',
  clarinet: 'general-user',
  timpani: 'general-user',
  pizz: 'general-user',
  trumpet: 'general-user',
};
const CLASSIC_ROLE_BANKS = {
  drums: 'stealth-drums',
  bass: 'fjords',
  guitar: 'gamehero',
  vocals: 'roblox-1',
  keys: 'classic-days',
  pad: 'fjords-midi',
  strings: 'fjords-hq',
  arp: 'nokia',
  cello: 'fjords',
  horn: 'general-user',
  flute: 'general-user',
  oboe: 'general-user',
  clarinet: 'general-user',
  timpani: 'general-user',
  pizz: 'general-user',
  trumpet: 'general-user',
};
const ROLE_CHANNEL = {
  drums: 9,
  bass: 0,
  guitar: 1,
  vocals: 2,
  keys: 3,
  pad: 4,
  strings: 5,
  arp: 6,
  cello: 7,
  horn: 8,
  flute: 10,
  oboe: 11,
  timpani: 12,
  pizz: 13,
  trumpet: 14,
  clarinet: 15,
};
const SOUND_FONT_ROLE_BANKS = Object.fromEntries(
  Object.entries(SOUND_FONT_BY_ROLE).map(([role, id]) => [role, SOUNDFONT_LIBRARY.find(bank => bank.id === id)])
);
const SOUND_FONT_BY_ID = Object.fromEntries(SOUNDFONT_LIBRARY.map(bank => [bank.id, bank]));
const getRoleBank = (roleId, plan) => {
  const id = plan && plan.soundfontRoles && plan.soundfontRoles[roleId];
  return SOUND_FONT_BY_ID[id] || SOUND_FONT_ROLE_BANKS[roleId] || SOUNDFONT_LIBRARY[0];
};

function bankForNote(note, plan) {
  const id = (note && note.bankId) || (plan && plan.soundfontRoles && note && plan.soundfontRoles[note.role]);
  return SOUND_FONT_BY_ID[id] || getRoleBank(note && note.role, plan);
}

// Saved places used to store only the program numbers. Playback then selected
// every default bank without calling addSoundBank, and SpessaSynth warned
// "No preset found". Rebuild the banks from the notes, then from the saved
// role map, then from the role defaults.
function planWithSoundBanks(notes, savedPlan) {
  const saved = savedPlan && typeof savedPlan === 'object' ? savedPlan : {};
  const savedRoles = saved.soundfontRoles && typeof saved.soundfontRoles === 'object' ? saved.soundfontRoles : {};
  const list = Array.isArray(notes) ? notes : [];
  const usedRoles = [];
  list.forEach(note => {
    if (note && note.role && usedRoles.indexOf(note.role) === -1) usedRoles.push(note.role);
  });
  const soundfontRoles = {};
  usedRoles.forEach(roleId => {
    const stamped = list.find(note => note && note.role === roleId && note.bankId && SOUND_FONT_BY_ID[note.bankId]);
    const savedId = savedRoles[roleId];
    const id = (stamped && stamped.bankId) || (SOUND_FONT_BY_ID[savedId] ? savedId : '') || CLASSIC_ROLE_BANKS[roleId];
    if (id && SOUND_FONT_BY_ID[id]) soundfontRoles[roleId] = id;
  });
  const draft = { soundfontRoles };
  const palette = [];
  const push = bank => {
    if (bank && bank.id && !palette.some(font => font.id === bank.id)) palette.push(bank);
  };
  list.forEach(note => push(bankForNote(note, draft)));
  usedRoles.forEach(roleId => push(getRoleBank(roleId, draft)));
  return {
    label: 'Bloxify Arrangement',
    fixedStyle: true,
    preBakedSoundFontCatalog: true,
    soundfonts: SOUNDFONT_LIBRARY,
    soundfontId: FIXED_SOUNDFONT_ID,
    soundfontRoles,
    soundfontPalette: palette,
    programs: programsForPlan(list, saved, soundfontRoles),
    drums: getRoleBank('drums', { soundfontRoles }),
  };
}

function usesOrchestra(notes, savedRoles) {
  if ((notes || []).some(note => note && note.bankId === 'general-user')) return true;
  return !!(savedRoles && Object.keys(savedRoles).some(roleId => savedRoles[roleId] === 'general-user'));
}

function programsForPlan(notes, saved, soundfontRoles) {
  const savedPrograms = saved && saved.programs && typeof saved.programs === 'object' ? saved.programs : null;
  if (!usesOrchestra(notes, soundfontRoles)) return { ...CLASSIC_PROGRAMS };
  const tuned = orchestraProgramsFor(notes);
  const vocals = savedPrograms && (savedPrograms.vocals === 40 || savedPrograms.vocals === 73) ? savedPrograms.vocals : tuned.vocals;
  const strings = savedPrograms && (savedPrograms.strings === 48 || savedPrograms.strings === 49) ? savedPrograms.strings : tuned.strings;
  return { ...tuned, vocals, strings };
}

async function addBankToSynth(synth, bank) {
  if (!synth || !bank || !bank.url || !synth.soundBankManager) return false;
  try {
    let promise = SOUNDFONT_LOAD_PROMISES.get(bank.id);
    if (!promise) {
      promise = fetch(bank.url, { cache: 'force-cache' }).then(response => {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.arrayBuffer();
      }).then(buffer => {
        SOUNDFONT_BUFFER_CACHE.set(bank.id, buffer);
        return buffer;
      });
      SOUNDFONT_LOAD_PROMISES.set(bank.id, promise);
    }
    const cached = SOUNDFONT_BUFFER_CACHE.get(bank.id) || await promise;
    await synth.soundBankManager.addSoundBank(cached.slice(0), bank.id, bank.bankOffset || 0);
    return true;
  } catch (err) {
    SOUNDFONT_LOAD_PROMISES.delete(bank.id);
    console.warn('SF2 load failed', bank.name, err);
    return false;
  }
}

function assignRoleBanks() {
  const banks = {};
  roles.forEach(role => {
    const id = SOUND_FONT_BY_ROLE[role.id];
    banks[role.id] = SOUND_FONT_BY_ID[id] ? id : CLASSIC_ROLE_BANKS[role.id];
  });
  return banks;
}

function stampSoundfontMix(notes, palette, soundfontRoles) {
  return notes.map(note => {
    let bankId = soundfontRoles && soundfontRoles[note.role];
    if (!bankId && palette && palette[0]) bankId = palette[0].id;
    // GeneralUser's standard kit is program 0 on channel 9. A new Roblox
    // song stays on stealth-drums so an old drum font cannot claim it.
    if (note.role === 'drums' && bankId !== 'general-user' && SOUND_FONT_BY_ID['stealth-drums']) bankId = 'stealth-drums';
    if (note.role === 'bass' && soundfontRoles && soundfontRoles.bass) bankId = soundfontRoles.bass;
    if (note.role === 'vocals' && soundfontRoles && soundfontRoles.vocals) bankId = soundfontRoles.vocals;
    return bankId ? { ...note, bankId } : note;
  });
}
const CLASSIC_PROGRAMS = { drums: 0, bass: 38, guitar: 80, vocals: 80, keys: 80, pad: 89, strings: 81, arp: 81 };
const ORCHESTRA_PROGRAMS = {
  drums: 0, bass: 43, guitar: 42, vocals: 40, keys: 0, pad: 60, strings: 48, arp: 46,
  cello: 42, horn: 60, flute: 73, oboe: 68, clarinet: 71, timpani: 47, pizz: 45, trumpet: 56,
};
// Channel volume (CC7). Saved Roblox-font places keep the older balance.
// Orchestra places use the second table so the violin stays in front.
const ROLE_VOLUME = {
  drums: 96, bass: 104, guitar: 64, vocals: 118, keys: 82, pad: 36, strings: 70, arp: 76,
  cello: 78, horn: 56, flute: 64, oboe: 52, clarinet: 50, timpani: 72, pizz: 54, trumpet: 64,
};
const ORCHESTRA_VOLUME = {
  drums: 78, bass: 96, guitar: 62, vocals: 114, keys: 46, pad: 40, strings: 68, arp: 50,
  cello: 80, horn: 56, flute: 64, oboe: 52, clarinet: 50, timpani: 74, pizz: 56, trumpet: 66,
};
const ORCHESTRA_REVERB = {
  drums: 4, bass: 12, guitar: 34, vocals: 24, keys: 16, pad: 36, strings: 46, arp: 34,
  cello: 28, horn: 40, flute: 36, oboe: 32, clarinet: 30, timpani: 18, pizz: 12, trumpet: 28,
};
const ORCHESTRA_PAN = {
  drums: 64, bass: 58, guitar: 46, vocals: 66, keys: 48, pad: 90, strings: 64, arp: 96,
  cello: 74, horn: 40, flute: 90, oboe: 78, clarinet: 52, timpani: 64, pizz: 46, trumpet: 88,
};

function mixValue(roleId, notes, soundfontRoles, table, fallback) {
  if (usesOrchestra(notes, soundfontRoles) && table && table[roleId] != null) return table[roleId];
  return fallback;
}

const roles = [
  { id: 'drums', label: 'DRUMS', channel: 9, color: '#e07070', program: 0 },
  { id: 'bass', label: 'BASS', channel: 0, color: '#70a0e0', program: 38 },
  { id: 'cello', label: 'CELLO', channel: 7, color: '#c06030', program: 42 },
  { id: 'vocals', label: 'VIOLIN', channel: 2, color: '#e0e070', program: 40 },
  { id: 'strings', label: 'STRINGS', channel: 5, color: '#e0a070', program: 48 },
  { id: 'horn', label: 'HORN', channel: 8, color: '#d0a030', program: 60 },
  { id: 'flute', label: 'FLUTE', channel: 10, color: '#80d0e0', program: 73 },
  { id: 'oboe', label: 'OBOE', channel: 11, color: '#c0d070', program: 68 },
  { id: 'clarinet', label: 'CLARINET', channel: 15, color: '#9070c0', program: 71 },
  { id: 'arp', label: 'HARP', channel: 6, color: '#d0d070', program: 46 },
  { id: 'keys', label: 'PIANO', channel: 3, color: '#c080e0', program: 0 },
  { id: 'pizz', label: 'PIZZ', channel: 13, color: '#e090b0', program: 45 },
  { id: 'trumpet', label: 'TRUMPET', channel: 14, color: '#e8c040', program: 56 },
  { id: 'timpani', label: 'TIMPANI', channel: 12, color: '#a07050', program: 47 },
  { id: 'guitar', label: 'GUITAR', channel: 1, color: '#70e070', program: 80 },
  { id: 'pad', label: 'PAD', channel: 4, color: '#70d0d0', program: 89 },
];

const STEM_ORDER = roles.map(role => role.id);

// SoundFont releases are chopped if playback stops on the final noteOff.
const RELEASE_TAIL = 2;

function heardEnd(notes) {
  let maxEnd = 0;
  (notes || []).forEach(note => {
    maxEnd = Math.max(maxEnd, (Number(note.startTimeSeconds) || 0) + Math.max(0.05, Number(note.durationSeconds) || 0));
  });
  return maxEnd + RELEASE_TAIL;
}

function buildFullArrangement(rawNotes, duration) {
  const out = buildRobloxArrangement(rawNotes, duration);
  return out
    .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi)
    .map((note, index) => ({ ...note, id: index + 1 }));
}

function makeStemMidi(notes, roleId, programs) {
  const role = roles.find(r => r.id === roleId);
  const midi = new Midi();
  midi.name = 'Bloxify ' + (role ? role.label : roleId);
  midi.header.setTempo(120);
  const track = midi.addTrack();
  track.name = role ? role.label : roleId.toUpperCase();
  track.channel = role ? role.channel : 0;
  track.instrument.number = programs && programs[roleId] != null ? programs[roleId] : (role ? role.program : 0);
  const volume = mixValue(roleId, notes, null, ORCHESTRA_VOLUME, ROLE_VOLUME[roleId]);
  const pan = mixValue(roleId, notes, null, ORCHESTRA_PAN, 64);
  if (typeof track.addCC === 'function' && volume != null) {
    track.addCC({ controllerType: 7, value: volume / 127, time: 0 });
    track.addCC({ controllerType: 10, value: pan / 127, time: 0 });
  }
  notes.filter(note => note.role === roleId).forEach(note => {
    track.addNote({
      midi: note.pitchMidi,
      time: note.startTimeSeconds,
      duration: Math.max(0.04, note.durationSeconds),
      velocity: Math.max(0.15, Math.min(1, note.amplitude || 0.8)),
    });
  });
  return new Blob([midi.toArray()], { type: 'audio/midi' });
}

const rbx = { blue: '#6e99c9', yellow: '#f5cd2f', healthBg: '#1a1a1a', panel: 'rgba(255,255,255,0.92)', font: 'Verdana, Geneva, Tahoma, sans-serif', text: '#000' };
const btn = { background: rbx.yellow, border: '2px solid #000', color: '#000', fontFamily: rbx.font, fontSize: 11, fontWeight: 'bold', padding: '3px 8px', cursor: 'url("/images/Link%20Select.cur") 3 3, pointer', borderRadius: 0, boxShadow: 'inset 1px 1px 0 #fff6a0, inset -1px -1px 0 #c9a600' };
const btnGray = { ...btn, background: '#e0e0e0', boxShadow: 'inset 1px 1px 0 #fff, inset -1px -1px 0 #999' };
const saveBtn = { ...btn, width: 100, minWidth: 100, maxWidth: 100, height: 26, minHeight: 26, maxHeight: 26, boxSizing: 'border-box', flex: '0 0 100px', padding: '3px 4px', whiteSpace: 'nowrap' };
const saveBtnGray = { ...btnGray, width: 100, minWidth: 100, maxWidth: 100, height: 26, minHeight: 26, maxHeight: 26, boxSizing: 'border-box', flex: '0 0 100px', padding: '3px 4px', whiteSpace: 'nowrap' };
const topBtn = { ...btn, height: 26, minHeight: 26, maxHeight: 26, boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '3px 8px', whiteSpace: 'nowrap' };
const topBtnGray = { ...btnGray, height: 26, minHeight: 26, maxHeight: 26, boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '3px 8px', whiteSpace: 'nowrap' };
const topSelect = { height: 26, minHeight: 26, maxHeight: 26, boxSizing: 'border-box', fontFamily: rbx.font, fontSize: 10, border: '2px solid #000', padding: '2px 4px' };

function HealthBar({ value, max = 1, label, width = 120, height = 14, onChange }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const barRef = React.useRef(null);
  const dragging = React.useRef(false);
  const setFromEvent = e => {
    if (!onChange || !barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const clientX = e.clientX != null ? e.clientX : e.touches && e.touches[0] && e.touches[0].clientX;
    onChange(Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(rect.width, 1))) * (max || 1));
  };
  const onPointerDown = e => { if (!onChange) return; dragging.current = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {} setFromEvent(e); };
  const onPointerMove = e => { if (!onChange || !dragging.current) return; setFromEvent(e); };
  const onPointerUp = e => { dragging.current = false; try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {} };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: typeof width === 'string' ? width : undefined, minWidth: typeof width === 'number' ? width : undefined }}>
      {label && <div style={{ fontFamily: rbx.font, fontSize: 10, fontWeight: 'bold', color: '#fff', textShadow: '1px 1px 0 #000' }}>{label}</div>}
      <div ref={barRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        style={{ width: '100%', height, background: rbx.healthBg, border: '2px solid #000', boxShadow: 'inset 1px 1px 0 #444', position: 'relative', overflow: 'hidden', cursor: onChange ? 'url("/images/Link%20Select.cur") 3 3, pointer' : 'default', touchAction: onChange ? 'none' : undefined }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct + '%', background: 'linear-gradient(180deg, #66ff66 0%, #00b400 45%, #008000 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)', transition: dragging.current ? 'none' : 'width 0.08s linear', pointerEvents: 'none' }} />
      </div>
    </div>
  );
}

function PianoRoll({ notes, onChange, selectedId, onSelect, playhead, duration, playheadSink }) {
  const scrollRef = React.useRef(null);
  const lineRef = React.useRef(null);
  const dragRef = React.useRef(null);
  const [pxPerSec, setPxPerSec] = React.useState(80);
  const [fitWidth, setFitWidth] = React.useState(false);
  const [view, setView] = React.useState({ left: 0, width: 900 });
  const rowH = 12, minPitch = 24, maxPitch = 96, pitchCount = maxPitch - minPitch + 1;
  const pxRef = React.useRef(pxPerSec);
  pxRef.current = pxPerSec;
  React.useEffect(() => {
    if (!fitWidth || !scrollRef.current) return undefined;
    const updateFit = () => {
      const available = Math.max(240, scrollRef.current.clientWidth - 8);
      const targetDuration = Math.max(duration || 4, 4, ...notes.map(n => n.startTimeSeconds + n.durationSeconds));
      setPxPerSec(Math.max(30, Math.min(200, available / targetDuration)));
    };
    updateFit();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateFit) : null;
    if (observer) observer.observe(scrollRef.current);
    window.addEventListener('resize', updateFit);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', updateFit);
    };
  }, [fitWidth, duration, notes.length]);
  const paintLine = React.useCallback((time) => {
    const line = lineRef.current;
    if (!line) return;
    if (time == null || !Number.isFinite(time)) {
      line.style.display = 'none';
      return;
    }
    line.style.display = 'block';
    line.style.left = (time * pxRef.current) + 'px';
  }, []);
  React.useEffect(() => {
    if (playheadSink) playheadSink.current = paintLine;
    paintLine(playhead);
    return () => {
      if (playheadSink && playheadSink.current === paintLine) playheadSink.current = null;
    };
  }, [playheadSink, paintLine, playhead, pxPerSec]);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    let frame = 0;
    const measure = () => {
      setView({ left: el.scrollLeft, width: el.clientWidth || 900 });
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => { frame = 0; measure(); });
    };
    measure();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  const totalDur = Math.max(duration || 4, 4, ...notes.map(n => n.startTimeSeconds + n.durationSeconds));
  const width = Math.max(400, totalDur * pxPerSec + 40);
  const height = pitchCount * rowH;
  const pitchToY = p => (maxPitch - p) * rowH;
  const yToPitch = y => Math.max(minPitch, Math.min(maxPitch, maxPitch - Math.floor(y / rowH)));
  const xToTime = x => Math.max(0, x / pxPerSec);
  const timeToX = t => t * pxPerSec;
  const roleColor = id => (roles.find(r => r.id === id) || roles[2]).color;
  const t0 = view.left / pxPerSec - 1;
  const t1 = (view.left + view.width) / pxPerSec + 1;
  const draggedId = dragRef.current && dragRef.current.id;
  const visibleNotes = notes.filter(note => {
    if (note.id === selectedId || note.id === draggedId) return true;
    const start = note.startTimeSeconds;
    return start < t1 && start + note.durationSeconds > t0;
  });
  const onNotePointerDown = (e, note, mode) => {
    e.stopPropagation(); e.preventDefault(); onSelect(note.id);
    dragRef.current = { id: note.id, mode, origStart: note.startTimeSeconds, origDur: note.durationSeconds, origPitch: note.pitchMidi, startX: e.clientX, startY: e.clientY };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
  };
  const onNotePointerMove = e => {
    const d = dragRef.current; if (!d) return;
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    onChange(notes.map(n => {
      if (n.id !== d.id) return n;
      if (d.mode === 'resize') return { ...n, durationSeconds: Math.round(Math.max(0.05, d.origDur + dx / pxPerSec) * 100) / 100 };
      return { ...n, startTimeSeconds: Math.round(Math.max(0, d.origStart + dx / pxPerSec) * 100) / 100, pitchMidi: Math.max(0, Math.min(127, d.origPitch - Math.round(dy / rowH))) };
    }));
  };
  const onNotePointerUp = e => { dragRef.current = null; try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {} };
  const onGridDoubleClick = e => {
    if (e.target !== e.currentTarget && !e.target.dataset.grid) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newNote = { id: Date.now(), pitchMidi: yToPitch(y), startTimeSeconds: Math.round(xToTime(x) * 8) / 8, durationSeconds: 0.25, amplitude: 0.85, role: 'guitar' };
    onChange([...notes, newNote]); onSelect(newNote.id);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 220 }}>
      <div style={{ display: 'flex', gap: 6, padding: '4px 6px', background: rbx.blue, color: '#fff', fontSize: 11, fontWeight: 'bold', borderBottom: '2px solid #000', alignItems: 'center', flexShrink: 0 }}>
        <span>Piano Roll</span>
        <span style={{ fontWeight: 'normal', opacity: 0.9, fontSize: 10 }}>drag · edge = length · double-click = add</span>
        <button type="button" style={{ ...btnGray, marginLeft: 'auto', padding: '1px 6px', fontSize: 10 }} onClick={() => { setFitWidth(false); setPxPerSec(p => Math.min(200, p + 20)); }}>Zoom +</button>
        <button type="button" style={{ ...btnGray, padding: '1px 6px', fontSize: 10 }} onClick={() => { setFitWidth(false); setPxPerSec(p => Math.max(30, p - 20)); }}>Zoom −</button>
        <button type="button" style={{ ...btnGray, padding: '1px 6px', fontSize: 10 }} onClick={() => setFitWidth(v => !v)}>{fitWidth ? 'Fit: ON' : 'Fit'}</button>
        <button type="button" style={{ ...btn, background: '#e8a0a0', padding: '1px 6px', fontSize: 10 }} onClick={() => { if (selectedId == null) return; onChange(notes.filter(n => n.id !== selectedId)); onSelect(null); }} disabled={selectedId == null}>Del</button>
      </div>
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'auto', background: '#111722', overscrollBehavior: 'contain' }}>
        <div data-grid="1" onDoubleClick={onGridDoubleClick} style={{ position: 'relative', width: Math.max(width, scrollRef.current ? scrollRef.current.clientWidth - 2 : 0), height: Math.max(height, scrollRef.current ? scrollRef.current.clientHeight - 2 : 0), minWidth: 400, minHeight: height, backgroundImage: 'linear-gradient(to bottom, transparent ' + (rowH - 1) + 'px, #2a3040 ' + (rowH - 1) + 'px), linear-gradient(to right, transparent ' + (pxPerSec / 4 - 1) + 'px, #252b38 ' + (pxPerSec / 4 - 1) + 'px)', backgroundSize: pxPerSec / 4 + 'px ' + rowH + 'px' }}>
          {Array.from({ length: pitchCount }, (_, i) => {
            const p = maxPitch - i; if (p % 12 !== 0) return null;
            return <div key={'c' + p} data-grid="1" style={{ position: 'absolute', left: 0, right: 0, top: i * rowH, height: rowH, background: 'rgba(110,153,201,0.12)', pointerEvents: 'none' }} />;
          })}
          {visibleNotes.map(note => {
            const left = timeToX(note.startTimeSeconds), w = Math.max(4, timeToX(note.durationSeconds)), top = pitchToY(note.pitchMidi), sel = note.id === selectedId;
            const loudness = 0.42 + 0.58 * Math.max(0.12, Math.min(1, note.amplitude || 0.7));
            return (
              <div key={note.id} onPointerDown={e => onNotePointerDown(e, note, 'move')} onPointerMove={onNotePointerMove} onPointerUp={onNotePointerUp} onPointerCancel={onNotePointerUp}
                style={{ position: 'absolute', left, top, width: w, height: rowH - 2, marginTop: 1, background: roleColor(note.role), border: sel ? '2px solid #fff' : '1px solid #000', boxSizing: 'border-box', borderRadius: 2, cursor: 'grab', zIndex: sel ? 3 : 2, opacity: loudness }} title={note.role + ' · ' + note.pitchMidi + ' · vol ' + Math.round((note.amplitude || 0) * 100)}>
                <div onPointerDown={e => onNotePointerDown(e, note, 'resize')} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize', background: 'rgba(0,0,0,0.25)' }} />
              </div>
            );
          })}
          <div ref={lineRef} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: '#f5cd2f', pointerEvents: 'none', zIndex: 5, display: 'none' }} />
        </div>
      </div>
    </div>
  );
}

// Overlapping notes on one channel and pitch share a noteOff, so the first
// release kills whatever is still supposed to be sounding. Drums stay
// separate hits; tonal parts join into a single hold.
function glueArrangement(notes) {
  const groups = new Map();
  (notes || []).forEach(note => {
    const key = note.role + ':' + Math.round(note.pitchMidi);
    const list = groups.get(key) || [];
    list.push({ ...note });
    groups.set(key, list);
  });
  const out = [];
  groups.forEach(list => {
    list.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
    let current = null;
    list.forEach(note => {
      if (note.role === 'drums' || note.role === 'timpani') {
        if (current) {
          const prevEnd = current.startTimeSeconds + current.durationSeconds;
          if (note.startTimeSeconds < prevEnd) {
            current.durationSeconds = Math.max(0.04, note.startTimeSeconds - current.startTimeSeconds - 0.012);
          }
        }
        current = { ...note, durationSeconds: Math.max(0.04, note.durationSeconds) };
        out.push(current);
        return;
      }
      if (current && note.startTimeSeconds <= current.startTimeSeconds + current.durationSeconds + 0.035) {
        const end = Math.max(current.startTimeSeconds + current.durationSeconds, note.startTimeSeconds + note.durationSeconds);
        current.durationSeconds = Math.max(0.05, end - current.startTimeSeconds);
        current.amplitude = Math.max(current.amplitude || 0, note.amplitude || 0);
        return;
      }
      current = { ...note, durationSeconds: Math.max(0.05, note.durationSeconds) };
      out.push(current);
    });
  });
  return out.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi);
}

function chunkRanges(sampleCount, sampleRate) {
  const chunkSeconds = 32;
  const overlapSeconds = 1.5;
  const chunkLength = Math.max(1, Math.floor(sampleRate * chunkSeconds));
  const hopLength = Math.max(1, Math.floor(sampleRate * (chunkSeconds - overlapSeconds)));
  const minTail = Math.max(1, Math.floor(sampleRate * 8));
  if (sampleCount <= chunkLength) return [{ start: 0, end: sampleCount }];
  const ranges = [];
  for (let start = 0; start < sampleCount; start += hopLength) {
    const end = Math.min(sampleCount, start + chunkLength);
    const shortTail = end === sampleCount && end - start < minTail;
    const from = shortTail ? Math.max(0, sampleCount - chunkLength) : start;
    const last = ranges[ranges.length - 1];
    if (!last || last.start !== from || last.end !== end) ranges.push({ start: from, end });
    if (end >= sampleCount) break;
  }
  return ranges;
}

function stitchChunkNotes(notes, seams) {
  const boundaries = (seams || []).filter(value => Number.isFinite(value));
  const sorted = (notes || []).slice().sort((a, b) => a.pitchMidi - b.pitchMidi || a.startTimeSeconds - b.startTimeSeconds);
  const out = [];
  sorted.forEach(note => {
    const prev = out[out.length - 1];
    const start = Math.max(0, Number(note.startTimeSeconds) || 0);
    const dur = Math.max(0.05, Number(note.durationSeconds) || 0);
    const prevEnd = prev ? prev.startTimeSeconds + prev.durationSeconds : 0;
    const nearSeam = prev && boundaries.some(boundary => Math.abs(prevEnd - boundary) <= 0.45 || Math.abs(start - boundary) <= 0.45);
    const join = nearSeam ? 0.55 : 0.16;
    if (prev && prev.pitchMidi === note.pitchMidi && start <= prevEnd + join) {
      const end = Math.max(prevEnd, start + dur);
      prev.durationSeconds = end - prev.startTimeSeconds;
      prev.amplitude = Math.max(prev.amplitude || 0, note.amplitude || 0);
      return;
    }
    out.push({ ...note, startTimeSeconds: start, durationSeconds: dur });
  });
  return out.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi);
}

function noteOffCutsHeldNote(notes, note, offTime) {
  const pitch = note.pitchMidi;
  const role = note.role;
  for (let i = 0; i < notes.length; i++) {
    const other = notes[i];
    if (other === note || other.role !== role || other.pitchMidi !== pitch) continue;
    const start = other.startTimeSeconds;
    const end = start + other.durationSeconds;
    if (start < offTime - 0.004 && end > offTime + 0.004) return true;
  }
  return false;
}


function placeNameFromFile(file) {
  const raw = String(file && file.name ? file.name : '').replace(/\\/g, '/').split('/').pop();
  const dot = raw.lastIndexOf('.');
  const base = (dot > 0 ? raw.slice(0, dot) : raw).trim();
  return base || 'Untitled Place';
}

function midiDownloadName(name) {
  const cleaned = String(name || '').trim().replace(/[\\/:*?"<>|]/g, '').trim();
  return (cleaned || 'Untitled Place') + '.mid';
}

function makeMidi(notes, programs, soundfontRoles, name) {
  const midi = new Midi();
  midi.name = (name && String(name).trim()) || 'Untitled Place';
  midi.header.setTempo(120);
  roles.forEach(role => {
    const roleNotes = notes.filter(note => note.role === role.id);
    if (!roleNotes.length) return;
    const track = midi.addTrack();
    track.name = role.label;
    track.channel = role.channel;
    let lastBankId = null;
    track.instrument.number = programs && programs[role.id] != null ? programs[role.id] : role.program;
    const volume = mixValue(role.id, notes, soundfontRoles, ORCHESTRA_VOLUME, ROLE_VOLUME[role.id]);
    const pan = mixValue(role.id, notes, soundfontRoles, ORCHESTRA_PAN, 64);
    if (typeof track.addCC === 'function' && volume != null) {
      track.addCC({ controllerType: 7, value: volume / 127, time: 0 });
      track.addCC({ controllerType: 10, value: pan / 127, time: 0 });
    }
    roleNotes.forEach(note => {
      const bank = bankForNote(note, { soundfontRoles });
      if (bank && bank.id !== lastBankId && typeof track.addCC === 'function') {
        track.addCC({ controllerType: 0, value: (bank.bankOffset || 0) / 127, time: Math.max(0, note.startTimeSeconds - 0.001) });
        track.addCC({ controllerType: 32, value: 0, time: Math.max(0, note.startTimeSeconds - 0.001) });
        lastBankId = bank.id;
      }
      track.addNote({
        midi: note.pitchMidi,
        time: note.startTimeSeconds,
        duration: Math.max(0.04, note.durationSeconds),
        velocity: Math.max(0.15, Math.min(1, note.amplitude || 0.8)),
      });
    });
  });
  return new Blob([midi.toArray()], { type: 'audio/midi' });
}

function encodeWav(audioBuffer) {
  const channels = Math.min(2, audioBuffer.numberOfChannels);
  const sampleRate = audioBuffer.sampleRate;
  const frames = audioBuffer.length;
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + frames * channels * bytesPerSample);
  const view = new DataView(buffer);
  const write = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  write(0, 'RIFF'); view.setUint32(4, 36 + frames * channels * bytesPerSample, true);
  write(8, 'WAVE'); write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample); view.setUint16(34, 16, true);
  write(36, 'data'); view.setUint32(40, frames * channels * bytesPerSample, true);
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let ch = 0; ch < channels; ch++) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

async function renderCombinedWav(notes, duration, onProgress, plan) {
  const activePlan = plan || {};
  const musicalEnd = Math.max(0.25, Math.min(MAX_SECONDS, duration || 0));
  const recordSeconds = Math.min(MAX_SECONDS, musicalEnd + RELEASE_TAIL);
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error('Web Audio is unavailable in this browser.');
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('This browser cannot export SoundFont audio as WAV.');
  }

  const context = new AudioContextClass({ sampleRate: 44100 });
  let synth = null;
  let recorder = null;

  try {
    await context.audioWorklet.addModule(SPESSA_PROCESSOR_URL);
    const WorkletSynthesizer = await loadWorkletSynthesizer();
    synth = new WorkletSynthesizer(context);

    const playable = planWithSoundBanks(notes, activePlan);
    const loadedBanks = new Set();
    for (const bank of playable.soundfontPalette) {
      if (await addBankToSynth(synth, bank)) loadedBanks.add(bank.id);
    }
    await synth.isReady;

    const destination = context.createMediaStreamDestination();
    synth.connect(destination);

    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';
    recorder = new MediaRecorder(destination.stream, mimeType ? { mimeType } : undefined);

    const chunks = [];
    const recordingDone = new Promise((resolve, reject) => {
      recorder.ondataavailable = event => {
        if (event.data && event.data.size) chunks.push(event.data);
      };
      recorder.onerror = event => reject(event.error || new Error('SoundFont recording failed.'));
      recorder.onstop = () => resolve();
    });

    if (typeof synth.systemReset === 'function') synth.systemReset();
    const programs = playable.programs || ORCHESTRA_PROGRAMS;
    const usedRoles = new Set(notes.map(note => note && note.role).filter(Boolean));
    roles.forEach(role => {
      if (!usedRoles.has(role.id)) return;
      const bank = getRoleBank(role.id, playable);
      if (!bank || !loadedBanks.has(bank.id)) return;
      synth.controllerChange(role.channel, 0, bank.bankOffset || 0);
      synth.controllerChange(role.channel, 32, 0);
      synth.programChange(role.channel, programs[role.id] != null ? programs[role.id] : role.program);
      synth.controllerChange(role.channel, 7, mixValue(role.id, notes, playable.soundfontRoles, ORCHESTRA_VOLUME, ROLE_VOLUME[role.id] != null ? ROLE_VOLUME[role.id] : 100));
      synth.controllerChange(role.channel, 10, mixValue(role.id, notes, playable.soundfontRoles, ORCHESTRA_PAN, 64));
      if (usesOrchestra(notes, playable.soundfontRoles) && ORCHESTRA_REVERB[role.id] != null) {
        synth.controllerChange(role.channel, 91, ORCHESTRA_REVERB[role.id]);
      }
    });

    await context.resume();
    const baseTime = context.currentTime + 0.08;

    recorder.start();
    const total = Math.max(1, notes.length);
    const lastBankByChannel = {};
    notes.forEach((note, index) => {
      const channel = ROLE_CHANNEL[note.role] != null ? ROLE_CHANNEL[note.role] : 6;
      const startTime = Math.max(0, Math.min(musicalEnd - 0.001, Number(note.startTimeSeconds) || 0));
      const bank = bankForNote(note, playable);
      if (!bank || !loadedBanks.has(bank.id)) return;
      if (lastBankByChannel[channel] !== bank.id) {
        synth.controllerChange(channel, 0, bank.bankOffset || 0, { time: baseTime + startTime });
        synth.controllerChange(channel, 32, 0, { time: baseTime + startTime });
        const noteVolume = mixValue(note.role, notes, playable.soundfontRoles, ORCHESTRA_VOLUME, ROLE_VOLUME[note.role]);
        if (noteVolume != null) synth.controllerChange(channel, 7, noteVolume, { time: baseTime + startTime });
        lastBankByChannel[channel] = bank.id;
      }
      const durationSeconds = Math.max(
        0.025,
        Math.min(Number(note.durationSeconds) || 0.05, musicalEnd - startTime)
      );
      const velocity = Math.max(1, Math.min(127, Math.round((note.amplitude || 0.8) * 127)));

      synth.noteOn(channel, note.pitchMidi, velocity, { time: baseTime + startTime });
      synth.noteOff(channel, note.pitchMidi, { time: baseTime + startTime + durationSeconds });

      if (index % Math.max(1, Math.floor(total / 20)) === 0) {
        onProgress && onProgress(10 + Math.round((index / total) * 70));
      }
    });

    await new Promise(resolve => window.setTimeout(resolve, Math.ceil(recordSeconds * 1000)));
    onProgress && onProgress(85);
    recorder.stop();
    await recordingDone;

    const recorded = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
    const buffer = await recorded.arrayBuffer();
    const decoded = await context.decodeAudioData(buffer.slice(0));
    onProgress && onProgress(95);
    return encodeWav(decoded);
  } finally {
    try { if (recorder && recorder.state !== 'inactive') recorder.stop(); } catch (e) {}
    try { if (synth) synth.destroy(); } catch (e) {}
    try { await context.close(); } catch (e) {}
    onProgress && onProgress(100);
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function yieldToBrowser() {
  return new Promise(resolve => {
    const hidden = typeof document !== 'undefined' && document.hidden;
    // requestAnimationFrame does not fire while the tab is hidden, which stalls
    // the next upload until the user comes back. A hidden tab only needs a timer.
    if (!hidden && typeof window !== 'undefined' && window.requestAnimationFrame) {
      window.requestAnimationFrame(() => setTimeout(resolve, 0));
    } else {
      setTimeout(resolve, 0);
    }
  });
}

// Chrome throttles and can freeze a hidden tab that is silent. A quiet loop
// counts as playing audio, so a conversion keeps uploading after you leave.
function startConversionKeepAlive() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return function () {};
  let context;
  try { context = new AudioContextClass(); } catch (e) { return function () {}; }
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = 28;
  gain.gain.value = 0.001;
  oscillator.connect(gain);
  gain.connect(context.destination);
  try { oscillator.start(); } catch (e) {}
  const resume = () => { if (context.state !== 'closed') context.resume().catch(() => {}); };
  resume();
  document.addEventListener('visibilitychange', resume);
  return () => {
    document.removeEventListener('visibilitychange', resume);
    try { oscillator.stop(); } catch (e) {}
    context.close().catch(() => {});
  };
}

function encodeMonoFloatWav(left, right, sampleRate) {
  const sourceLength = Math.min(left.length, right.length);
  const ratio = Math.max(1, Math.round(sampleRate / 22050));
  const outRate = Math.floor(sampleRate / ratio);
  const frames = Math.max(1, Math.ceil(sourceLength / ratio));
  const buffer = new ArrayBuffer(44 + frames * 2);
  const view = new DataView(buffer);
  const write = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  write(0, 'RIFF'); view.setUint32(4, 36 + frames * 2, true);
  write(8, 'WAVE'); write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, outRate, true); view.setUint32(28, outRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, 'data'); view.setUint32(40, frames * 2, true);
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    const start = i * ratio;
    const end = Math.min(sourceLength, start + ratio);
    let sum = 0;
    for (let j = start; j < end; j++) sum += ((left[j] || 0) + (right[j] || 0)) * 0.5;
    const sample = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function decodeToMono(file) {
  const bytes = await file.arrayBuffer();
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(bytes.slice(0));
    const length = decoded.length;
    const channels = decoded.numberOfChannels || 1;
    const mono = new Float32Array(length);
    for (let channel = 0; channel < channels; channel++) {
      const data = decoded.getChannelData(channel);
      const scale = 1 / channels;
      for (let i = 0; i < length; i++) {
        mono[i] += data[i] * scale;
        if ((i & 262143) === 0) await yieldToBrowser();
      }
    }
    return { samples: mono, sampleRate: decoded.sampleRate, duration: decoded.duration };
  } finally {
    await context.close().catch(() => {});
  }
}

function serverGaveUp(error) {
  const message = String(error && error.message || '');
  return (error && (error.name === 'AbortError' || error.name === 'TypeError'))
    || /failed to fetch|network|timed out|server busy|not answering/i.test(message);
}

async function postBloxify(file, timeoutMs, attempts) {
  let lastError = null;
  const tries = attempts || 2;
  for (let attempt = 0; attempt < tries; attempt++) {
    if (attempt > 0) await sleep(3000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs || 90000);
    try {
      const form = new FormData();
      form.append('audio', file, file.name || 'audio.wav');
      let res = await fetch(API_BASE + '/robloxify', { method: 'POST', body: form, signal: controller.signal });
      if (res.status === 404) {
        const fallback = new FormData();
        fallback.append('audio', file, file.name || 'audio.wav');
        res = await fetch(API_BASE + '/bloxify', { method: 'POST', body: fallback, signal: controller.signal });
      }
      const data = await res.json().catch(() => ({}));
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        lastError = new Error(data.error || 'Server not answering');
        continue;
      }
      if (!res.ok) throw new Error(data.error || 'Server error ' + res.status);
      if (!Array.isArray(data.notes)) throw new Error('Server returned no notes');
      return data;
    } catch (error) {
      if (!serverGaveUp(error)) throw error;
      lastError = error && error.name === 'AbortError'
        ? new Error('Bloxify timed out while the server was reading this part.')
        : error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError || new Error('Failed to fetch');
}

function usableNotes(notes, offset) {
  return (notes || []).filter(note =>
    note &&
    Number.isFinite(Number(note.pitchMidi)) &&
    Number.isFinite(Number(note.startTimeSeconds)) &&
    Number.isFinite(Number(note.durationSeconds))
  ).map(note => ({ ...note, startTimeSeconds: Number(note.startTimeSeconds) + offset }));
}

async function serverIsAwake() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(API_BASE + '/health', { cache: 'no-store', signal: controller.signal });
    return !!(res && res.ok);
  } catch (e) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function transcribeOnBackend(file, onStatus) {
  onStatus('Reading the audio.');
  let decoded = null;
  try { decoded = await decodeToMono(file); } catch (e) { decoded = null; }
  if (!decoded || !decoded.samples || !decoded.samples.length) {
    onStatus('Uploading the audio.');
    const data = await postBloxify(file, 120000, 2);
    const notes = usableNotes(data.notes, 0);
    if (!notes.length) throw new Error('No notes detected — try a clearer song.');
    const duration = Number(data.duration);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('Server returned an invalid audio duration');
    return { notes, duration, aiPlan: data.aiPlan || null, stemSeparation: data.stemSeparation || 'unknown' };
  }
  if (decoded.duration > MAX_SECONDS) throw new Error('Audio must be under 5 minutes.');
  const ranges = chunkRanges(decoded.samples.length, decoded.sampleRate);
  const partCount = ranges.length;
  const notes = [];
  let aiPlan = null;
  for (let part = 0; part < partCount; part++) {
    onStatus(partCount === 1
      ? 'Uploading the audio.'
      : 'Uploading part ' + (part + 1) + ' of ' + partCount + '.');
    if (typeof document === 'undefined' || !document.hidden) await yieldToBrowser();
    const range = ranges[part];
    const slice = decoded.samples.subarray(range.start, range.end);
    const wav = encodeMonoFloatWav(slice, slice, decoded.sampleRate);
    const piece = new File([wav], 'part-' + (part + 1) + '.wav', { type: 'audio/wav' });
    const data = await postBloxify(piece, part === 0 ? 120000 : 75000, part === 0 ? 2 : 1);
    if (!aiPlan && data.aiPlan) aiPlan = data.aiPlan;
    notes.push(...usableNotes(data.notes, range.start / decoded.sampleRate));
    onStatus(partCount === 1
      ? 'Reading pitch, start time, and length.'
      : 'Reading pitch, start time, and length. Part ' + (part + 1) + ' of ' + partCount + '.');
  }
  const seams = ranges.slice(0, -1).map(range => range.end / decoded.sampleRate);
  const stitched = stitchChunkNotes(notes, seams);
  if (!stitched.length) throw new Error('No notes detected — try a clearer song.');
  return { notes: stitched, duration: decoded.duration, aiPlan, stemSeparation: 'chunked' };
}

async function transcribeSong(file, onStatus) {
  // Pitch detection in this tab loads TensorFlow on the page thread and
  // freezes the whole desktop. Keep trying the server instead.
  onStatus('Waking the server.');
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      onStatus('Server is still starting. Waiting.');
      await sleep(5000);
    }
    const awake = await serverIsAwake();
    if (!awake) {
      lastError = new Error('Bloxify server is still starting. Try again in a minute.');
      continue;
    }
    try {
      return await transcribeOnBackend(file, onStatus);
    } catch (error) {
      lastError = error;
      if (!serverGaveUp(error)) throw error;
      onStatus('Server stopped answering. Trying again.');
    }
  }
  throw lastError || new Error('Bloxify server is still starting. Try again in a minute.');
}

function MusicAI() {
  const STORAGE_KEY = 'bloxify-projects-v2'; const COOKIE_KEY = 'bloxify-last-project'; const PLAYER_KEY = 'bloxify-player-name-v1';
  function readCookie(name) { const prefix = name + '='; const item = document.cookie.split('; ').find(v => v.indexOf(prefix) === 0); return item ? decodeURIComponent(item.slice(prefix.length)) : ''; }
  function writeCookie(name, value) { document.cookie = name + '=' + encodeURIComponent(value) + '; max-age=31536000; path=/; SameSite=Lax'; }
  function readStorage(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
  function adoptStorage(key, legacy) { const current = readStorage(key); if (current != null) return current; const previous = readStorage(legacy); if (previous != null) { try { window.localStorage.setItem(key, previous); } catch (e) {} } return previous; }
  function loadProjects() { try { const value = adoptStorage(STORAGE_KEY, 'robloxify-projects-v2'); return value ? JSON.parse(value) : []; } catch (e) { return []; } }
  function persistProjects(value) { try { const serialized = JSON.stringify(value); window.localStorage.setItem(STORAGE_KEY, serialized); return window.localStorage.getItem(STORAGE_KEY) === serialized; } catch (e) { return false; } }
  const synthRef = useRef(null); const contextRef = useRef(null); const planRef = useRef(null); const loadedBanksRef = useRef(new Set());
  const [file, setFile] = useState(null); const [midiBlob, setMidiBlob] = useState(null); const [arrangement, setArrangement] = useState([]);
  const [wavBlob, setWavBlob] = useState(null); const [renderingWav, setRenderingWav] = useState(false);
  const [status, setStatus] = useState('Drop audio → Bloxify version of your song');
  const [progress, setProgress] = useState(0); const [working, setWorking] = useState(false); const [playing, setPlaying] = useState(false); const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [projectName, setProjectName] = useState(() => readCookie(COOKIE_KEY) || readCookie('robloxify-last-project') || 'Untitled Place'); const [playerName, setPlayerName] = useState(() => adoptStorage(PLAYER_KEY, 'robloxify-player-name-v1') || ''); const [playerInput, setPlayerInput] = useState(() => adoptStorage(PLAYER_KEY, 'robloxify-player-name-v1') || ''); const [playerProjects, setPlayerProjects] = useState([]); const [playerTracks, setPlayerTracks] = useState([]); const [playerBusy, setPlayerBusy] = useState(false);
  const [projects, setProjects] = useState(() => loadProjects()); const [showProjects, setShowProjects] = useState(false);
  const [communityTracks, setCommunityTracks] = useState([]); const [communityLoading, setCommunityLoading] = useState(false); const [publishing, setPublishing] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState(null); const [volume, setVolume] = useState(0.85);
  const [playbackTime, setPlaybackTime] = useState(0); const [playbackDuration, setPlaybackDuration] = useState(0);
  const [activePlan, setActivePlan] = useState(null);
  const savePlayerLocal = name => { try { window.localStorage.setItem(PLAYER_KEY, name); } catch (e) {} };
  const loadPlayer = useCallback(async name => {
    const clean = String(name || '').trim(); if (!clean) return false;
    setPlayerBusy(true);
    try {
      let response = await fetch(API_BASE + '/players/' + encodeURIComponent(clean), { cache: 'no-store' });

      // Render's free filesystem can reset after a restart. If this browser
      // still has the player's saved name, recreate the server-side record
      // instead of leaving Player List stuck on a 404.
      if (response.status === 404) {
        response = await fetch(API_BASE + '/players/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: clean }),
        });
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.player) return false;
      setPlayerName(data.player.name); setPlayerInput(data.player.name); setPlayerProjects(Array.isArray(data.projects) ? data.projects : []); setProjects(prev => { const merged = [...(data.projects || []), ...prev.filter(p => !(data.projects || []).some(q => String(q.id) === String(p.id)))]; return merged.slice(0, 100); }); setPlayerTracks(Array.isArray(data.tracks) ? data.tracks : []); savePlayerLocal(data.player.name); return true;
    } catch (e) { return false; } finally { setPlayerBusy(false); }
  }, []);
  useEffect(() => { if (playerName) loadPlayer(playerName); }, []);
;
  const registerPlayer = useCallback(async () => {
    const clean = String(playerInput || '').trim();
    if (!clean) return;
    setPlayerBusy(true);
    try {
      const response = await fetch(API_BASE + '/players/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clean }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409) {
        setStatus(data.error || 'That name is already taken.');
        return;
      }
      if (!response.ok || !data.player) {
        throw new Error(data.error || 'Could not save player name.');
      }
      setPlayerName(data.player.name);
      setPlayerInput(data.player.name);
      setPlayerProjects(Array.isArray(data.projects) ? data.projects : []);
      setPlayerTracks(Array.isArray(data.tracks) ? data.tracks : []);
      savePlayerLocal(data.player.name);
      setProjects(prev => {
        const incoming = Array.isArray(data.projects) ? data.projects : [];
        const merged = [...incoming, ...prev.filter(p => !incoming.some(q => String(q.id) === String(p.id)))];
        return merged.slice(0, 100);
      });
      setStatus('Player name saved: ' + data.player.name);
    } catch (e) {
      setStatus(e.message || 'Could not save player name.');
    } finally {
      setPlayerBusy(false);
    }
  }, [playerInput]);



  const playbackStopTimerRef = useRef(null); const playbackRafRef = useRef(null); const conversionIdRef = useRef(0);
  const scheduledTimersRef = useRef([]); const playStartRef = useRef(0); const seekOffsetRef = useRef(0);
  const playheadSinkRef = useRef(null); const lastUiTimeRef = useRef(0);

  const stopPlaybackInternal = () => {
    if (playbackStopTimerRef.current) { window.clearTimeout(playbackStopTimerRef.current); playbackStopTimerRef.current = null; }
    if (playbackRafRef.current) { window.cancelAnimationFrame(playbackRafRef.current); window.clearTimeout(playbackRafRef.current); playbackRafRef.current = null; }
    scheduledTimersRef.current.forEach(id => clearTimeout(id)); scheduledTimersRef.current = [];
    if (synthRef.current) { try { for (let ch = 0; ch < 16; ch++) { if (typeof synthRef.current.stopAll === 'function') synthRef.current.stopAll(ch); } } catch (e) {} }
  };

  useEffect(() => () => {
    stopPlaybackInternal();
    if (synthRef.current) { try { synthRef.current.destroy(); } catch (e) {} synthRef.current = null; }
    loadedBanksRef.current = new Set();
    if (contextRef.current) { contextRef.current.close().catch(() => {}); contextRef.current = null; }
  }, []);

  const convert = async inputFile => {
    const extension = String(inputFile && inputFile.name || '').toLowerCase().split('.').pop();
    const allowedExtensions = new Set(['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'oga', 'aif', 'aiff', 'webm']);
    const isAudio = !!inputFile && ((inputFile.type || '').startsWith('audio/') || allowedExtensions.has(extension));
    if (!isAudio) { setStatus('Choose an audio file'); return; }
    if (inputFile.size > MAX_BYTES) { setStatus('File too large (max 50 MB)'); return; }
    const conversionId = ++conversionIdRef.current;
    if (working) { setStatus('Already converting…'); return; }
    const placeName = placeNameFromFile(inputFile);
    setFile(inputFile); setProjectName(placeName); writeCookie(COOKIE_KEY, placeName); setWorking(true); setProgress(0); setLoadingSeconds(0); setPlaybackTime(0); setPlaybackDuration(0); setStatus('Checking the audio file.');
    const stopKeepAlive = startConversionKeepAlive();
    const loadingStartedAt = performance.now();
    const paintLoadingSeconds = () => {
      if (conversionId === conversionIdRef.current) {
        setLoadingSeconds(Math.floor((performance.now() - loadingStartedAt) / 1000));
      }
    };
    const loadingTimer = window.setInterval(paintLoadingSeconds, 250);
    document.addEventListener('visibilitychange', paintLoadingSeconds);
    try {
      let rawNotes = []; let duration = 0; let usedBackend = true; let aiPlan = null;
      // Keep heavy transcription off the mobile main thread. The browser-side
      // TensorFlow/Basic Pitch path can monopolize Safari's CPU and make the
      // entire XP window appear frozen. The Render worker handles transcription,
      // while this lightweight progress ticker keeps the UI visibly responsive.
      let displayedProgress = 5;
      setProgress(displayedProgress);
      const progressTimer = window.setInterval(() => {
        displayedProgress = Math.min(82, displayedProgress + (displayedProgress < 45 ? 3 : 1));
        if (conversionId === conversionIdRef.current) setProgress(displayedProgress);
      }, 350);
      try {
        // Stem separation downloads a large model and runs it in the browser
        // before the server can even start. The pre-baked style thinks from
        // the notes, so send the original file straight through.
        setStatus('Waking the server.');
        let result = await transcribeSong(inputFile, msg => {
          if (conversionId === conversionIdRef.current) {
            setStatus(msg);
            setProgress(Math.max(displayedProgress, 30));
          }
        }, value => {
          if (conversionId === conversionIdRef.current) {
            const pct = Math.max(30, Math.min(90, Math.round(30 + (Number(value) || 0) * 60)));
            displayedProgress = Math.max(displayedProgress, pct);
            setProgress(displayedProgress);
          }
        });
        if (conversionId !== conversionIdRef.current) return;
        rawNotes = result.notes;
        duration = result.duration || 0;
        aiPlan = result.aiPlan || null;
      } finally {
        window.clearInterval(progressTimer);
      }
      setStatus('Writing the orchestra under the tune.'); await yieldToBrowser();
      let fitted = buildFullArrangement(rawNotes, duration);
      if (!fitted.length) throw new Error('No notes detected — try a clearer song.');
      fitted = glueArrangement(fitted);
      setStatus('Loading violin, bass, drums, and the orchestra bank.'); await yieldToBrowser();
      const soundfontRoles = assignRoleBanks();
      const usedRoles = new Set(fitted.map(note => note.role));
      const palette = [];
      usedRoles.forEach(roleId => {
        const bank = SOUND_FONT_BY_ID[soundfontRoles[roleId]];
        if (bank && !palette.some(font => font.id === bank.id)) palette.push(bank);
      });
      fitted = stampSoundfontMix(fitted, palette, soundfontRoles);
      fitted = fitted.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi).map((n, i) => ({ ...n, id: i + 1 }));
      const instrumentCount = new Set(fitted.map(note => note.role)).size;
      const programs = programsForPlan(fitted, null, soundfontRoles);
      const plan = {
        ...(aiPlan || {}),
        label: 'Pre-baked Bloxify',
        reason: 'Classic Roblox orchestra. The violin follows the tune. Bass and cello move with the harmony, and strings, horn, flute, oboe, clarinet, harp, piano, pizzicato, trumpet, and timpani answer in phrases over a light kit.',
        fixedStyle: true,
        preBakedSoundFontCatalog: true,
        soundfonts: SOUNDFONT_LIBRARY,
        soundfontId: FIXED_SOUNDFONT_ID,
        soundfontPalette: palette,
        soundfontRoles,
        programs,
        drums: SOUND_FONT_ROLE_BANKS.drums,
      };
      planRef.current = plan; setActivePlan(plan);
      setArrangement(fitted); setSelectedNoteId(fitted[0] ? fitted[0].id : null);
      setMidiBlob(makeMidi(fitted, plan.programs, plan.soundfontRoles, placeName));
      setPlaybackDuration(heardEnd(fitted));
      setProgress(100);
      const songEnd = Math.max(duration || 0, fitted.reduce((max, note) => Math.max(max, note.startTimeSeconds + note.durationSeconds), 0));
      setStatus('Done — full ' + (Math.round(songEnd * 10) / 10) + 's · ' + fitted.length + ' notes · ' + instrumentCount + ' instruments · Roblox orchestra');
    } catch (error) {
      console.error(error);
      setStatus('Failed — ' + (error && error.message ? error.message : 'unknown'));
    } finally {
      window.clearInterval(loadingTimer);
      document.removeEventListener('visibilitychange', paintLoadingSeconds);
      stopKeepAlive();
      if (conversionId === conversionIdRef.current) {
        setLoadingSeconds(Math.floor((performance.now() - loadingStartedAt) / 1000));
        setWorking(false);
      }
    }
  };

  const updateArrangement = next => {
    const cleaned = next.slice().sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi);
    setArrangement(cleaned);
    const programs = (planRef.current && planRef.current.programs) || ORCHESTRA_PROGRAMS;
    setMidiBlob(makeMidi(cleaned, programs, planRef.current && planRef.current.soundfontRoles, projectName));
    setWavBlob(null);
    setPlaybackDuration(heardEnd(cleaned));
  };

  const downloadStem = roleId => {
    if (!arrangement.length) return;
    const programs = (planRef.current && planRef.current.programs) || ORCHESTRA_PROGRAMS;
    const role = roles.find(r => r.id === roleId);
    const blob = makeStemMidi(arrangement, roleId, programs);
    downloadBlob(blob, 'bloxify-' + roleId + '.mid');
  };

  const renderAndDownloadWav = async () => {
    if (!arrangement.length || renderingWav) return;
    setRenderingWav(true);
    setStatus('Rendering combined WAV…');
    try {
      const duration = arrangement.reduce((m, n) => Math.max(m, n.startTimeSeconds + n.durationSeconds), 0);
      const blob = await renderCombinedWav(arrangement, duration, p => setProgress(Math.max(100, p)), planRef.current);
      setWavBlob(blob);
      downloadBlob(blob, 'bloxify-combined.wav');
      setStatus('Combined WAV ready · ' + Math.round(duration * 10) / 10 + 's');
    } catch (error) {
      console.error(error);
      setStatus('WAV render failed — ' + (error.message || 'unknown'));
    } finally {
      setRenderingWav(false);
    }
  };

  const selectedNote = arrangement.find(n => n.id === selectedNoteId) || arrangement[0] || null;
  const editSelected = changes => {
    if (!selectedNote) return;
    const next = { ...changes };
    if (next.role && planRef.current && planRef.current.soundfontRoles && planRef.current.soundfontRoles[next.role]) {
      next.bankId = planRef.current.soundfontRoles[next.role];
    }
    updateArrangement(arrangement.map(n => (n.id === selectedNote.id ? { ...n, ...next } : n)));
  };

  const saveProject = async () => {
    if (!arrangement.length) { setStatus('Convert audio first'); return; }
    const playable = planWithSoundBanks(arrangement, activePlan || planRef.current);
    const project = { id: Date.now(), name: projectName.trim() || 'Untitled Place', sourceName: file ? file.name : 'Unknown', arrangement, plan: { label: 'Bloxify Arrangement', programs: playable.programs, soundfontRoles: playable.soundfontRoles, soundfontPalette: playable.soundfontPalette.map(font => font.id) }, savedAt: new Date().toISOString() };
    const next = [project, ...projects.filter(p => p.name !== project.name)].slice(0, 25);
    if (!persistProjects(next)) { setStatus('Could not save: browser storage is full or unavailable. Delete old saved places and try again.'); return; }
    setProjects(next);
    writeCookie(COOKIE_KEY, project.name);
    if (playerName) {
      try {
        const response = await fetch(API_BASE + '/players/' + encodeURIComponent(playerName) + '/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Player List backup failed');
        setPlayerProjects(prev => [data.project, ...prev.filter(p => String(p.id) !== String(data.project.id))].slice(0, 100));
        setStatus('Project saved on this device and to your Player List.');
      } catch (error) {
        setStatus('Project saved on this device, but Player List backup failed: ' + (error.message || 'server unavailable') + '.');
      }
    } else {
      setStatus('Project saved on this device.');
    }
  };

  const deleteProject = async project => {
    const next = projects.filter(item => String(item.id) !== String(project.id));
    if (!persistProjects(next)) { setStatus('Could not delete: browser storage is unavailable.'); return; }
    setProjects(next);
    setPlayerProjects(prev => prev.filter(item => String(item.id) !== String(project.id)));
    if (playerName) {
      try {
        const response = await fetch(API_BASE + '/players/' + encodeURIComponent(playerName) + '/projects/' + encodeURIComponent(project.id), { method: 'DELETE' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'server deletion failed');
        setStatus('Deleted "' + project.name + '" from saved places and Player List.');
      } catch (error) {
        setStatus('Deleted locally, but cloud copy could not be deleted: ' + (error.message || 'server unavailable') + '.');
      }
    } else {
      setStatus('Deleted "' + project.name + '" from saved places.');
    }
  };

  const loadProject = project => {
    setProjectName(project.name);
    const loaded = (project.arrangement || []).map((n, i) => ({ ...n, id: n.id || i + 1 }));
    setArrangement(loaded); setSelectedNoteId(loaded[0] ? loaded[0].id : null);
    const plan = planWithSoundBanks(loaded, project.plan);
    planRef.current = plan; setActivePlan(plan); setMidiBlob(makeMidi(loaded, plan.programs, plan.soundfontRoles, project.name)); setWavBlob(null); writeCookie(COOKIE_KEY, project.name);
    setShowProjects(false); setStatus('Loaded — ' + project.name);
  };

  const configureSynthRoles = (synth, notes) => {
    const programs = (planRef.current && planRef.current.programs) || ORCHESTRA_PROGRAMS;
    const usedRoles = new Set((notes || []).map(note => note && note.role).filter(Boolean));
    roles.forEach(role => {
      if (!usedRoles.has(role.id)) return;
      const bank = getRoleBank(role.id, planRef.current);
      if (!bank || !loadedBanksRef.current.has(bank.id)) return;
      const channel = role.channel;
      try {
        if (typeof synth.controllerChange === 'function') {
          synth.controllerChange(channel, 0, bank.bankOffset || 0);
          synth.controllerChange(channel, 32, 0);
        }
        synth.programChange(channel, programs[role.id] != null ? programs[role.id] : role.program);
        const volume = mixValue(role.id, notes, planRef.current && planRef.current.soundfontRoles, ORCHESTRA_VOLUME, ROLE_VOLUME[role.id]);
        const pan = mixValue(role.id, notes, planRef.current && planRef.current.soundfontRoles, ORCHESTRA_PAN, 64);
        if (typeof synth.controllerChange === 'function' && volume != null) {
          synth.controllerChange(channel, 7, volume);
          synth.controllerChange(channel, 10, pan);
          if (usesOrchestra(notes, planRef.current && planRef.current.soundfontRoles) && ORCHESTRA_REVERB[role.id] != null) {
            synth.controllerChange(channel, 91, ORCHESTRA_REVERB[role.id]);
          }
        }
      } catch (error) {
        console.warn('Bloxify patch setup failed for', role.id, error);
      }
    });
  };

  const ensureSynth = async (plan, notes) => {
    const usePlan = planWithSoundBanks(notes || arrangement, plan || planRef.current);
    planRef.current = usePlan;
    const requiredIds = new Set((usePlan.soundfontPalette || []).map(bank => bank && bank.id).filter(Boolean));
    const staleBank = [...loadedBanksRef.current].some(id => !requiredIds.has(id));
    let created = false;
    if (!synthRef.current || !contextRef.current || staleBank) {
      if (synthRef.current) { try { synthRef.current.destroy(); } catch (e) {} synthRef.current = null; }
      if (contextRef.current) { try { await contextRef.current.close(); } catch (e) {} contextRef.current = null; }
      loadedBanksRef.current = new Set();
      const context = new AudioContext(); contextRef.current = context;
      await context.audioWorklet.addModule(SPESSA_PROCESSOR_URL);
      const WorkletSynthesizer = await loadWorkletSynthesizer();
      synthRef.current = new WorkletSynthesizer(context);
      created = true;
    }
    const synth = synthRef.current;
    const pending = (usePlan.soundfontPalette || []).filter(bank => bank && !loadedBanksRef.current.has(bank.id));
    if (pending.length) setStatus(pending.some(bank => bank.id === 'general-user') ? 'Loading the orchestra.' : 'Loading the Roblox instruments.');
    for (const bank of pending) {
      if (await addBankToSynth(synth, bank)) loadedBanksRef.current.add(bank.id);
    }
    if ((created || pending.length) && synth.isReady) await synth.isReady;
    if (created && contextRef.current && typeof synth.connect === 'function') synth.connect(contextRef.current.destination);

    // Do not parse every SF2 file in parallel here. Large soundfonts can
    // consume enough memory/CPU to freeze the XP window. Extra banks are
    // loaded only when they are actually needed.
    return synth;
  };

  const stopPlayback = () => { stopPlaybackInternal(); setPlaying(false); };

  const scheduleFrom = (synth, fromTime) => {
    stopPlaybackInternal();
    if (typeof synth.systemReset === 'function') synth.systemReset();
    configureSynthRoles(synth, arrangement);
    if (typeof synth.setMainVolume === 'function') synth.setMainVolume(volume);
    const playEnd = heardEnd(arrangement);
    setPlaybackDuration(playEnd);
    const queue = arrangement.filter(note => note.startTimeSeconds + note.durationSeconds > fromTime)
      .slice()
      .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
    let index = 0;
    seekOffsetRef.current = fromTime;
    playStartRef.current = performance.now();
    lastUiTimeRef.current = -1;
    setPlaybackTime(fromTime);
    setPlaying(true);
    const songNow = () => (performance.now() - playStartRef.current) / 1000 + seekOffsetRef.current;
    const paint = (time) => {
      const sink = playheadSinkRef.current;
      if (typeof sink === 'function') sink(time);
    };
    const armNote = (note, now) => {
      const bank = bankForNote(note, planRef.current);
      if (!bank || !loadedBanksRef.current.has(bank.id)) return;
      const ch = ROLE_CHANNEL[note.role] != null ? ROLE_CHANNEL[note.role] : 1;
      const delay = Math.max(0, (note.startTimeSeconds - now) * 1000);
      const dur = Math.max(0.05, note.durationSeconds - Math.max(0, now - note.startTimeSeconds));
      const vel = Math.max(1, Math.min(127, Math.round((note.amplitude || 0.8) * 127)));
      const offAt = note.startTimeSeconds + note.durationSeconds;
      scheduledTimersRef.current.push(window.setTimeout(() => {
        try {
          synth.controllerChange(ch, 0, bank.bankOffset || 0);
          synth.controllerChange(ch, 32, 0);
          const noteVolume = mixValue(note.role, arrangement, planRef.current && planRef.current.soundfontRoles, ORCHESTRA_VOLUME, ROLE_VOLUME[note.role]);
          if (noteVolume != null) synth.controllerChange(ch, 7, noteVolume);
          synth.noteOn(ch, note.pitchMidi, vel);
        } catch (e) {}
      }, delay));
      if (!noteOffCutsHeldNote(arrangement, note, offAt)) {
        scheduledTimersRef.current.push(window.setTimeout(() => {
          try { synth.noteOff(ch, note.pitchMidi); } catch (e) {}
        }, delay + dur * 1000));
      }
    };
    const pump = () => {
      const now = songNow();
      paint(now);
      if (now - lastUiTimeRef.current >= 0.25) {
        lastUiTimeRef.current = now;
        setPlaybackTime(Math.min(now, playEnd));
      }
      if (now >= playEnd) {
        setPlaybackTime(playEnd);
        setPlaying(false);
        return;
      }
      while (index < queue.length && queue[index].startTimeSeconds <= now + 0.18) {
        const note = queue[index++];
        if (note.startTimeSeconds + note.durationSeconds > now) armNote(note, now);
      }
      playbackRafRef.current = window.setTimeout(pump, 40);
    };
    pump();
  };

  const playArrangement = async () => {
    if (!arrangement.length) { setStatus('Nothing to play'); return; }
    try {
      const plan = planRef.current || {
        label: 'Bloxify Arrangement',
        fixedStyle: true,
        soundfonts: SOUNDFONT_LIBRARY,
        soundfontId: FIXED_SOUNDFONT_ID,
        programs: ORCHESTRA_PROGRAMS,
      };
      setStatus('Mixing the SoundFont catalog…');
      const synth = await ensureSynth(plan, arrangement);
      if (contextRef.current.state === 'suspended') await contextRef.current.resume();
      const from = playbackTime > 0 && playbackTime < playbackDuration - 0.05 ? playbackTime : 0;
      scheduleFrom(synth, from); setStatus('Playing');
    } catch (error) {
      console.error(error); setStatus('Playback failed — ' + (error.message || 'unknown')); setPlaying(false);
    }
  };

  const seekTo = async t => {
    const clamped = Math.max(0, Math.min(playbackDuration || t, t)); setPlaybackTime(clamped);
    if (typeof playheadSinkRef.current === 'function') playheadSinkRef.current(clamped);
    if (playing) {
      try {
        const plan = planRef.current || { label: 'Bloxify Arrangement', programs: ORCHESTRA_PROGRAMS };
        const synth = await ensureSynth(plan, arrangement);
        if (contextRef.current.state === 'suspended') await contextRef.current.resume();
        scheduleFrom(synth, clamped);
      } catch (e) { console.error(e); }
    }
  };

  const loadCommunityTracks = useCallback(async () => {
    setCommunityLoading(true);
    try {
      const response = await fetch(API_BASE + '/community/tracks', { cache: 'no-store' });
      if (!response.ok) throw new Error('Community list unavailable');
      const data = await response.json();
      setCommunityTracks(Array.isArray(data.tracks) ? data.tracks : []);
    } catch (error) {
      setCommunityTracks([]);
    } finally {
      setCommunityLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showProjects) loadCommunityTracks();
  }, [showProjects, loadCommunityTracks]);

  const publishTrack = useCallback(async project => {
    if (!project || publishing) return;
    if (!playerName) { setStatus('Choose your Player List name before publishing.'); return; }
    const name = String(project.name || '').trim();
    const notes = Array.isArray(project.arrangement) ? project.arrangement : [];
    if (!name || !notes.length) {
      setStatus('This saved place has no arrangement to publish.');
      return;
    }
    setPublishing(true);
    try {
      setStatus('Rendering "' + name + '" for publishing…');
      const plan = planWithSoundBanks(notes, project.plan);
      const duration = notes.reduce((max, note) => Math.max(max, (Number(note.startTimeSeconds) || 0) + (Number(note.durationSeconds) || 0)), 0);
      const audioBlob = await renderCombinedWav(notes, duration, value => setProgress(value), plan);
      const form = new FormData();
      form.append('name', name);
      form.append('ownerName', playerName);
      form.append('audio', audioBlob, name.replace(/[^a-z0-9._-]+/gi, '_').slice(0, 48) + '.wav');
      const response = await fetch(API_BASE + '/community/tracks', { method: 'POST', body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Publish failed');
      setStatus('Published "' + data.track.name + '" to Places.');
      await loadCommunityTracks();
      setShowProjects(true);
    } catch (error) {
      setStatus(error.message || 'Could not publish this track.');
    } finally {
      setPublishing(false);
      setProgress(0);
    }
  }, [publishing, playerName, loadCommunityTracks]);

  const onDrop = e => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) convert(f); };
  const onFileInput = e => { const f = e.target.files && e.target.files[0]; if (f) convert(f); e.target.value = ''; };
  const panel = { background: rbx.panel, border: '2px solid #000', boxShadow: '2px 2px 0 rgba(0,0,0,0.35)' };

  return (
    <div style={{ height: '100%', width: '100%', fontFamily: rbx.font, fontSize: 12, color: rbx.text, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#87ceeb url(' + SKY_URL + ') center / cover no-repeat' }} onDragOver={e => { e.preventDefault(); e.stopPropagation(); }} onDrop={onDrop}>
      <div style={{ height: 'auto', minHeight: 28, background: 'linear-gradient(180deg, #9ec4e8 0%, #6e99c9 100%)', borderBottom: '2px solid #000', display: 'flex', alignItems: 'center', padding: '4px 6px', gap: 5, flexShrink: 0, flexWrap: 'wrap', overflow: 'hidden' }}>
        <span style={{ fontWeight: 'bold', fontSize: 13, color: '#fff', textShadow: '1px 1px 0 #000' }}>BLOX<span style={{ color: rbx.yellow }}>ify</span></span>
        <label style={{ ...topBtn, display: 'inline-flex' }}>Open<input type="file" accept=".mp3,.wav,.m4a,.aac,.flac,.ogg,.oga,.aif,.aiff,.webm" onChange={onFileInput} disabled={working} style={{ display: 'none' }} /></label>
        <button type="button" style={saveBtn} disabled={working || !midiBlob} onClick={() => midiBlob && downloadBlob(midiBlob, midiDownloadName(projectName))}>Save MIDI</button>
        <button type="button" style={saveBtnGray} disabled={working || !arrangement.length} onClick={() => STEM_ORDER.forEach(roleId => { if (arrangement.some(n => n.role === roleId)) downloadStem(roleId); })}>Save Stems</button>
        <button type="button" style={saveBtnGray} disabled={working || renderingWav || !arrangement.length} onClick={renderAndDownloadWav}>{renderingWav ? 'Rendering WAV…' : 'Save WAV'}</button>
        <button type="button" style={topBtn} disabled={!arrangement.length || working} onClick={playing ? stopPlayback : playArrangement}>{playing ? 'Stop' : 'Play'}</button>
        <button type="button" style={topBtnGray} disabled={!arrangement.length} onClick={saveProject}>Save</button>
        <button type="button" aria-label="Places" title="Places" style={topBtnGray} onClick={() => setShowProjects(v => !v)}>Places</button>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#fff', textShadow: '1px 1px 0 #000' }}>{projectName}</span>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding: 8, gap: 6, overflow: 'hidden' }}>
          <div style={{ ...panel, padding: 8, flexShrink: 0 }}>
            <div style={{ background: rbx.blue, color: '#fff', fontWeight: 'bold', fontSize: 11, padding: '2px 6px', margin: '-8px -8px 6px', borderBottom: '2px solid #000' }}>Status</div>
            <div style={{ fontSize: 11, marginBottom: 4, lineHeight: 1.35 }}>{status}</div>
            <div style={{ fontSize: 10, marginBottom: 4 }}>Stems: {STEM_ORDER.map(id => (arrangement.some(n => n.role === id) ? 1 : 0)).reduce((a, b) => a + b, 0)} · MIDI: orchestra · WAV: {wavBlob ? 'ready' : 'not rendered'}</div>
            <HealthBar value={progress} max={100} label={
              <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span>Loading</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{loadingSeconds}s</span>
              </span>
            } width="100%" height={14} />
          </div>
          {showProjects && (
            <div style={{ ...panel, padding: 6, maxHeight: 180, overflow: 'auto', fontSize: 11, flexShrink: 0 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Places</div>
              <div style={{ color: '#555', marginBottom: 5 }}>Your saved places</div>
              {projects.length === 0 && <div style={{ color: '#777', marginBottom: 6 }}>No saved places.</div>}
              {projects.map(p => (
                <div key={p.id} style={{ display: 'flex', gap: 4, marginBottom: 3, alignItems: 'center' }}>
                  <button type="button" style={topBtn} onClick={() => loadProject(p)}>Load</button>
                  <button type="button" style={{ ...topBtn, background: '#e8a0a0' }} onClick={() => deleteProject(p)}>Delete</button>
                  <button type="button" style={topBtnGray} disabled={publishing || !p.arrangement || !p.arrangement.length} onClick={() => publishTrack(p)}>{publishing ? 'Publishing…' : 'Publish'}</button>
                  <span style={{ fontWeight: 'bold', minWidth: 0, overflowWrap: 'anywhere' }}>{p.name}</span>
                </div>
              ))}
              <div aria-label="Community Places" title="Community Places" style={{ borderTop: '1px solid #999', margin: '7px 0', paddingTop: 5, fontWeight: 'bold' }}>Community Places</div>
              {communityLoading && <div style={{ color: '#666' }}>Loading places…</div>}
              {!communityLoading && communityTracks.length === 0 && <div style={{ color: '#777' }}>No public places yet.</div>}
              {communityTracks.map(track => (
                <div key={track.id} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                  <audio controls preload="none" src={API_BASE + track.audioUrl} style={{ width: 180, height: 26 }} />
                  <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>{track.name}</span>{track.ownerName && <span style={{ marginLeft: 5, color: '#666' }}>by {track.ownerName}</span>}
                </div>
              ))}
            </div>
          )}
          <div style={{ ...panel, padding: '4px 8px', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <label style={{ fontSize: 11 }}>Place <input value={projectName} onChange={e => { const nextName = e.target.value; setProjectName(nextName); writeCookie(COOKIE_KEY, nextName); if (arrangement.length) { const programs = (planRef.current && planRef.current.programs) || ORCHESTRA_PROGRAMS; setMidiBlob(makeMidi(arrangement, programs, planRef.current && planRef.current.soundfontRoles, nextName)); } }} style={{ width: 140, border: '2px solid #000', fontFamily: rbx.font, fontSize: 11 }} /></label>
            {selectedNote && (
              <>
                <label style={{ fontSize: 11 }}>Role <select value={selectedNote.role} onChange={e => editSelected({ role: e.target.value })} style={{ border: '2px solid #000', fontFamily: rbx.font, fontSize: 11 }}>{roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
                <label style={{ fontSize: 11 }}>Pitch <input type="number" min={0} max={127} value={selectedNote.pitchMidi} onChange={e => editSelected({ pitchMidi: Number(e.target.value) })} style={{ width: 48, border: '2px solid #000', fontFamily: rbx.font, fontSize: 11 }} /></label>
                <label style={{ fontSize: 11 }}>Vol <input type="number" min={12} max={95} value={Math.round((selectedNote.amplitude || 0.7) * 100)} onChange={e => { const next = Number(e.target.value); if (!Number.isFinite(next)) return; editSelected({ amplitude: Math.max(0.12, Math.min(0.95, next / 100)) }); }} style={{ width: 48, border: '2px solid #000', fontFamily: rbx.font, fontSize: 11 }} /></label>
              </>
            )}
          </div>
          <div style={{ ...panel, padding: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <PianoRoll notes={arrangement} onChange={updateArrangement} selectedId={selectedNoteId} onSelect={setSelectedNoteId} playhead={playbackTime > 0 ? playbackTime : null} playheadSink={playheadSinkRef} duration={playbackDuration} />
          </div>
        </div>
        <div style={{ width: 130, flexShrink: 0, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 12, background: 'rgba(0,0,0,0.25)', borderLeft: '2px solid #000' }}>
          <div style={{ background: 'rgba(0,0,0,0.55)', border: '2px solid #000', padding: 6, color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
            Player List
            <div style={{ marginTop: 5, display: 'flex', gap: 3 }}>
              <input value={playerInput} onChange={e => setPlayerInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') registerPlayer(); }} placeholder="Your name" maxLength={20} style={{ minWidth: 0, width: 74, fontSize: 10, fontFamily: rbx.font }} />
              <button type="button" onClick={registerPlayer} disabled={playerBusy} style={{ fontSize: 9, padding: '1px 3px' }}>{playerBusy ? '…' : 'Set'}</button>
            </div>
            <div style={{ marginTop: 5, fontWeight: 'normal' }}>{playerName || 'No name selected'}</div>
            {playerName && <div style={{ marginTop: 3, fontSize: 9, fontWeight: 'normal' }}>{playerProjects.length} saved song{playerProjects.length === 1 ? '' : 's'}</div>}
          </div>
          <HealthBar value={volume} max={1} label="Volume" width="100%" height={18} onChange={v => { setVolume(v); if (synthRef.current && typeof synthRef.current.setMainVolume === 'function') { try { synthRef.current.setMainVolume(v); } catch (e) {} } }} />
          <HealthBar value={playbackTime} max={Math.max(playbackDuration, 0.01)} label={'Time ' + playbackTime.toFixed(1) + ' / ' + (playbackDuration || 0).toFixed(1) + 's'} width="100%" height={18} onChange={seekTo} />
        </div>
      </div>
    </div>
  );
}

export default MusicAI;