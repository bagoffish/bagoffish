import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Midi } from '@tonejs/midi';
import { WorkletSynthesizer } from 'spessasynth_lib';

const SPESSA_PROCESSOR_URL = '/spessasynth_processor.min.js';
const API_BASE = window.RENDERER_API_BASE || 'https://winxp-7yes.onrender.com';
const MAX_SECONDS = 600;
const MAX_BYTES = 50 * 1024 * 1024;
const MODEL_URL = '/basic-pitch-model/model.json';
const SKY_URL = '/images/sky.png';

const SOUNDFONT_LIBRARY = [
  { id: 'fjords', name: 'Wind of Fjords', url: '/soundfonts/Instruments/WorkingR-Blox/Wind_Of_Fjords_V2.5.1a/WindOfFjordsV2.5.1a.sf2' },
  { id: 'fjords-midi', name: 'Wind of Fjords MIDI', url: '/soundfonts/Instruments/MIDI%20Compatible%20Soundfonts/Wind_of_Fjords_MIDI.sf2' },
  { id: 'strategy', name: 'The Great Strategy', url: '/soundfonts/Instruments/MIDI%20Compatible%20Soundfonts/The_Great_Strategy_MIDI.sf2' },
  { id: 'roblox-sf', name: 'Roblox Soundfont', url: '/soundfonts/Instruments/WorkingR-Blox/Roblox%20Soundfont-1.sf2' },
  { id: 'gamehero', name: 'GameHero', url: '/soundfonts/Instruments/Soundfonts/GameHero%20Soundfont.sf2' },
  { id: 'classic-days', name: 'Classic Days', url: '/soundfonts/Instruments/Soundfonts/Classic%20Days.sf2' },
  { id: 'party', name: 'Party Music', url: '/soundfonts/Instruments/Soundfonts/Party%20Music.sf2' },
  { id: 'monster', name: 'Monster Mash', url: '/soundfonts/Instruments/Soundfonts/Monster%20Mash.sf2' },
  { id: 'horror', name: 'Roblox Horror', url: '/soundfonts/Instruments/Soundfonts/Roblox%20Horror.sf2' },
  { id: 'stealth', name: 'StealthPilot', url: '/soundfonts/Instruments/Soundfonts/StealthPilot.sf2' },
  { id: 'drums', name: 'StealthPilot Drums', url: '/soundfonts/Instruments/MIDI%20Compatible%20Soundfonts/StealthPilot_MIDI_DRUMS_ONLY.sf2' },
  { id: 'nokia', name: 'Nokia Tongbao', url: '/soundfonts/Instruments/WorkingR-Blox/Nokia_Tongbao_Bank.sf2' },
];

const STYLE_PLANS = {
  mule: { label: 'M.U.L.E. / Wind of Fjords', primaryIds: ['fjords', 'fjords-midi', 'roblox-sf'], drumId: 'drums', programs: { drums: 0, bass: 33, guitar: 0, vocals: 80 } },
  'fjords-midi': { label: 'Wind of Fjords (MIDI)', primaryIds: ['fjords-midi', 'fjords'], drumId: 'drums', programs: { drums: 0, bass: 33, guitar: 0, vocals: 80 } },
  strategy: { label: 'Great Strategy', primaryIds: ['strategy', 'gamehero'], drumId: 'drums', programs: { drums: 0, bass: 33, guitar: 48, vocals: 56 } },
  'roblox-sf': { label: 'Roblox Soundfont', primaryIds: ['roblox-sf'], drumId: 'drums', programs: { drums: 0, bass: 33, guitar: 25, vocals: 80 } },
  gamehero: { label: 'GameHero', primaryIds: ['gamehero', 'roblox-sf'], drumId: 'drums', programs: { drums: 0, bass: 33, guitar: 30, vocals: 80 } },
  'classic-days': { label: 'Classic Days', primaryIds: ['classic-days', 'roblox-sf'], drumId: 'drums', programs: { drums: 0, bass: 33, guitar: 0, vocals: 48 } },
  party: { label: 'Party Music', primaryIds: ['party', 'roblox-sf'], drumId: 'drums', programs: { drums: 0, bass: 38, guitar: 81, vocals: 80 } },
  monster: { label: 'Monster Mash', primaryIds: ['monster', 'roblox-sf'], drumId: 'drums', programs: { drums: 0, bass: 34, guitar: 19, vocals: 80 } },
  horror: { label: 'Roblox Horror', primaryIds: ['horror', 'classic-days'], drumId: 'drums', programs: { drums: 0, bass: 34, guitar: 19, vocals: 89 } },
  stealth: { label: 'StealthPilot', primaryIds: ['stealth', 'roblox-sf'], drumId: 'drums', programs: { drums: 0, bass: 33, guitar: 30, vocals: 80 } },
  chip: { label: 'Chip / Nokia', primaryIds: ['nokia', 'fjords', 'roblox-sf'], drumId: 'drums', programs: { drums: 0, bass: 38, guitar: 80, vocals: 81 } },
  classic: { label: 'Classic Roblox', primaryIds: ['roblox-sf', 'gamehero', 'fjords'], drumId: 'drums', programs: { drums: 0, bass: 33, guitar: 25, vocals: 80 } },
};

function pickClassicRobloxPlan(notes, duration) {
  const n = notes.length || 1;
  const dur = Math.max(duration || 1, 0.5);
  const density = n / dur;
  let sumPitch = 0, shortCount = 0, lowCount = 0, highCount = 0;
  notes.forEach(note => {
    const p = note.pitchMidi || 60;
    sumPitch += p;
    if ((note.durationSeconds || 0) < 0.15) shortCount++;
    if (p < 50) lowCount++;
    if (p >= 72) highCount++;
  });
  const avgPitch = sumPitch / n;
  const shortRatio = shortCount / n;
  const lowRatio = lowCount / n;
  const highRatio = highCount / n;
  let style = 'mule';
  let reason = 'Classic M.U.L.E. / Fjords (closest to original melody)';
  if (density > 12 && shortRatio > 0.5) { style = 'party'; reason = 'Busy rhythm → party palette'; }
  else if (density > 7 && highRatio > 0.4) { style = 'chip'; reason = 'Bright busy lead → chip palette'; }
  else if (lowRatio > 0.45 && density < 5) { style = 'strategy'; reason = 'Bass-heavy → Great Strategy'; }
  else if (avgPitch >= 58 && density >= 2) { style = 'mule'; reason = 'Balanced song → Wind of Fjords (M.U.L.E.)'; }
  else { style = 'classic'; reason = 'General → classic Roblox bank'; }
  const plan = STYLE_PLANS[style] || STYLE_PLANS.mule;
  const primary = SOUNDFONT_LIBRARY.find(s => plan.primaryIds.includes(s.id)) || SOUNDFONT_LIBRARY[0];
  const drums = SOUNDFONT_LIBRARY.find(s => s.id === plan.drumId);
  return { style, label: plan.label, reason, primary, drums, programs: { ...plan.programs } };
}

