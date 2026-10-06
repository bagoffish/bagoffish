import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Midi } from '@tonejs/midi';
import { WorkletSynthesizer } from 'spessasynth_lib';

const SPESSA_PROCESSOR_URL = '/spessasynth_processor.min.js';
const API_BASE = window.RENDERER_API_BASE || 'https://winxp-7yes.onrender.com';
const MAX_SECONDS = 600;
const MAX_BYTES = 50 * 1024 * 1024;
const MODEL_URL = '/basic-pitch-model/model.json';
const SKY_URL = '/images/sky.png';

const SOUNDFONT_LIBRARY = [
  { id: 'fjords', name: 'Wind of Fjords', url: '/soundfonts/Instruments/WorkingR-Blox/Wind_Of_Fjords_V2.5.1a/WindOfFjordsV2.5.1a.sf2', tags: ['classic', 'mule', 'lead', 'chip'] },
  { id: 'fjords-midi', name: 'Wind of Fjords MIDI', url: '/soundfonts/Instruments/MIDI%20Compatible%20Soundfonts/Wind_of_Fjords_MIDI.sf2', tags: ['classic', 'mule'] },
  { id: 'strategy', name: 'The Great Strategy', url: '/soundfonts/Instruments/MIDI%20Compatible%20Soundfonts/The_Great_Strategy_MIDI.sf2', tags: ['classic', 'orchestral'] },
  { id: 'roblox-sf', name: 'Roblox Soundfont', url: '/soundfonts/Instruments/WorkingR-Blox/Roblox%20Soundfont-1.sf2', tags: ['classic', 'general'] },
  { id: 'gamehero', name: 'GameHero', url: '/soundfonts/Instruments/Soundfonts/GameHero%20Soundfont.sf2', tags: ['classic', 'game'] },
  { id: 'classic-days', name: 'Classic Days', url: '/soundfonts/Instruments/Soundfonts/Classic%20Days.sf2', tags: ['classic', 'nostalgia'] },
  { id: 'party', name: 'Party Music', url: '/soundfonts/Instruments/Soundfonts/Party%20Music.sf2', tags: ['party', 'dance'] },
  { id: 'monster', name: 'Monster Mash', url: '/soundfonts/Instruments/Soundfonts/Monster%20Mash.sf2', tags: ['halloween', 'party'] },
  { id: 'horror', name: 'Roblox Horror', url: '/soundfonts/Instruments/Soundfonts/Roblox%20Horror.sf2', tags: ['horror', 'dark'] },
  { id: 'drums', name: 'StealthPilot Drums', url: '/soundfonts/Instruments/MIDI%20Compatible%20Soundfonts/StealthPilot_MIDI_DRUMS_ONLY.sf2', tags: ['drums'] },
  { id: 'stealth', name: 'StealthPilot', url: '/soundfonts/Instruments/Soundfonts/StealthPilot.sf2', tags: ['classic'] },
  { id: 'nokia', name: 'Nokia Tongbao', url: '/soundfonts/Instruments/WorkingR-Blox/Nokia_Tongbao_Bank.sf2', tags: ['chip', 'mule'] },
];

const STYLE_PLANS = {
  mule: {
    label: 'M.U.L.E. / Wind of Fjords',
    primaryIds: ['fjords', 'fjords-midi', 'roblox-sf'],
    drumId: 'drums',
    programs: { drums: 0, bass: 38, guitar: 81, vocals: 80 },
  },
  strategy: {
    label: 'Great Strategy',
    primaryIds: ['strategy', 'gamehero'],
    drumId: 'drums',
    programs: { drums: 0, bass: 33, guitar: 48, vocals: 56 },
  },
  party: {
    label: 'Party / Dance Potion',
    primaryIds: ['party', 'monster', 'roblox-sf'],
    drumId: 'drums',
    programs: { drums: 0, bass: 39, guitar: 81, vocals: 80 },
  },
  horror: {
    label: 'Horror',
    primaryIds: ['horror', 'classic-days'],
    drumId: 'drums',
    programs: { drums: 0, bass: 34, guitar: 19, vocals: 89 },
  },
  chip: {
    label: 'Chip / Nokia',
    primaryIds: ['nokia', 'fjords', 'roblox-sf'],
    drumId: 'drums',
    programs: { drums: 0, bass: 38, guitar: 80, vocals: 81 },
  },
  classic: {
    label: 'Classic Roblox',
    primaryIds: ['roblox-sf', 'gamehero', 'fjords', 'stealth'],
    drumId: 'drums',
    programs: { drums: 0, bass: 33, guitar: 30, vocals: 80 },
  },
};