const roles = [
  { id: 'drums', label: 'DRUMS', channel: 9, color: '#e07070', program: 0 },
  { id: 'bass', label: 'BASS', channel: 0, color: '#70a0e0', program: 33 },
  { id: 'guitar', label: 'RHYTHM GUITAR', channel: 1, color: '#70e070', program: 29 },
  { id: 'vocals', label: 'LEAD', channel: 2, color: '#e0e070', program: 80 },
  { id: 'keys', label: 'KEYS', channel: 3, color: '#c080e0', program: 4 },
  { id: 'pad', label: 'PAD', channel: 4, color: '#70d0d0', program: 89 },
  { id: 'strings', label: 'STRINGS', channel: 5, color: '#e0a070', program: 48 },
  { id: 'arp', label: 'ARP', channel: 6, color: '#d0d070', program: 81 },
];

const STEM_ORDER = roles.map(role => role.id);

function clampMidi(value) {
  return Math.max(24, Math.min(108, Math.round(value)));
}

function pushNote(target, role, pitchMidi, startTimeSeconds, durationSeconds, amplitude = 0.65) {
  if (!Number.isFinite(startTimeSeconds) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return;
  target.push({
    id: 0,
    role,
    pitchMidi: clampMidi(pitchMidi),
    startTimeSeconds: Math.max(0, startTimeSeconds),
    durationSeconds: Math.max(0.05, durationSeconds),
    amplitude: Math.max(0.12, Math.min(0.95, amplitude)),
  });
}

function buildFullArrangement(rawNotes, duration, stylePlan) {
  const source = cleanDetectedNotes(rawNotes || []);
  if (!source.length) return [];

  // The AI decides the *musical direction*; Basic Pitch remains the source of
  // truth for the actual performance so the arrangement does not hallucinate
  // an unrelated song.
  const ai = stylePlan || {};
  const end = Math.max(duration || 0, ...source.map(n => n.startTimeSeconds + n.durationSeconds));
  const out = [];
  const ordered = source.slice().sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi);
  const primaryRole = roles.some(r => r.id === ai.primaryRole) ? ai.primaryRole : 'guitar';
  const support = Array.isArray(ai.supportRoles) ? ai.supportRoles : ['bass', 'keys'];

  const clusters = [];
  ordered.forEach(note => {
    let cluster = clusters[clusters.length - 1];
    if (!cluster || note.startTimeSeconds - cluster.time > 0.09) {
      cluster = { time: note.startTimeSeconds, notes: [] };
      clusters.push(cluster);
    }
    cluster.notes.push(note);
  });

  const medianPitch = ordered.map(n => n.pitchMidi).sort((a, b) => a - b)[Math.floor(ordered.length / 2)] || 60;
  ordered.forEach(note => {
    const cluster = clusters.find(c => c.notes.includes(note));
    const chordLike = cluster && cluster.notes.length >= 3;
    let role = primaryRole;

    // Keep the important source voices separated even when the AI chose a
    // single primary instrument.
    if (support.includes('bass') && note.pitchMidi <= Math.min(52, medianPitch - 10) && note.durationSeconds >= 0.18) {
      role = 'bass';
    } else if (support.includes('keys') && chordLike) {
      role = 'keys';
    } else if (support.includes('vocals') && !chordLike && note.pitchMidi >= medianPitch + 7) {
      role = 'vocals';
    } else if (support.includes('guitar') && !chordLike && note.pitchMidi < medianPitch + 7 && primaryRole !== 'guitar') {
      role = 'guitar';
    }

    pushNote(out, role, note.pitchMidi, note.startTimeSeconds, note.durationSeconds, Math.min(0.95, note.amplitude || 0.72));
  });

  // Infer harmony only where the recording actually contains enough pitch
  // information. AI can request support harmony, but it cannot invent a whole
  // song's chord bed from nothing.
  const harmonyStep = 0.25;
  const windows = new Map();
  ordered.forEach(note => {
    const slot = Math.floor(note.startTimeSeconds / harmonyStep) * harmonyStep;
    const list = windows.get(slot) || [];
    list.push(note);
    windows.set(slot, list);
  });

  const chordEvents = [];
  [...windows.entries()].sort((a, b) => a[0] - b[0]).forEach(([time, values]) => {
    const pcs = [...new Set(values.map(n => ((n.pitchMidi % 12) + 12) % 12))];
    if (pcs.length < 3) return;
    let best = null;
    pcs.forEach(rootPc => {
      const intervals = pcs.map(pc => (pc - rootPc + 12) % 12);
      const score = intervals.includes(0) + intervals.includes(3) + intervals.includes(4) + intervals.includes(7) + intervals.includes(10) + intervals.includes(11);
      if (!best || score > best.score) best = { rootPc, score };
    });
    if (!best || best.score < 3) return;
    chordEvents.push({ time, rootPc: best.rootPc });
  });

  const stableChords = [];
  chordEvents.forEach(event => {
    const previous = stableChords[stableChords.length - 1];
    if (!previous || previous.rootPc !== event.rootPc || event.time - previous.time >= 1.0) {
      stableChords.push(event);
    }
  });

  const chordAt = time => {
    let current = null;
    for (const event of stableChords) {
      if (event.time > time) break;
      current = event;
    }
    return current;
  };

  const density = Math.max(0.25, Math.min(1, Number(ai.density) || 0.6));
  const supportBass = support.includes('bass');
  const supportKeys = support.includes('keys');
  for (let t = 0; t < end; t += 0.5) {
    const chord = chordAt(t);
    if (!chord) continue;
    const root = clampMidi(36 + chord.rootPc);
    const hasBass = ordered.some(n => n.pitchMidi <= 52 && Math.abs(n.startTimeSeconds - t) < 0.3);
    if (supportBass && !hasBass && density > 0.45) {
      pushNote(out, 'bass', root, t, 0.32, 0.34 + density * 0.18);
    }
    if (supportKeys && density > 0.42 && Math.round(t / 0.5) % 2 === 0) {
      [0, 4, 7].forEach(interval => {
        pushNote(out, 'keys', clampMidi(60 + chord.rootPc + interval), t, 0.38, 0.12 + density * 0.14);
      });
    }
  }

  // Drums are only generated when the AI sees a rhythmic style AND the source
  // itself contains a stable onset pulse.
  const onsets = ordered.map(n => n.startTimeSeconds);
  const gaps = [];
  for (let i = 1; i < onsets.length; i++) {
    const gap = onsets[i] - onsets[i - 1];
    if (gap >= 0.18 && gap <= 1.2) gaps.push(gap);
  }
  const sortedGaps = gaps.slice().sort((a,b) => a-b);
  const medianGap = sortedGaps.length ? sortedGaps[Math.floor(sortedGaps.length / 2)] : 0;
  if (ai.drums && medianGap >= 0.2 && medianGap <= 0.8 && ordered.length >= 8) {
    const beat = Math.max(0.25, Math.min(0.75, medianGap));
    for (let t = 0, i = 0; t < end; t += beat, i++) {
      pushNote(out, 'drums', 36, t, 0.08, i % 4 === 0 ? 0.42 : 0.25);
      if (i % 4 === 2) pushNote(out, 'drums', 38, t, 0.08, 0.32);
      if (i % 2 === 1 && density > 0.7) pushNote(out, 'drums', 42, t, 0.05, 0.18);
    }
  }

  return out
    .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi)
    .map((note, index) => ({ ...note, id: index + 1 }));
}
function makeStemMidi(notes, roleId, programs) {
  const role = roles.find(r => r.id === roleId);
  const midi = new Midi();
  midi.name = 'Robloxify ' + (role ? role.label : roleId);
  midi.header.setTempo(120);
  const track = midi.addTrack();
  track.name = role ? role.label : roleId.toUpperCase();
  track.channel = role ? role.channel : 0;
  track.instrument.number = programs && programs[roleId] != null ? programs[roleId] : (role ? role.program : 0);
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

function PianoRoll({ notes, onChange, selectedId, onSelect, playhead, duration }) {
  const scrollRef = React.useRef(null);
  const [pxPerSec, setPxPerSec] = React.useState(80);
  const [fitWidth, setFitWidth] = React.useState(false);
  const rowH = 12, minPitch = 24, maxPitch = 96, pitchCount = maxPitch - minPitch + 1;
  const resizeRef = React.useRef(null);
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
  const totalDur = Math.max(duration || 4, 4, ...notes.map(n => n.startTimeSeconds + n.durationSeconds));
  const width = Math.max(400, totalDur * pxPerSec + 40);
  const height = pitchCount * rowH;
  const pitchToY = p => (maxPitch - p) * rowH;
  const yToPitch = y => Math.max(minPitch, Math.min(maxPitch, maxPitch - Math.floor(y / rowH)));
  const xToTime = x => Math.max(0, x / pxPerSec);
  const timeToX = t => t * pxPerSec;
  const dragRef = React.useRef(null);
  const roleColor = id => (roles.find(r => r.id === id) || roles[2]).color;
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
    // rect is the actual scrollable grid element, so getBoundingClientRect already
    // accounts for the current scroll position. Adding scrollLeft/scrollTop again
    // makes notes jump farther right/down after scrolling.
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
          {notes.map(note => {
            const left = timeToX(note.startTimeSeconds), w = Math.max(4, timeToX(note.durationSeconds)), top = pitchToY(note.pitchMidi), sel = note.id === selectedId;
            return (
              <div key={note.id} onPointerDown={e => onNotePointerDown(e, note, 'move')} onPointerMove={onNotePointerMove} onPointerUp={onNotePointerUp} onPointerCancel={onNotePointerUp}
                style={{ position: 'absolute', left, top, width: w, height: rowH - 2, marginTop: 1, background: roleColor(note.role), border: sel ? '2px solid #fff' : '1px solid #000', boxSizing: 'border-box', borderRadius: 2, cursor: 'grab', zIndex: sel ? 3 : 2, opacity: 0.92 }} title={note.role + ' · ' + note.pitchMidi}>
                <div onPointerDown={e => onNotePointerDown(e, note, 'resize')} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize', background: 'rgba(0,0,0,0.25)' }} />
              </div>
            );
          })}
          {playhead != null && <div style={{ position: 'absolute', left: timeToX(playhead), top: 0, bottom: 0, width: 2, background: '#f5cd2f', pointerEvents: 'none', zIndex: 5 }} />}
        </div>
      </div>
    </div>
  );
}