function pickClassicRobloxPlan(notes, duration) {
  const n = notes.length || 1;
  const dur = Math.max(duration || 1, 0.5);
  const density = n / dur;
  let sumPitch = 0, shortCount = 0, lowCount = 0, highCount = 0, longCount = 0;
  notes.forEach(note => {
    const p = note.pitchMidi || 60;
    sumPitch += p;
    if ((note.durationSeconds || 0) < 0.18) shortCount++;
    if ((note.durationSeconds || 0) > 0.7) longCount++;
    if (p < 52) lowCount++;
    if (p >= 72) highCount++;
  });
  const avgPitch = sumPitch / n;
  const shortRatio = shortCount / n;
  const lowRatio = lowCount / n;
  const highRatio = highCount / n;
  const longRatio = longCount / n;

  let style = 'mule';
  let reason = 'Default classic Roblox M.U.L.E. palette';
  if (avgPitch < 55 && density < 4 && longRatio > 0.25) {
    style = 'horror';
    reason = 'Low sparse sustained notes → horror bank';
  } else if (density > 10 && shortRatio > 0.45) {
    style = 'party';
    reason = 'Dense short hits → party / dance potion';
  } else if (density > 6 && highRatio > 0.35 && shortRatio > 0.3) {
    style = 'chip';
    reason = 'Bright busy melody → chip / Nokia leads';
  } else if (lowRatio > 0.4 && density < 6) {
    style = 'strategy';
    reason = 'Bass-heavy mid tempo → Great Strategy';
  } else if (avgPitch >= 60 && density >= 3 && density <= 9) {
    style = 'mule';
    reason = 'Balanced melody → Wind of Fjords (M.U.L.E. style)';
  } else {
    style = 'classic';
    reason = 'General mix → classic Roblox soundfont';
  }

  const plan = STYLE_PLANS[style] || STYLE_PLANS.mule;
  const primary =
    SOUNDFONT_LIBRARY.find(s => plan.primaryIds.includes(s.id)) ||
    SOUNDFONT_LIBRARY.find(s => s.id === 'fjords') ||
    SOUNDFONT_LIBRARY[0];
  const drums =
    SOUNDFONT_LIBRARY.find(s => s.id === plan.drumId) ||
    SOUNDFONT_LIBRARY.find(s => s.tags.includes('drums'));

  return {
    style,
    label: plan.label,
    reason,
    primary,
    drums,
    programs: { ...plan.programs },
    analysis: { density: Math.round(density * 10) / 10, avgPitch: Math.round(avgPitch), noteCount: n },
  };
}

const roles = [
  { id: 'drums', label: 'DRUMS', channel: 9, program: 0 },
  { id: 'bass', label: 'BASS', channel: 0, program: 38 },
  { id: 'guitar', label: 'LEAD', channel: 1, program: 81 },
  { id: 'vocals', label: 'SQUARE', channel: 2, program: 80 },
];

const rbx = {
  blue: '#6e99c9',
  yellow: '#f5cd2f',
  healthBg: '#1a1a1a',
  panel: 'rgba(255,255,255,0.92)',
  font: 'Verdana, Geneva, Tahoma, sans-serif',
  text: '#000',
};

const btn = {
  background: rbx.yellow,
  border: '2px solid #000',
  color: '#000',
  fontFamily: rbx.font,
  fontSize: 11,
  fontWeight: 'bold',
  padding: '3px 8px',
  cursor: 'url("/images/Link Select.cur") 3 3, pointer',
  borderRadius: 0,
  boxShadow: 'inset 1px 1px 0 #fff6a0, inset -1px -1px 0 #c9a600',
};
const btnGray = { ...btn, background: '#e0e0e0', boxShadow: 'inset 1px 1px 0 #fff, inset -1px -1px 0 #999' };

function HealthBar({ value, max = 1, label, width = 120, height = 14, onChange }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const barRef = React.useRef(null);
  const dragging = React.useRef(false);

  const setFromEvent = e => {
    if (!onChange || !barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const x = (e.clientX != null ? e.clientX : (e.touches && e.touches[0] && e.touches[0].clientX)) - rect.left;
    const next = Math.max(0, Math.min(1, x / Math.max(rect.width, 1)));
    onChange(next * (max || 1));
  };

  const onPointerDown = e => {
    if (!onChange) return;
    dragging.current = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    setFromEvent(e);
  };
  const onPointerMove = e => {
    if (!onChange || !dragging.current) return;
    setFromEvent(e);
  };
  const onPointerUp = e => {
    dragging.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {}
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: typeof width === 'string' ? width : undefined, minWidth: typeof width === 'number' ? width : undefined }}>
      {label && <div style={{ fontFamily: rbx.font, fontSize: 10, fontWeight: 'bold', color: '#fff', textShadow: '1px 1px 0 #000' }}>{label}</div>}
      <div
        ref={barRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          width: '100%',
          height,
          background: rbx.healthBg,
          border: '2px solid #000',
          boxShadow: 'inset 1px 1px 0 #444',
          position: 'relative',
          overflow: 'hidden',
          cursor: onChange ? 'url("/images/Link%20Select.cur") 3 3, pointer' : 'default',
          touchAction: onChange ? 'none' : undefined,
        }}
      >
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct + '%', background: 'linear-gradient(180deg, #66ff66 0%, #00b400 45%, #008000 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)', transition: dragging.current ? 'none' : 'width 0.12s linear', pointerEvents: 'none' }} />
      </div>
    </div>
  );
}

function cleanDetectedNotes(notes, options = {}) {
  const { minDuration = 0.08, minAmplitude = 0.3, minPitch = 0, maxPitch = 127 } = options;
  const sorted = notes
    .filter(note => Number.isFinite(note.startTimeSeconds) && Number.isFinite(note.durationSeconds) && Number.isFinite(note.pitchMidi) && note.durationSeconds >= minDuration && (note.amplitude == null || note.amplitude >= minAmplitude) && note.pitchMidi >= minPitch && note.pitchMidi <= maxPitch)
    .sort((x, y) => x.startTimeSeconds - y.startTimeSeconds || x.pitchMidi - y.pitchMidi);
  const result = [];
  const lastByPitch = new Map();
  sorted.forEach(note => {
    const previous = lastByPitch.get(note.pitchMidi);
    if (previous && note.startTimeSeconds <= previous.startTimeSeconds + previous.durationSeconds + 0.035) {
      const previousEnd = previous.startTimeSeconds + previous.durationSeconds;
      const noteEnd = note.startTimeSeconds + note.durationSeconds;
      previous.durationSeconds = Math.max(previousEnd, noteEnd) - previous.startTimeSeconds;
      previous.amplitude = Math.max(previous.amplitude || 0, note.amplitude || 0);
      return;
    }
    const clean = { ...note, startTimeSeconds: Math.max(0, note.startTimeSeconds), durationSeconds: Math.max(minDuration, note.durationSeconds) };
    result.push(clean);
    lastByPitch.set(clean.pitchMidi, clean);
  });
  return result;
}

function assignRoles(detected, duration) {
  const density = detected.length / Math.max(duration, 1);
  return cleanDetectedNotes(detected, { minDuration: 0.075, minAmplitude: 0.34 }).map((note, index) => {
    const pitch = note.pitchMidi;
    const short = note.durationSeconds < 0.18;
    const long = note.durationSeconds > 0.65;
    let role = 'guitar';
    if (pitch < 52 && !short) role = 'bass';
    else if (short && pitch >= 38 && pitch <= 84 && density > 5) role = 'drums';
    else if (pitch >= 68 && (long || pitch >= 82)) role = 'vocals';
    if (role === 'drums') {
      return { ...note, id: index + 1, role, pitchMidi: pitch < 48 ? 36 : pitch < 62 ? 38 : pitch < 76 ? 42 : 46 };
    }
    return { ...note, id: index + 1, role };
  });
}

function stylizeClassicRoblox(notes) {
  const step = 0.125;
  const quantized = notes.map(note => ({
    ...note,
    startTimeSeconds: Math.max(0, Math.round(note.startTimeSeconds / step) * step),
    durationSeconds: Math.max(step, Math.round(Math.max(step, note.durationSeconds) / step) * step),
  }));
  const byRole = { drums: [], bass: [], guitar: [], vocals: [] };
  quantized.slice().sort((a, b) => a.startTimeSeconds - b.startTimeSeconds).forEach(note => {
    const list = byRole[note.role] || byRole.guitar;
    const last = list[list.length - 1];
    if (last && note.startTimeSeconds < last.startTimeSeconds + 0.06 && note.role !== 'drums') {
      if ((note.amplitude || 0) > (last.amplitude || 0)) list[list.length - 1] = note;
      return;
    }
    list.push(note);
  });
  return [].concat(byRole.drums, byRole.bass, byRole.guitar, byRole.vocals)
    .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi)
    .map((note, i) => ({ ...note, id: i + 1 }));
}

function makeMidi(notes, programs) {
  const midi = new Midi();
  midi.name = 'Robloxify Classic';
  midi.header.setTempo(120);
  const roleList = [
    { id: 'drums', label: 'DRUMS', channel: 9, program: (programs && programs.drums) || 0 },
    { id: 'bass', label: 'BASS', channel: 0, program: (programs && programs.bass) || 38 },
    { id: 'guitar', label: 'LEAD', channel: 1, program: (programs && programs.guitar) || 81 },
    { id: 'vocals', label: 'SQUARE', channel: 2, program: (programs && programs.vocals) || 80 },
  ];
  roleList.forEach(role => {
    const track = midi.addTrack();
    track.name = role.label;
    track.channel = role.channel;
    track.instrument.number = role.program;
    notes.filter(note => note.role === role.id).forEach(note => {
      track.addNote({
        midi: note.pitchMidi,
        time: note.startTimeSeconds,
        duration: Math.max(0.04, note.durationSeconds),
        velocity: Math.max(0.01, Math.min(1, note.amplitude || 0.8)),
      });
    });
  });
  return new Blob([midi.toArray()], { type: 'audio/midi' });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function yieldToBrowser() {
  return new Promise(resolve => {
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      window.requestAnimationFrame(() => setTimeout(resolve, 0));
    } else setTimeout(resolve, 0);
  });
}