function cleanDetectedNotes(notes) {
  const sorted = notes.filter(note => Number.isFinite(note.startTimeSeconds) && Number.isFinite(note.durationSeconds) && Number.isFinite(note.pitchMidi) && note.durationSeconds >= 0.04 && note.pitchMidi >= 0 && note.pitchMidi <= 127)
    .sort((x, y) => x.startTimeSeconds - y.startTimeSeconds || x.pitchMidi - y.pitchMidi);
  const result = []; const lastByPitch = new Map();
  sorted.forEach(note => {
    const previous = lastByPitch.get(note.pitchMidi);
    if (previous && note.startTimeSeconds <= previous.startTimeSeconds + previous.durationSeconds + 0.02) {
      const end = Math.max(previous.startTimeSeconds + previous.durationSeconds, note.startTimeSeconds + note.durationSeconds);
      previous.durationSeconds = end - previous.startTimeSeconds;
      previous.amplitude = Math.max(previous.amplitude || 0, note.amplitude || 0);
      return;
    }
    const clean = { ...note, startTimeSeconds: Math.max(0, note.startTimeSeconds), durationSeconds: Math.max(0.05, note.durationSeconds), amplitude: note.amplitude == null ? 0.8 : Math.max(0.2, Math.min(1, note.amplitude)) };
    result.push(clean); lastByPitch.set(clean.pitchMidi, clean);
  });
  return result;
}

function assignRoles(detected) {
  const cleaned = cleanDetectedNotes(detected);
  const pitches = cleaned.map(n => n.pitchMidi).sort((a, b) => a - b);
  const median = pitches[Math.floor(pitches.length / 2)] || 60;
  const bassCutoff = Math.min(52, median - 12);
  return cleaned.map((note, index) => {
    const pitch = note.pitchMidi; const short = note.durationSeconds < 0.12;
    let role = 'guitar';
    if (pitch < bassCutoff && !short) role = 'bass';
    else if (short && pitch >= 36 && pitch <= 55 && note.amplitude > 0.55) role = Math.random() < 0.25 ? 'drums' : 'guitar';
    else if (pitch >= 76 && note.durationSeconds > 0.35) role = 'vocals';
    let outPitch = pitch;
    if (role === 'drums') outPitch = pitch < 45 ? 36 : pitch < 55 ? 38 : pitch < 65 ? 42 : 46;
    return { ...note, id: index + 1, role, pitchMidi: outPitch };
  });
}

function smartQuantize(notes, preferredGrid) {
  if (!notes.length) return notes;
  const starts = notes.map(n => n.startTimeSeconds).sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < starts.length; i++) {
    const d = starts[i] - starts[i - 1];
    if (d >= 0.08 && d <= 1.5) gaps.push(d);
  }
  if (!gaps.length) return notes;
  const median = gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
  const requested = Number(preferredGrid);
  const grid = [0.0625, 0.125, 0.25, 0.5].includes(requested)
    ? requested
    : Math.max(0.03125, Math.min(0.25, median / Math.max(1, Math.round(median / 0.125))));
  const tolerance = Math.min(0.035, grid * 0.22);
  return notes.map(note => {
    const snapped = Math.round(note.startTimeSeconds / grid) * grid;
    const start = Math.abs(snapped - note.startTimeSeconds) <= tolerance ? snapped : note.startTimeSeconds;
    return { ...note, startTimeSeconds: Math.max(0, start), durationSeconds: Math.max(0.04, note.durationSeconds) };
  });
}