async function transcribeOnBackend(file, onStatus) {
  onStatus('Uploading to server...');
  const form = new FormData();
  form.append('audio', file, file.name || 'audio.wav');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15 * 60 * 1000);
  try {
    onStatus('Server is working...');
    const res = await fetch(API_BASE + '/robloxify', { method: 'POST', body: form, signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Server error ' + res.status);
    if (!Array.isArray(data.notes)) throw new Error('Server returned no notes');
    return { notes: data.notes, duration: data.duration || 0 };
  } finally {
    clearTimeout(timeout);
  }
}

async function transcribeLocally(file, onStatus, onProgress) {
  onStatus('Preparing audio...');
  await yieldToBrowser();
  const bytes = await file.arrayBuffer();
  await yieldToBrowser();
  const decodeContext = new AudioContext();
  let sourceBuffer;
  try {
    sourceBuffer = await decodeContext.decodeAudioData(bytes.slice(0));
  } finally {
    await decodeContext.close().catch(() => {});
  }
  const duration = sourceBuffer.duration;
  if (duration > MAX_SECONDS) throw new Error('Audio must be under 10 minutes. Please trim it.');
  onStatus('Resampling...');
  await yieldToBrowser();
  const targetRate = 22050;
  const targetLength = Math.ceil(duration * targetRate);
  const offlineContext = new OfflineAudioContext(1, targetLength, targetRate);
  const source = offlineContext.createBufferSource();
  source.buffer = sourceBuffer;
  source.connect(offlineContext.destination);
  source.start(0);
  const audioBuffer = await offlineContext.startRendering();
  await yieldToBrowser();
  onStatus('Loading model...');
  await yieldToBrowser();
  const tf = await import('@tensorflow/tfjs');
  await yieldToBrowser();
  const { BasicPitch, addPitchBendsToNoteEvents, noteFramesToTime, outputToNotesPoly } = await import('@spotify/basic-pitch');
  await yieldToBrowser();
  await tf.setBackend('webgl').catch(() => tf.setBackend('cpu'));
  await tf.ready();
  await yieldToBrowser();
  const model = await tf.loadGraphModel(MODEL_URL);
  const basicPitch = new BasicPitch(model);
  await yieldToBrowser();
  onStatus('Transcribing...');
  const frames = []; const onsets = []; const contours = [];
  let lastProgress = -1; let lastYield = performance.now();
  await basicPitch.evaluateModel(
    audioBuffer,
    (frameBatch, onsetBatch, contourBatch) => {
      frames.push(...frameBatch); onsets.push(...onsetBatch); contours.push(...contourBatch);
    },
    async value => {
      const progress = Math.max(0, Math.min(1, value));
      if (progress - lastProgress >= 0.02 || progress >= 1) {
        lastProgress = progress; onProgress(progress);
        onStatus('Transcribing ' + Math.round(progress * 100) + '%');
      }
      if (performance.now() - lastYield > 80) { lastYield = performance.now(); await yieldToBrowser(); }
    }
  );
  await yieldToBrowser();
  onStatus('Extracting notes...');
  const notes = noteFramesToTime(addPitchBendsToNoteEvents(contours, outputToNotesPoly(frames, onsets, 0.34, 0.42, 8)));
  try { model.dispose(); } catch (e) {}
  return { notes: notes || [], duration };
}

function MusicAI({ onClose }) {
  const STORAGE_KEY = 'robloxify-projects-v1';
  const COOKIE_KEY = 'robloxify-last-project';
  function readCookie(name) {
    const prefix = name + '=';
    const item = document.cookie.split('; ').find(value => value.indexOf(prefix) === 0);
    return item ? decodeURIComponent(item.slice(prefix.length)) : '';
  }
  function writeCookie(name, value) {
    document.cookie = name + '=' + encodeURIComponent(value) + '; max-age=31536000; path=/; SameSite=Lax';
  }
  function loadProjects() {
    try { const value = window.localStorage.getItem(STORAGE_KEY); return value ? JSON.parse(value) : []; }
    catch (e) { return []; }
  }
  function persistProjects(value) {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch (e) { console.error(e); }
  }

  const synthRef = useRef(null);
  const contextRef = useRef(null);
  const planRef = useRef(null);
  const [file, setFile] = useState(null);
  const [midiBlob, setMidiBlob] = useState(null);
  const [notes, setNotes] = useState([]);
  const [arrangement, setArrangement] = useState([]);
  const [status, setStatus] = useState('Drop audio → classic Roblox song');
  const [progress, setProgress] = useState(0);
  const [working, setWorking] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [projectName, setProjectName] = useState(() => readCookie(COOKIE_KEY) || 'Untitled Place');
  const [projects, setProjects] = useState(() => loadProjects());
  const [showProjects, setShowProjects] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [showTools, setShowTools] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [activePlan, setActivePlan] = useState(null);
  const [manualStyle, setManualStyle] = useState('auto');
  const playbackStopTimerRef = useRef(null);
  const playbackRafRef = useRef(null);
  const conversionIdRef = useRef(0);
  const scheduledTimersRef = useRef([]);

  useEffect(() => {
    return () => {
      if (playbackStopTimerRef.current) window.clearTimeout(playbackStopTimerRef.current);
      if (playbackRafRef.current) window.cancelAnimationFrame(playbackRafRef.current);
      scheduledTimersRef.current.forEach(id => clearTimeout(id));
      scheduledTimersRef.current = [];
      if (synthRef.current) { try { synthRef.current.destroy(); } catch (e) {} synthRef.current = null; }
      if (contextRef.current) { contextRef.current.close().catch(() => {}); contextRef.current = null; }
    };
  }, []);

  const convert = async inputFile => {
    if (!inputFile || !(inputFile.type || '').startsWith('audio/')) { setStatus('Choose an audio file'); return; }
    if (inputFile.size > MAX_BYTES) { setStatus('File too large (max 50 MB)'); return; }
    const conversionId = ++conversionIdRef.current;
    if (working) { setStatus('Already converting — please wait'); return; }
    setFile(inputFile); setWorking(true); setProgress(0); setPlaybackTime(0); setPlaybackDuration(0); setStatus('Starting...');
    try {
      let rawNotes = []; let duration = 0; let usedBackend = false;
      try {
        const result = await transcribeOnBackend(inputFile, msg => { if (conversionId === conversionIdRef.current) setStatus(msg); });
        if (conversionId !== conversionIdRef.current) return;
        rawNotes = result.notes; duration = result.duration || 0; usedBackend = true; setProgress(90);
      } catch (backendError) {
        console.warn('Backend unavailable, using local:', backendError);
        if (conversionId !== conversionIdRef.current) return;
        setStatus('Server offline — running in browser...'); setProgress(5);
        const result = await transcribeLocally(
          inputFile,
          msg => { if (conversionId === conversionIdRef.current) setStatus(msg); },
          value => { if (conversionId === conversionIdRef.current) setProgress(Math.round(10 + value * 80)); }
        );
        if (conversionId !== conversionIdRef.current) return;
        rawNotes = result.notes; duration = result.duration || 0;
      }

      setStatus('Thinking about instruments...');
      await yieldToBrowser();
      let fitted = assignRoles(rawNotes, duration || 1);
      if (!fitted.length) throw new Error('No musical notes were detected.');
      fitted = stylizeClassicRoblox(fitted);

      let plan = pickClassicRobloxPlan(fitted, duration || 1);
      if (manualStyle !== 'auto' && STYLE_PLANS[manualStyle]) {
        const forced = STYLE_PLANS[manualStyle];
        plan = {
          ...plan,
          style: manualStyle,
          label: forced.label,
          reason: 'Manual style: ' + forced.label,
          programs: { ...forced.programs },
          primary: SOUNDFONT_LIBRARY.find(s => forced.primaryIds.includes(s.id)) || plan.primary,
        };
      }
      planRef.current = plan;
      setActivePlan(plan);
      setStatus('Using ' + plan.label + ' — ' + plan.reason);
      await yieldToBrowser();

      setNotes(fitted); setArrangement(fitted); setSelectedNoteId(fitted[0] ? fitted[0].id : null);
      setMidiBlob(makeMidi(fitted, plan.programs)); setProgress(100);
      setStatus('Done — ' + fitted.length + ' notes · ' + plan.label + (usedBackend ? ' (server)' : ' (local)'));
    } catch (error) {
      console.error(error);
      setStatus('Failed — ' + (error && error.message ? error.message : 'unknown error'));
    } finally {
      if (conversionId === conversionIdRef.current) setWorking(false);
    }
  };

  const saveProject = () => {
    if (!arrangement.length) { setStatus('Convert audio first'); return; }
    const project = {
      id: Date.now(), name: projectName.trim() || 'Untitled Place',
      sourceName: file ? file.name : 'Unknown audio', notes, arrangement,
      plan: activePlan ? { style: activePlan.style, label: activePlan.label, programs: activePlan.programs } : null,
      savedAt: new Date().toISOString(),
    };
    const next = [project, ...projects.filter(item => item.name !== project.name)].slice(0, 25);
    setProjects(next); persistProjects(next); writeCookie(COOKIE_KEY, project.name); setStatus('Project saved');
  };

  const loadProject = project => {
    setProjectName(project.name); setNotes(project.notes || []);
    const loaded = (project.arrangement || []).map((note, index) => ({ ...note, id: note.id || index + 1 }));
    setArrangement(loaded); setSelectedNoteId(loaded[0] ? loaded[0].id : null);
    const plan = project.plan && STYLE_PLANS[project.plan.style]
      ? { ...pickClassicRobloxPlan(loaded, 1), style: project.plan.style, label: project.plan.label || STYLE_PLANS[project.plan.style].label, programs: project.plan.programs || STYLE_PLANS[project.plan.style].programs }
      : pickClassicRobloxPlan(loaded, 1);
    planRef.current = plan; setActivePlan(plan);
    setMidiBlob(makeMidi(loaded, plan.programs)); writeCookie(COOKIE_KEY, project.name);
    setShowProjects(false); setStatus('Loaded — ' + project.name + ' · ' + plan.label);
  };

  const deleteProject = project => {
    const next = projects.filter(item => item.id !== project.id);
    setProjects(next); persistProjects(next); setStatus('Project deleted');
  };

  const updateArrangement = next => {
    setArrangement(next); setNotes(next);
    const programs = (planRef.current && planRef.current.programs) || STYLE_PLANS.mule.programs;
    setMidiBlob(makeMidi(next, programs));
  };

  const selectedNote = arrangement.find(note => note.id === selectedNoteId) || arrangement[0] || null;
  const editSelected = changes => {
    if (!selectedNote) return;
    updateArrangement(arrangement.map(note => (note.id === selectedNote.id ? { ...note, ...changes } : note)));
  };
  const removeSelected = () => {
    if (!selectedNote) return;
    const next = arrangement.filter(note => note.id !== selectedNote.id);
    updateArrangement(next); setSelectedNoteId(next[0] ? next[0].id : null); setStatus('Note deleted');
  };
  const quantizeArrangement = () => { updateArrangement(stylizeClassicRoblox(arrangement)); setStatus('Notes quantized (classic grid)'); };
  const transposeArrangement = amount => {
    updateArrangement(arrangement.map(note => ({ ...note, pitchMidi: Math.max(0, Math.min(127, note.pitchMidi + amount)) })));
    setStatus((amount > 0 ? 'Up ' : 'Down ') + Math.abs(amount) + ' semitones');
  };
  const insertNote = () => {
    const end = arrangement.reduce((max, note) => Math.max(max, note.startTimeSeconds + note.durationSeconds), 0);
    const newNote = { id: Date.now(), pitchMidi: selectedNote ? selectedNote.pitchMidi : 60, startTimeSeconds: end, durationSeconds: 0.25, amplitude: 0.8, role: selectedNote ? selectedNote.role : 'guitar' };
    updateArrangement([...arrangement, newNote]); setSelectedNoteId(newNote.id); setStatus('Note inserted');
  };

  const ensureSynth = async plan => {
    const usePlan = plan || planRef.current || pickClassicRobloxPlan([], 1);
    if (synthRef.current && contextRef.current && planRef.current === usePlan) return synthRef.current;
    if (synthRef.current) { try { synthRef.current.destroy(); } catch (e) {} synthRef.current = null; }
    if (contextRef.current) { try { await contextRef.current.close(); } catch (e) {} contextRef.current = null; }

    const context = new AudioContext();
    contextRef.current = context;
    await context.audioWorklet.addModule(SPESSA_PROCESSOR_URL);
    const synth = new WorkletSynthesizer(context);

    const toLoad = [];
    if (usePlan.primary) toLoad.push(usePlan.primary);
    if (usePlan.drums && (!usePlan.primary || usePlan.drums.id !== usePlan.primary.id)) toLoad.push(usePlan.drums);
    const extra = SOUNDFONT_LIBRARY.find(s => s.id === 'roblox-sf' && (!usePlan.primary || usePlan.primary.id !== 'roblox-sf'));
    if (extra) toLoad.push(extra);

    for (const bank of toLoad) {
      try {
        setStatus('Loading soundfont: ' + bank.name + '...');
        const buf = await fetch(bank.url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); });
        await synth.soundBankManager.addSoundBank(buf, bank.id);
      } catch (err) {
        console.warn('Failed to load soundfont', bank.name, err);
      }
    }

    if (synth.isReady) await synth.isReady;
    if (typeof synth.connect === 'function') synth.connect(context.destination);
    synthRef.current = synth;
    planRef.current = usePlan;
    return synth;
  };

  const stopPlayback = () => {
    if (playbackStopTimerRef.current) { window.clearTimeout(playbackStopTimerRef.current); playbackStopTimerRef.current = null; }
    if (playbackRafRef.current) { window.cancelAnimationFrame(playbackRafRef.current); playbackRafRef.current = null; }
    scheduledTimersRef.current.forEach(id => clearTimeout(id));
    scheduledTimersRef.current = [];
    if (synthRef.current) {
      try { for (let ch = 0; ch < 16; ch++) { if (typeof synthRef.current.stopAll === 'function') synthRef.current.stopAll(ch); } } catch (e) {}
    }
    setPlaying(false);
  };

  const playArrangement = async () => {
    if (!arrangement.length) { setStatus('Nothing to play'); return; }
    try {
      stopPlayback();
      const plan = planRef.current || pickClassicRobloxPlan(arrangement, playbackDuration || 1);
      setStatus('Loading ' + plan.label + ' instruments...');
      const synth = await ensureSynth(plan);
      if (contextRef.current.state === 'suspended') await contextRef.current.resume();
      if (typeof synth.systemReset === 'function') synth.systemReset();

      const programs = plan.programs || STYLE_PLANS.mule.programs;
      synth.programChange(9, programs.drums || 0);
      synth.programChange(0, programs.bass || 38);
      synth.programChange(1, programs.guitar || 81);
      synth.programChange(2, programs.vocals || 80);
      if (typeof synth.setMainVolume === 'function') synth.setMainVolume(volume);

      const roleChannel = { drums: 9, bass: 0, guitar: 1, vocals: 2 };
      let maxEnd = 0;
      arrangement.forEach(note => {
        maxEnd = Math.max(maxEnd, note.startTimeSeconds + Math.max(0.05, note.durationSeconds));
      });

      const t0 = performance.now();
      arrangement.forEach(note => {
        const ch = roleChannel[note.role] != null ? roleChannel[note.role] : 1;
        const dur = Math.max(0.05, note.durationSeconds);
        const vel = Math.max(1, Math.min(127, Math.round((note.amplitude || 0.8) * 127)));
        const onDelay = Math.max(0, note.startTimeSeconds * 1000);
        const offDelay = onDelay + dur * 1000;
        scheduledTimersRef.current.push(
          window.setTimeout(() => { try { synth.noteOn(ch, note.pitchMidi, vel); } catch (e) {} }, onDelay),
          window.setTimeout(() => { try { synth.noteOff(ch, note.pitchMidi); } catch (e) {} }, offDelay)
        );
      });

      setPlaybackDuration(maxEnd); setPlaybackTime(0); setPlaying(true);
      const tick = () => {
        const elapsed = (performance.now() - t0) / 1000;
        setPlaybackTime(Math.min(elapsed, maxEnd));
        if (elapsed < maxEnd) playbackRafRef.current = requestAnimationFrame(tick);
        else setPlaying(false);
      };
      playbackRafRef.current = requestAnimationFrame(tick);
      playbackStopTimerRef.current = window.setTimeout(() => setPlaying(false), maxEnd * 1000 + 200);
      setStatus('Playing · ' + plan.label);
    } catch (error) {
      console.error(error);
      setStatus('Playback failed — ' + (error.message || 'unknown'));
      setPlaying(false);
    }
  };

  const onDrop = e => {
    e.preventDefault(); e.stopPropagation();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) convert(f);
  };
  const onFileInput = e => {
    const f = e.target.files && e.target.files[0];
    if (f) convert(f);
    e.target.value = '';
  };

  const roleCounts = useMemo(() => {
    const counts = { drums: 0, bass: 0, guitar: 0, vocals: 0 };
    arrangement.forEach(n => { if (counts[n.role] != null) counts[n.role]++; });
    return counts;
  }, [arrangement]);

  const panel = { background: rbx.panel, border: '2px solid #000', boxShadow: '2px 2px 0 rgba(0,0,0,0.35)' };

  return (
    <div
      style={{ height: '100%', width: '100%', fontFamily: rbx.font, fontSize: 12, color: rbx.text, display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden', position: 'relative', background: '#87ceeb url(' + SKY_URL + ') center / cover no-repeat' }}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={onDrop}
    >
      <div style={{ height: 28, background: 'linear-gradient(180deg, #9ec4e8 0%, #6e99c9 100%)', borderBottom: '2px solid #000', display: 'flex', alignItems: 'center', padding: '0 6px', gap: 6, flexShrink: 0, zIndex: 2 }}>
        <span style={{ fontWeight: 'bold', fontSize: 13, color: '#fff', textShadow: '1px 1px 0 #000', marginRight: 8 }}>ROBLOX<span style={{ color: rbx.yellow }}>ify</span></span>
        <label style={{ ...btn, display: 'inline-block', margin: 0 }}>Open<input type="file" accept="audio/*" onChange={onFileInput} disabled={working} style={{ display: 'none' }} /></label>
        <button type="button" style={btn} disabled={working || !midiBlob} onClick={() => midiBlob && downloadBlob(midiBlob, 'robloxify-classic.mid')}>Save MIDI</button>
        <button type="button" style={btn} disabled={!arrangement.length || working} onClick={playing ? stopPlayback : playArrangement}>{playing ? 'Stop' : 'Play'}</button>
        <button type="button" style={btnGray} disabled={working || !arrangement.length} onClick={saveProject}>Save</button>
        <button type="button" style={btnGray} onClick={() => setShowProjects(v => !v)}>Places</button>
        <button type="button" style={btnGray} onClick={() => setShowTools(v => !v)}>Tools</button>
        <select value={manualStyle} onChange={e => setManualStyle(e.target.value)} title="Force a classic style" style={{ fontFamily: rbx.font, fontSize: 10, border: '2px solid #000', background: '#fff', maxWidth: 140 }}>
          <option value="auto">Style: Auto (AI)</option>
          <option value="mule">M.U.L.E. / Fjords</option>
          <option value="strategy">Great Strategy</option>
          <option value="party">Party</option>
          <option value="chip">Chip / Nokia</option>
          <option value="horror">Horror</option>
          <option value="classic">Classic Roblox</option>
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: '#fff', textShadow: '1px 1px 0 #000' }}>{projectName}</span>
          <div style={{ ...btnGray, padding: '2px 8px', fontSize: 10 }}>Menu</div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ width: 44, background: 'rgba(0,0,0,0.35)', borderRight: '2px solid #000', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 0', gap: 6, flexShrink: 0 }}>
          {['1', '2'].map(n => <div key={n} style={{ width: 28, height: 28, background: '#ddd', border: '2px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 12 }}>{n}</div>)}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div style={{ ...panel, padding: 8 }}>
            <div style={{ background: rbx.blue, color: '#fff', fontWeight: 'bold', fontSize: 11, padding: '2px 6px', margin: '-8px -8px 8px', borderBottom: '2px solid #000', textShadow: '1px 1px 0 #000' }}>Status</div>
            <div style={{ fontSize: 11, marginBottom: 6, minHeight: 16 }}>{status}</div>
            <HealthBar value={progress} max={100} label="Loading" width="100%" height={16} />
            {activePlan && <div style={{ marginTop: 6, fontSize: 10, color: '#333' }}><b>Style:</b> {activePlan.label} — {activePlan.reason}{activePlan.primary ? ' · SF: ' + activePlan.primary.name : ''}</div>}
            <div style={{ marginTop: 4, fontSize: 10, color: '#555' }}>Any audio → old Roblox song (M.U.L.E. / Fjords). Max 10 min / 50 MB.</div>
          </div>

          {showTools && (
            <div style={{ ...panel, padding: 8, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              <button type="button" style={btnGray} disabled={!arrangement.length} onClick={quantizeArrangement}>Quantize</button>
              <button type="button" style={btnGray} disabled={!arrangement.length} onClick={() => transposeArrangement(1)}>+1 ST</button>
              <button type="button" style={btnGray} disabled={!arrangement.length} onClick={() => transposeArrangement(-1)}>-1 ST</button>
              <button type="button" style={btnGray} disabled={!arrangement.length} onClick={insertNote}>Insert</button>
              <button type="button" style={{ ...btn, background: '#e8a0a0' }} disabled={!selectedNote} onClick={removeSelected}>Delete</button>
            </div>
          )}

          {showProjects && (
            <div style={{ ...panel, padding: 8, maxHeight: 120, overflow: 'auto', fontSize: 11 }}>
              {projects.length === 0 && <div style={{ color: '#666' }}>No saved places.</div>}
              {projects.map(p => (
                <div key={p.id} style={{ display: 'flex', gap: 5, marginBottom: 4, alignItems: 'center' }}>
                  <button type="button" style={btn} onClick={() => loadProject(p)}>Load</button>
                  <button type="button" style={{ ...btn, background: '#e8a0a0' }} onClick={() => deleteProject(p)}>Del</button>
                  <span style={{ fontWeight: 'bold' }}>{p.name}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ ...panel, padding: '6px 8px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 11 }}>Place <input value={projectName} onChange={e => setProjectName(e.target.value)} style={{ width: 160, border: '2px solid #000', padding: '2px 4px', fontFamily: rbx.font, fontSize: 11 }} /></label>
            <span style={{ fontSize: 11 }}><b>D</b>:{roleCounts.drums} <b>B</b>:{roleCounts.bass} <b>L</b>:{roleCounts.guitar} <b>S</b>:{roleCounts.vocals}</span>
          </div>

          {selectedNote && (
            <div style={{ ...panel, padding: 0, fontSize: 11 }}>
              <div style={{ background: rbx.blue, color: '#fff', fontWeight: 'bold', padding: '2px 6px', borderBottom: '2px solid #000', textShadow: '1px 1px 0 #000' }}>Note #{selectedNote.id}</div>
              <div style={{ padding: 8, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <label>Pitch <input type="number" min={0} max={127} value={selectedNote.pitchMidi} onChange={e => editSelected({ pitchMidi: Number(e.target.value) })} style={{ width: 52, border: '2px solid #000', fontFamily: rbx.font, fontSize: 11 }} /></label>
                <label>Start <input type="number" step={0.01} min={0} value={Number(selectedNote.startTimeSeconds.toFixed(3))} onChange={e => editSelected({ startTimeSeconds: Number(e.target.value) })} style={{ width: 64, border: '2px solid #000', fontFamily: rbx.font, fontSize: 11 }} /></label>
                <label>Dur <input type="number" step={0.01} min={0.05} value={Number(selectedNote.durationSeconds.toFixed(3))} onChange={e => editSelected({ durationSeconds: Number(e.target.value) })} style={{ width: 64, border: '2px solid #000', fontFamily: rbx.font, fontSize: 11 }} /></label>
                <label>Role <select value={selectedNote.role} onChange={e => editSelected({ role: e.target.value })} style={{ border: '2px solid #000', fontFamily: rbx.font, fontSize: 11 }}>{roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
              </div>
            </div>
          )}

          <div style={{ ...panel, padding: 0, flex: 1, minHeight: 100, display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: rbx.blue, color: '#fff', fontWeight: 'bold', padding: '2px 6px', borderBottom: '2px solid #000', fontSize: 11, textShadow: '1px 1px 0 #000' }}>Track Notes</div>
            <div style={{ overflow: 'auto', flex: 1, background: '#fff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead><tr style={{ background: '#c5d8ec' }}>
                  <th style={{ textAlign: 'left', padding: '3px 6px', borderBottom: '1px solid #000' }}>#</th>
                  <th style={{ textAlign: 'left', padding: '3px 6px', borderBottom: '1px solid #000' }}>Role</th>
                  <th style={{ textAlign: 'left', padding: '3px 6px', borderBottom: '1px solid #000' }}>Pitch</th>
                  <th style={{ textAlign: 'left', padding: '3px 6px', borderBottom: '1px solid #000' }}>Start</th>
                  <th style={{ textAlign: 'left', padding: '3px 6px', borderBottom: '1px solid #000' }}>Dur</th>
                </tr></thead>
                <tbody>
                  {arrangement.slice(0, 200).map(note => (
                    <tr key={note.id} onClick={() => setSelectedNoteId(note.id)} style={{
                      background: note.id === selectedNoteId ? rbx.blue : note.id % 2 === 0 ? '#eef4fa' : '#fff',
                      color: note.id === selectedNoteId ? '#fff' : '#000',
                      cursor: 'url("/images/Link Select.cur") 3 3, pointer',
                    }}>
                      <td style={{ padding: '2px 6px' }}>{note.id}</td>
                      <td style={{ padding: '2px 6px' }}>{note.role}</td>
                      <td style={{ padding: '2px 6px' }}>{note.pitchMidi}</td>
                      <td style={{ padding: '2px 6px' }}>{note.startTimeSeconds.toFixed(2)}</td>
                      <td style={{ padding: '2px 6px' }}>{note.durationSeconds.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!arrangement.length && <div style={{ padding: 16, color: '#555', fontSize: 11 }}>Drop any audio — AI picks classic soundfonts (Wind of Fjords, Strategy, etc.) for old Roblox music.</div>}
            </div>
          </div>
        </div>

        <div style={{ width: 130, flexShrink: 0, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 12, background: 'rgba(0,0,0,0.25)', borderLeft: '2px solid #000' }}>
          <div style={{ background: 'rgba(0,0,0,0.55)', border: '2px solid #000', padding: 6, color: '#fff', fontSize: 10, fontWeight: 'bold', textShadow: '1px 1px 0 #000' }}>Player List<div style={{ marginTop: 4, fontWeight: 'normal' }}>You</div></div>
          <HealthBar
            value={volume}
            max={1}
            label="Volume"
            width="100%"
            height={18}
            onChange={v => {
              setVolume(v);
              if (synthRef.current && typeof synthRef.current.setMainVolume === 'function') {
                try { synthRef.current.setMainVolume(v); } catch (e) {}
              }
            }}
          />
          <HealthBar value={playbackDuration > 0 ? playbackTime : 0} max={playbackDuration > 0 ? playbackDuration : 1} label={'Time ' + (playbackDuration > 0 ? playbackTime.toFixed(1) + ' / ' + playbackDuration.toFixed(1) + 's' : '0 / 0s')} width="100%" height={18} />
          <HealthBar value={progress} max={100} label="Loading" width="100%" height={18} />
        </div>
      </div>

      <div style={{ height: 26, background: 'rgba(0,0,0,0.65)', borderTop: '2px solid #000', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', padding: '0 8px', flexShrink: 0, textShadow: '1px 1px 0 #000' }}>
        <span style={{ opacity: 0.9 }}>Any audio → classic Roblox (M.U.L.E. / Wind of Fjords). Style dropdown forces a bank. BETA.</span>
      </div>
    </div>
  );
}

export default MusicAI;