function makeMidi(notes, programs) {
  const midi = new Midi(); midi.name = 'Robloxify'; midi.header.setTempo(120);
  roles.forEach(role => {
    const track = midi.addTrack();
    track.name = role.label;
    track.channel = role.channel;
    track.instrument.number = programs && programs[role.id] != null ? programs[role.id] : role.program;
    notes.filter(note => note.role === role.id).forEach(note => {
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

async function renderCombinedWav(notes, duration, onProgress) {
  const renderDuration = Math.max(0.25, Math.min(MAX_SECONDS, duration || 0));
  const sampleRate = 22050;
  const context = new OfflineAudioContext(2, Math.ceil(renderDuration * sampleRate), sampleRate);
  const master = context.createGain();
  master.gain.value = 0.72;
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 16;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.18;
  master.connect(compressor).connect(context.destination);

  const roleConfig = {
    vocals: { wave: 'sawtooth', gain: 0.075, attack: 0.018, release: 0.10, detune: 0, pan: 0.02 },
    guitar: { wave: 'triangle', gain: 0.06, attack: 0.008, release: 0.08, detune: -5, pan: -0.22 },
    bass: { wave: 'square', gain: 0.11, attack: 0.012, release: 0.08, detune: -2, pan: 0 },
    keys: { wave: 'sine', gain: 0.045, attack: 0.012, release: 0.16, detune: 0, pan: 0.18 },
    pad: { wave: 'triangle', gain: 0.025, attack: 0.12, release: 0.32, detune: 7, pan: -0.10 },
    strings: { wave: 'sawtooth', gain: 0.025, attack: 0.08, release: 0.22, detune: -7, pan: 0.12 },
    arp: { wave: 'square', gain: 0.035, attack: 0.004, release: 0.06, detune: 4, pan: 0.30 },
  };

  const panNode = (role, destination) => {
    const cfg = roleConfig[role] || roleConfig.keys;
    const p = context.createStereoPanner();
    p.pan.value = cfg.pan || 0;
    p.connect(destination);
    return p;
  };

  const scheduleTone = (note, role) => {
    const cfg = roleConfig[role];
    if (!cfg) return;
    const start = Math.max(0, Math.min(renderDuration - 0.001, note.startTimeSeconds));
    const dur = Math.max(0.025, Math.min(note.durationSeconds, renderDuration - start));
    if (dur <= 0) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = cfg.wave;
    osc.frequency.value = 440 * Math.pow(2, (note.pitchMidi - 69) / 12);
    osc.detune.value = cfg.detune || 0;
    const amp = cfg.gain * Math.max(0.25, Math.min(1, note.amplitude || 0.7));
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(amp, start + Math.min(cfg.attack, dur * 0.45));
    const releaseStart = Math.max(start + Math.min(dur * 0.72, dur - 0.01), start + 0.01);
    gain.gain.setValueAtTime(amp, releaseStart);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(panNode(role, master));
    osc.start(start);
    osc.stop(start + dur + 0.02);
  };

  const noiseBuffer = context.createBuffer(1, sampleRate, sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;

  const scheduleDrum = note => {
    const start = Math.max(0, Math.min(renderDuration - 0.001, note.startTimeSeconds));
    const dur = Math.max(0.025, Math.min(note.durationSeconds, renderDuration - start));
    const gain = context.createGain();
    const panner = context.createStereoPanner();
    panner.pan.value = note.pitchMidi === 36 ? 0 : note.pitchMidi === 38 ? -0.05 : 0.25;
    gain.connect(panner).connect(master);
    const amp = 0.08 * Math.max(0.3, note.amplitude || 0.6);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(amp, start + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    if (note.pitchMidi === 42) {
      const src = context.createBufferSource();
      src.buffer = noiseBuffer;
      src.connect(gain);
      src.start(start);
      src.stop(start + dur);
    } else {
      const osc = context.createOscillator();
      osc.type = note.pitchMidi === 36 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(note.pitchMidi === 36 ? 110 : 180, start);
      if (note.pitchMidi === 36) osc.frequency.exponentialRampToValueAtTime(48, start + dur);
      else osc.frequency.exponentialRampToValueAtTime(90, start + dur);
      osc.connect(gain);
      osc.start(start);
      osc.stop(start + dur + 0.01);
    }
  };

  notes.forEach(note => note.role === 'drums' ? scheduleDrum(note) : scheduleTone(note, note.role));
  onProgress && onProgress(55);
  const rendered = await context.startRendering();
  onProgress && onProgress(100);
  return encodeWav(rendered);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function yieldToBrowser() {
  return new Promise(resolve => { if (typeof window !== 'undefined' && window.requestAnimationFrame) window.requestAnimationFrame(() => setTimeout(resolve, 0)); else setTimeout(resolve, 0); });
}

async function transcribeOnBackend(file, onStatus) {
  onStatus('Uploading to server...');
  const form = new FormData(); form.append('audio', file, file.name || 'audio.wav');
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15 * 60 * 1000);
  try {
    onStatus('Server is working...');
    const res = await fetch(API_BASE + '/robloxify', { method: 'POST', body: form, signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Server error ' + res.status);
    if (!Array.isArray(data.notes)) throw new Error('Server returned no notes');
    return { notes: data.notes, duration: data.duration || 0, aiPlan: data.aiPlan || null };
  } finally { clearTimeout(timeout); }
}

async function transcribeLocally(file, onStatus, onProgress) {
  onStatus('Preparing audio...'); await yieldToBrowser();
  const bytes = await file.arrayBuffer(); await yieldToBrowser();
  const decodeContext = new AudioContext(); let sourceBuffer;
  try { sourceBuffer = await decodeContext.decodeAudioData(bytes.slice(0)); } finally { await decodeContext.close().catch(() => {}); }
  const duration = sourceBuffer.duration;
  if (duration > MAX_SECONDS) throw new Error('Audio must be under 10 minutes.');
  onStatus('Resampling...'); await yieldToBrowser();
  const targetRate = 22050; const targetLength = Math.ceil(duration * targetRate);
  const offlineContext = new OfflineAudioContext(1, targetLength, targetRate);
  const source = offlineContext.createBufferSource(); source.buffer = sourceBuffer; source.connect(offlineContext.destination); source.start(0);
  const audioBuffer = await offlineContext.startRendering(); await yieldToBrowser();
  onStatus('Loading model...'); await yieldToBrowser();
  const tf = await import('@tensorflow/tfjs'); await yieldToBrowser();
  const { BasicPitch, addPitchBendsToNoteEvents, noteFramesToTime, outputToNotesPoly } = await import('@spotify/basic-pitch'); await yieldToBrowser();
  await tf.setBackend('webgl').catch(() => tf.setBackend('cpu')); await tf.ready(); await yieldToBrowser();
  const model = await tf.loadGraphModel(MODEL_URL); const basicPitch = new BasicPitch(model); await yieldToBrowser();
  onStatus('Transcribing...');
  const frames = []; const onsets = []; const contours = [];
  let lastProgress = -1; let lastYield = performance.now();
  await basicPitch.evaluateModel(audioBuffer, (frameBatch, onsetBatch, contourBatch) => { frames.push(...frameBatch); onsets.push(...onsetBatch); contours.push(...contourBatch); }, async value => {
    const progress = Math.max(0, Math.min(1, value));
    if (progress - lastProgress >= 0.02 || progress >= 1) { lastProgress = progress; onProgress(progress); onStatus('Transcribing ' + Math.round(progress * 100) + '%'); }
    if (performance.now() - lastYield > 80) { lastYield = performance.now(); await yieldToBrowser(); }
  });
  await yieldToBrowser(); onStatus('Extracting notes...');
  const primary = noteFramesToTime(addPitchBendsToNoteEvents(contours, outputToNotesPoly(frames, onsets, 0.32, 0.38, 8)));
  const sensitive = noteFramesToTime(addPitchBendsToNoteEvents(contours, outputToNotesPoly(frames, onsets, 0.22, 0.30, 6)));
  const notes = [...(primary || [])];
  (sensitive || []).forEach(note => {
    const duplicate = notes.some(existing =>
      existing.pitchMidi === note.pitchMidi &&
      Math.abs(existing.startTimeSeconds - note.startTimeSeconds) < 0.045 &&
      Math.abs(existing.durationSeconds - note.durationSeconds) < 0.12
    );
    if (!duplicate) notes.push(note);
  });
  notes.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi);
  try { model.dispose(); } catch (e) {}
  return { notes, duration };
}

function MusicAI() {
  const STORAGE_KEY = 'robloxify-projects-v2'; const COOKIE_KEY = 'robloxify-last-project';
  function readCookie(name) { const prefix = name + '='; const item = document.cookie.split('; ').find(v => v.indexOf(prefix) === 0); return item ? decodeURIComponent(item.slice(prefix.length)) : ''; }
  function writeCookie(name, value) { document.cookie = name + '=' + encodeURIComponent(value) + '; max-age=31536000; path=/; SameSite=Lax'; }
  function loadProjects() { try { const value = window.localStorage.getItem(STORAGE_KEY); return value ? JSON.parse(value) : []; } catch (e) { return []; } }
  function persistProjects(value) { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch (e) {} }

  const synthRef = useRef(null); const contextRef = useRef(null); const planRef = useRef(null);
  const [file, setFile] = useState(null); const [midiBlob, setMidiBlob] = useState(null); const [arrangement, setArrangement] = useState([]);
  const [wavBlob, setWavBlob] = useState(null); const [renderingWav, setRenderingWav] = useState(false);
  const [status, setStatus] = useState('Drop audio → Roblox-style version of your song');
  const [progress, setProgress] = useState(0); const [working, setWorking] = useState(false); const [playing, setPlaying] = useState(false);
  const [projectName, setProjectName] = useState(() => readCookie(COOKIE_KEY) || 'Untitled Place');
  const [projects, setProjects] = useState(() => loadProjects()); const [showProjects, setShowProjects] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState(null); const [volume, setVolume] = useState(0.85);
  const [playbackTime, setPlaybackTime] = useState(0); const [playbackDuration, setPlaybackDuration] = useState(0);
  const [activePlan, setActivePlan] = useState(null); const [manualStyle, setManualStyle] = useState('auto');
  const [viewMode, setViewMode] = useState('roll');
  const playbackStopTimerRef = useRef(null); const playbackRafRef = useRef(null); const conversionIdRef = useRef(0);
  const scheduledTimersRef = useRef([]); const playStartRef = useRef(0); const seekOffsetRef = useRef(0);

  const stopPlaybackInternal = () => {
    if (playbackStopTimerRef.current) { window.clearTimeout(playbackStopTimerRef.current); playbackStopTimerRef.current = null; }
    if (playbackRafRef.current) { window.cancelAnimationFrame(playbackRafRef.current); playbackRafRef.current = null; }
    scheduledTimersRef.current.forEach(id => clearTimeout(id)); scheduledTimersRef.current = [];
    if (synthRef.current) { try { for (let ch = 0; ch < 16; ch++) { if (typeof synthRef.current.stopAll === 'function') synthRef.current.stopAll(ch); } } catch (e) {} }
  };

  useEffect(() => () => {
    stopPlaybackInternal();
    if (synthRef.current) { try { synthRef.current.destroy(); } catch (e) {} synthRef.current = null; }
    if (contextRef.current) { contextRef.current.close().catch(() => {}); contextRef.current = null; }
  }, []);

  const convert = async inputFile => {
    if (!inputFile || !(inputFile.type || '').startsWith('audio/')) { setStatus('Choose an audio file'); return; }
    if (inputFile.size > MAX_BYTES) { setStatus('File too large (max 50 MB)'); return; }
    const conversionId = ++conversionIdRef.current;
    if (working) { setStatus('Already converting…'); return; }
    setFile(inputFile); setWorking(true); setProgress(0); setPlaybackTime(0); setPlaybackDuration(0); setStatus('Starting…');
    try {
      let rawNotes = []; let duration = 0; let usedBackend = false; let aiPlan = null;
      try {
        const result = await transcribeOnBackend(inputFile, msg => { if (conversionId === conversionIdRef.current) setStatus(msg); });
        if (conversionId !== conversionIdRef.current) return;
        rawNotes = result.notes; duration = result.duration || 0; aiPlan = result.aiPlan || null; usedBackend = true; setProgress(92);
      } catch (backendError) {
        console.warn('Backend unavailable, local:', backendError);
        if (conversionId !== conversionIdRef.current) return;
        setStatus('Server offline — running in browser…'); setProgress(5);
        const result = await transcribeLocally(inputFile, msg => { if (conversionId === conversionIdRef.current) setStatus(msg); }, value => { if (conversionId === conversionIdRef.current) setProgress(Math.round(10 + value * 80)); });
        if (conversionId !== conversionIdRef.current) return;
        rawNotes = result.notes; duration = result.duration || 0;
      }
      setStatus(aiPlan && aiPlan.ai ? 'Studying Roblox soundfont styles — building an original arrangement…' : 'Mapping to Roblox instruments (keeping your melody)…'); await yieldToBrowser();
      let fitted = buildFullArrangement(rawNotes, duration, aiPlan);
      if (!fitted.length) throw new Error('No notes detected — try a clearer song.');
      fitted = smartQuantize(fitted, aiPlan && aiPlan.quantizeGrid);
      fitted = fitted.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi).map((n, i) => ({ ...n, id: i + 1 }));
      let plan = pickClassicRobloxPlan(fitted, duration || 1);
      if (aiPlan) {
        plan = { ...plan, ...aiPlan, label: (STYLE_PLANS[aiPlan.style] || plan).label || plan.label,
          primary: SOUNDFONT_LIBRARY.find(s => s.id === aiPlan.style) || plan.primary,
          drums: SOUNDFONT_LIBRARY.find(s => s.id === 'drums') || plan.drums,
          programs: { ...plan.programs } };
        if (STYLE_PLANS[aiPlan.style]) plan.programs = { ...STYLE_PLANS[aiPlan.style].programs };
      }
      if (manualStyle !== 'auto' && STYLE_PLANS[manualStyle]) {
        const forced = STYLE_PLANS[manualStyle];
        plan = { ...plan, style: manualStyle, label: forced.label, reason: 'Manual: ' + forced.label, programs: { ...forced.programs }, primary: SOUNDFONT_LIBRARY.find(s => forced.primaryIds.includes(s.id)) || plan.primary };
      }
      planRef.current = plan; setActivePlan(plan);
      setArrangement(fitted); setSelectedNoteId(fitted[0] ? fitted[0].id : null);
      setMidiBlob(makeMidi(fitted, plan.programs));
      setPlaybackDuration(fitted.reduce((m, n) => Math.max(m, n.startTimeSeconds + n.durationSeconds), 0));
      setProgress(100);
      setStatus('Done — ' + fitted.length + ' notes · ' + plan.label + (aiPlan && aiPlan.ai ? ' · web research' : '') + (usedBackend ? ' (server)' : ' (local)') + ' — edit in the piano roll');
    } catch (error) {
      console.error(error);
      setStatus('Failed — ' + (error && error.message ? error.message : 'unknown'));
    } finally { if (conversionId === conversionIdRef.current) setWorking(false); }
  };

  const updateArrangement = next => {
    const cleaned = next.slice().sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi);
    setArrangement(cleaned);
    const programs = (planRef.current && planRef.current.programs) || STYLE_PLANS.mule.programs;
    setMidiBlob(makeMidi(cleaned, programs));
    setWavBlob(null);
    setPlaybackDuration(cleaned.reduce((m, n) => Math.max(m, n.startTimeSeconds + n.durationSeconds), 0));
  };

  const downloadStem = roleId => {
    if (!arrangement.length) return;
    const programs = (planRef.current && planRef.current.programs) || STYLE_PLANS.mule.programs;
    const role = roles.find(r => r.id === roleId);
    const blob = makeStemMidi(arrangement, roleId, programs);
    downloadBlob(blob, 'robloxify-' + roleId + '.mid');
  };

  const renderAndDownloadWav = async () => {
    if (!arrangement.length || renderingWav) return;
    setRenderingWav(true);
    setStatus('Rendering combined WAV…');
    try {
      const duration = arrangement.reduce((m, n) => Math.max(m, n.startTimeSeconds + n.durationSeconds), 0);
      const blob = await renderCombinedWav(arrangement, duration, p => setProgress(Math.max(100, p)));
      setWavBlob(blob);
      downloadBlob(blob, 'robloxify-combined.wav');
      setStatus('Combined WAV ready · ' + Math.round(duration * 10) / 10 + 's');
    } catch (error) {
      console.error(error);
      setStatus('WAV render failed — ' + (error.message || 'unknown'));
    } finally {
      setRenderingWav(false);
    }
  };

  const selectedNote = arrangement.find(n => n.id === selectedNoteId) || arrangement[0] || null;
  const editSelected = changes => { if (!selectedNote) return; updateArrangement(arrangement.map(n => (n.id === selectedNote.id ? { ...n, ...changes } : n))); };

  const saveProject = () => {
    if (!arrangement.length) { setStatus('Convert audio first'); return; }
    const project = { id: Date.now(), name: projectName.trim() || 'Untitled Place', sourceName: file ? file.name : 'Unknown', arrangement, plan: activePlan ? { style: activePlan.style, label: activePlan.label, programs: activePlan.programs } : null, savedAt: new Date().toISOString() };
    const next = [project, ...projects.filter(p => p.name !== project.name)].slice(0, 25);
    setProjects(next); persistProjects(next); writeCookie(COOKIE_KEY, project.name); setStatus('Project saved');
  };

  const loadProject = project => {
    setProjectName(project.name);
    const loaded = (project.arrangement || []).map((n, i) => ({ ...n, id: n.id || i + 1 }));
    setArrangement(loaded); setSelectedNoteId(loaded[0] ? loaded[0].id : null);
    const plan = project.plan && STYLE_PLANS[project.plan.style] ? { ...pickClassicRobloxPlan(loaded, 1), style: project.plan.style, label: project.plan.label, programs: project.plan.programs || STYLE_PLANS[project.plan.style].programs } : pickClassicRobloxPlan(loaded, 1);
    planRef.current = plan; setActivePlan(plan); setMidiBlob(makeMidi(loaded, plan.programs)); setWavBlob(null); writeCookie(COOKIE_KEY, project.name);
    setShowProjects(false); setStatus('Loaded — ' + project.name);
  };

  const ensureSynth = async plan => {
    const usePlan = plan || planRef.current || pickClassicRobloxPlan([], 1);
    if (synthRef.current && contextRef.current) return synthRef.current;
    if (synthRef.current) { try { synthRef.current.destroy(); } catch (e) {} synthRef.current = null; }
    if (contextRef.current) { try { await contextRef.current.close(); } catch (e) {} contextRef.current = null; }
    const context = new AudioContext(); contextRef.current = context;
    await context.audioWorklet.addModule(SPESSA_PROCESSOR_URL);
    const synth = new WorkletSynthesizer(context);
    const toLoad = [];
    if (usePlan.primary) toLoad.push(usePlan.primary);
    if (usePlan.drums && (!usePlan.primary || usePlan.drums.id !== usePlan.primary.id)) toLoad.push(usePlan.drums);
    const extra = SOUNDFONT_LIBRARY.find(s => s.id === 'roblox-sf' && (!usePlan.primary || usePlan.primary.id !== 'roblox-sf'));
    if (extra) toLoad.push(extra);
    for (const bank of toLoad) {
      try {
        setStatus('Loading soundfont: ' + bank.name + '…');
        const buf = await fetch(bank.url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); });
        await synth.soundBankManager.addSoundBank(buf, bank.id);
      } catch (err) { console.warn('SF2 load failed', bank.name, err); }
    }
    if (synth.isReady) await synth.isReady;
    if (typeof synth.connect === 'function') synth.connect(context.destination);
    synthRef.current = synth; planRef.current = usePlan; return synth;
  };

  const stopPlayback = () => { stopPlaybackInternal(); setPlaying(false); };

  const scheduleFrom = (synth, fromTime) => {
    stopPlaybackInternal();
    const programs = (planRef.current && planRef.current.programs) || STYLE_PLANS.mule.programs;
    if (typeof synth.systemReset === 'function') synth.systemReset();
    synth.programChange(9, programs.drums || 0); synth.programChange(0, programs.bass || 33);
    synth.programChange(1, programs.guitar || 0); synth.programChange(2, programs.vocals || 80);
    if (typeof synth.setMainVolume === 'function') synth.setMainVolume(volume);
    const roleChannel = { drums: 9, bass: 0, guitar: 1, vocals: 2 };
    let maxEnd = 0;
    arrangement.forEach(note => { maxEnd = Math.max(maxEnd, note.startTimeSeconds + Math.max(0.05, note.durationSeconds)); });
    setPlaybackDuration(maxEnd);
    arrangement.filter(n => n.startTimeSeconds + n.durationSeconds > fromTime).forEach(note => {
      const ch = roleChannel[note.role] != null ? roleChannel[note.role] : 1;
      const noteStart = Math.max(0, note.startTimeSeconds - fromTime);
      const alreadyElapsed = Math.max(0, fromTime - note.startTimeSeconds);
      const dur = Math.max(0.05, note.durationSeconds - alreadyElapsed);
      const vel = Math.max(1, Math.min(127, Math.round((note.amplitude || 0.8) * 127)));
      scheduledTimersRef.current.push(
        window.setTimeout(() => { try { synth.noteOn(ch, note.pitchMidi, vel); } catch (e) {} }, noteStart * 1000),
        window.setTimeout(() => { try { synth.noteOff(ch, note.pitchMidi); } catch (e) {} }, (noteStart + dur) * 1000)
      );
    });
    seekOffsetRef.current = fromTime; playStartRef.current = performance.now(); setPlaybackTime(fromTime); setPlaying(true);
    const tick = () => {
      const elapsed = (performance.now() - playStartRef.current) / 1000 + seekOffsetRef.current;
      setPlaybackTime(Math.min(elapsed, maxEnd));
      if (elapsed < maxEnd) playbackRafRef.current = requestAnimationFrame(tick); else setPlaying(false);
    };
    playbackRafRef.current = requestAnimationFrame(tick);
    playbackStopTimerRef.current = window.setTimeout(() => setPlaying(false), Math.max(0, (maxEnd - fromTime) * 1000) + 200);
  };

  const playArrangement = async () => {
    if (!arrangement.length) { setStatus('Nothing to play'); return; }
    try {
      const plan = planRef.current || pickClassicRobloxPlan(arrangement, 1);
      setStatus('Loading ' + plan.label + '…');
      const synth = await ensureSynth(plan);
      if (contextRef.current.state === 'suspended') await contextRef.current.resume();
      const from = playbackTime > 0 && playbackTime < playbackDuration - 0.05 ? playbackTime : 0;
      scheduleFrom(synth, from); setStatus('Playing · ' + plan.label);
    } catch (error) {
      console.error(error); setStatus('Playback failed — ' + (error.message || 'unknown')); setPlaying(false);
    }
  };

  const seekTo = async t => {
    const clamped = Math.max(0, Math.min(playbackDuration || t, t)); setPlaybackTime(clamped);
    if (playing) {
      try {
        const plan = planRef.current || pickClassicRobloxPlan(arrangement, 1);
        const synth = await ensureSynth(plan);
        if (contextRef.current.state === 'suspended') await contextRef.current.resume();
        scheduleFrom(synth, clamped);
      } catch (e) { console.error(e); }
    }
  };

  const onDrop = e => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) convert(f); };
  const onFileInput = e => { const f = e.target.files && e.target.files[0]; if (f) convert(f); e.target.value = ''; };
  const panel = { background: rbx.panel, border: '2px solid #000', boxShadow: '2px 2px 0 rgba(0,0,0,0.35)' };

  return (
    <div style={{ height: '100%', width: '100%', fontFamily: rbx.font, fontSize: 12, color: rbx.text, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#87ceeb url(' + SKY_URL + ') center / cover no-repeat' }} onDragOver={e => { e.preventDefault(); e.stopPropagation(); }} onDrop={onDrop}>
      <div style={{ height: 'auto', minHeight: 28, background: 'linear-gradient(180deg, #9ec4e8 0%, #6e99c9 100%)', borderBottom: '2px solid #000', display: 'flex', alignItems: 'center', padding: '4px 6px', gap: 5, flexShrink: 0, flexWrap: 'wrap', overflow: 'hidden' }}>
        <span style={{ fontWeight: 'bold', fontSize: 13, color: '#fff', textShadow: '1px 1px 0 #000' }}>ROBLOX<span style={{ color: rbx.yellow }}>ify</span></span>
        <label style={{ ...btn, display: 'inline-block' }}>Open<input type="file" accept="audio/*" onChange={onFileInput} disabled={working} style={{ display: 'none' }} /></label>
        <button type="button" style={saveBtn} disabled={working || !midiBlob} onClick={() => midiBlob && downloadBlob(midiBlob, 'robloxify.mid')}>Save MIDI</button>
        <button type="button" style={saveBtnGray} disabled={working || !arrangement.length} onClick={() => STEM_ORDER.forEach(roleId => downloadStem(roleId))}>Save Stems</button>
        <button type="button" style={saveBtnGray} disabled={working || renderingWav || !arrangement.length} onClick={renderAndDownloadWav}>{renderingWav ? 'Rendering WAV…' : 'Save WAV'}</button>
        <button type="button" style={btn} disabled={!arrangement.length || working} onClick={playing ? stopPlayback : playArrangement}>{playing ? 'Stop' : 'Play'}</button>
        <button type="button" style={btnGray} disabled={!arrangement.length} onClick={saveProject}>Save</button>
        <button type="button" style={btnGray} onClick={() => setShowProjects(v => !v)}>Places</button>
        <button type="button" style={btnGray} onClick={() => setViewMode(v => (v === 'roll' ? 'list' : 'roll'))}>{viewMode === 'roll' ? 'List' : 'Piano Roll'}</button>
        <select value={manualStyle} onChange={e => {
            const v = e.target.value; setManualStyle(v);
            if (v !== 'auto' && STYLE_PLANS[v] && arrangement.length) {
              const forced = STYLE_PLANS[v];
              const plan = { style: v, label: forced.label, reason: 'Manual: ' + forced.label, programs: { ...forced.programs }, primary: SOUNDFONT_LIBRARY.find(s => forced.primaryIds.includes(s.id)) || SOUNDFONT_LIBRARY[0], drums: SOUNDFONT_LIBRARY.find(s => s.id === forced.drumId) };
              planRef.current = plan; setActivePlan(plan);
              if (synthRef.current) { try { synthRef.current.destroy(); } catch (err) {} synthRef.current = null; }
              setMidiBlob(makeMidi(arrangement, plan.programs));
              setStatus('Style set to ' + forced.label + ' — press Play to load soundfont');
            }
          }} style={{ fontFamily: rbx.font, fontSize: 10, border: '2px solid #000', maxWidth: 160 }} title="Pick any soundfont style">
          <option value="auto">Style: Auto</option>
          <option value="mule">Wind of Fjords (M.U.L.E.)</option>
          <option value="fjords-midi">Wind of Fjords MIDI</option>
          <option value="strategy">Great Strategy</option>
          <option value="roblox-sf">Roblox Soundfont</option>
          <option value="gamehero">GameHero</option>
          <option value="classic-days">Classic Days</option>
          <option value="party">Party Music</option>
          <option value="monster">Monster Mash</option>
          <option value="horror">Roblox Horror</option>
          <option value="stealth">StealthPilot</option>
          <option value="chip">Nokia / Chip</option>
          <option value="classic">Classic Roblox</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#fff', textShadow: '1px 1px 0 #000' }}>{projectName}</span>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding: 8, gap: 6, overflow: 'hidden' }}>
          <div style={{ ...panel, padding: 8, flexShrink: 0 }}>
            <div style={{ background: rbx.blue, color: '#fff', fontWeight: 'bold', fontSize: 11, padding: '2px 6px', margin: '-8px -8px 6px', borderBottom: '2px solid #000' }}>Status</div>
            <div style={{ fontSize: 11, marginBottom: 4 }}>{status}</div>
            <div style={{ fontSize: 10, marginBottom: 4 }}>Stems: {STEM_ORDER.map(id => (arrangement.some(n => n.role === id) ? 1 : 0)).reduce((a, b) => a + b, 0)} · MIDI: 8-track · WAV: {wavBlob ? 'ready' : 'not rendered'}</div>
            <HealthBar value={progress} max={100} label="Loading" width="100%" height={14} />
            {activePlan && <div style={{ marginTop: 4, fontSize: 10, color: '#333' }}><b>{activePlan.label}</b> — {activePlan.reason}</div>}
          </div>
          {showProjects && (
            <div style={{ ...panel, padding: 6, maxHeight: 90, overflow: 'auto', fontSize: 11, flexShrink: 0 }}>
              {projects.length === 0 && <div style={{ color: '#666' }}>No saved places.</div>}
              {projects.map(p => (
                <div key={p.id} style={{ display: 'flex', gap: 4, marginBottom: 3 }}>
                  <button type="button" style={btn} onClick={() => loadProject(p)}>Load</button>
                  <button type="button" style={{ ...btn, background: '#e8a0a0' }} onClick={() => { const next = projects.filter(x => x.id !== p.id); setProjects(next); persistProjects(next); }}>Del</button>
                  <span style={{ fontWeight: 'bold' }}>{p.name}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ ...panel, padding: '4px 8px', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <label style={{ fontSize: 11 }}>Place <input value={projectName} onChange={e => setProjectName(e.target.value)} style={{ width: 140, border: '2px solid #000', fontFamily: rbx.font, fontSize: 11 }} /></label>
            {selectedNote && (
              <>
                <label style={{ fontSize: 11 }}>Role <select value={selectedNote.role} onChange={e => editSelected({ role: e.target.value })} style={{ border: '2px solid #000', fontFamily: rbx.font, fontSize: 11 }}>{roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
                <label style={{ fontSize: 11 }}>Pitch <input type="number" min={0} max={127} value={selectedNote.pitchMidi} onChange={e => editSelected({ pitchMidi: Number(e.target.value) })} style={{ width: 48, border: '2px solid #000', fontFamily: rbx.font, fontSize: 11 }} /></label>
              </>
            )}
          </div>
          <div style={{ ...panel, padding: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {viewMode === 'roll' ? (
              <PianoRoll notes={arrangement} onChange={updateArrangement} selectedId={selectedNoteId} onSelect={setSelectedNoteId} playhead={playing || playbackTime > 0 ? playbackTime : null} duration={playbackDuration} />
            ) : (
              <div style={{ overflow: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead><tr style={{ background: '#c5d8ec' }}><th style={{ textAlign: 'left', padding: 4 }}>#</th><th style={{ textAlign: 'left', padding: 4 }}>Role</th><th style={{ textAlign: 'left', padding: 4 }}>Pitch</th><th style={{ textAlign: 'left', padding: 4 }}>Start</th><th style={{ textAlign: 'left', padding: 4 }}>Dur</th></tr></thead>
                  <tbody>
                    {arrangement.slice(0, 300).map(note => (
                      <tr key={note.id} onClick={() => setSelectedNoteId(note.id)} style={{ background: note.id === selectedNoteId ? rbx.blue : '#fff', color: note.id === selectedNoteId ? '#fff' : '#000', cursor: 'pointer' }}>
                        <td style={{ padding: 3 }}>{note.id}</td><td style={{ padding: 3 }}>{note.role}</td><td style={{ padding: 3 }}>{note.pitchMidi}</td><td style={{ padding: 3 }}>{note.startTimeSeconds.toFixed(2)}</td><td style={{ padding: 3 }}>{note.durationSeconds.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        <div style={{ width: 130, flexShrink: 0, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 12, background: 'rgba(0,0,0,0.25)', borderLeft: '2px solid #000' }}>
          <div style={{ background: 'rgba(0,0,0,0.55)', border: '2px solid #000', padding: 6, color: '#fff', fontSize: 10, fontWeight: 'bold' }}>Player List<div style={{ marginTop: 4, fontWeight: 'normal' }}>You</div></div>
          <HealthBar value={volume} max={1} label="Volume" width="100%" height={18} onChange={v => { setVolume(v); if (synthRef.current && typeof synthRef.current.setMainVolume === 'function') { try { synthRef.current.setMainVolume(v); } catch (e) {} } }} />
          <HealthBar value={playbackTime} max={Math.max(playbackDuration, 0.01)} label={'Time ' + playbackTime.toFixed(1) + ' / ' + (playbackDuration || 0).toFixed(1) + 's'} width="100%" height={18} onChange={seekTo} />
          <HealthBar value={progress} max={100} label="Loading" width="100%" height={18} />
        </div>
      </div>
      <div style={{ height: 24, background: 'rgba(0,0,0,0.65)', borderTop: '2px solid #000', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', padding: '0 8px', flexShrink: 0 }}>
        Any song → Roblox style. Pick any soundfont in Style. Piano roll to edit. Drag Time to seek.
      </div>
    </div>
  );
}

export default MusicAI;
