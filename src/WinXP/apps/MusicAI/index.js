import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Midi } from '@tonejs/midi';
import { WorkletSynthesizer } from 'spessasynth_lib';

const ROBLOX_SF2_URL =
  '/soundfonts/Instruments/WorkingR-Blox/Roblox%20Soundfont-1.sf2';
const SPESSA_PROCESSOR_URL = '/spessasynth_processor.min.js';
const API_BASE = window.RENDERER_API_BASE || 'https://winxp-7yes.onrender.com';
const MAX_SECONDS = 600;
const MAX_BYTES = 50 * 1024 * 1024;
const MODEL_URL = '/basic-pitch-model/model.json';
const SKY_URL = '/images/sky.png';

const roles = [
  { id: 'drums', label: 'DRUMS', channel: 9, program: 0, stem: 'drums', percussion: true },
  { id: 'bass', label: 'BASS', channel: 0, program: 34, stem: 'bass' },
  { id: 'guitar', label: 'GUITAR', channel: 1, program: 30, stem: 'other' },
  { id: 'vocals', label: 'VOCALS', channel: 2, program: 86, stem: 'vocals' },
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

const btnGray = {
  ...btn,
  background: '#e0e0e0',
  boxShadow: 'inset 1px 1px 0 #fff, inset -1px -1px 0 #999',
};

function HealthBar({ value, max = 1, label, width = 120, height = 14 }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: typeof width === 'number' ? width : undefined, width: typeof width === 'string' ? width : undefined }}>
      {label && (
        <div style={{ fontFamily: rbx.font, fontSize: 10, fontWeight: 'bold', color: '#fff', textShadow: '1px 1px 0 #000' }}>
          {label}
        </div>
      )}
      <div style={{ width: '100%', height, background: rbx.healthBg, border: '2px solid #000', boxShadow: 'inset 1px 1px 0 #444', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct + '%', background: 'linear-gradient(180deg, #66ff66 0%, #00b400 45%, #008000 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)', transition: 'width 0.12s linear' }} />
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

function makeMidi(notes, roleFilter) {
  const midi = new Midi();
  midi.name = 'Robloxify Arrangement';
  midi.header.setTempo(120);
  const selectedRoles = roleFilter ? roles.filter(role => role.id === roleFilter) : roles;
  selectedRoles.forEach(role => {
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
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
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
  const frames = [];
  const onsets = [];
  const contours = [];
  let lastProgress = -1;
  let lastYield = performance.now();
  await basicPitch.evaluateModel(
    audioBuffer,
    (frameBatch, onsetBatch, contourBatch) => {
      frames.push(...frameBatch);
      onsets.push(...onsetBatch);
      contours.push(...contourBatch);
    },
    async value => {
      const progress = Math.max(0, Math.min(1, value));
      if (progress - lastProgress >= 0.02 || progress >= 1) {
        lastProgress = progress;
        onProgress(progress);
        onStatus('Transcribing ' + Math.round(progress * 100) + '%');
      }
      if (performance.now() - lastYield > 80) {
        lastYield = performance.now();
        await yieldToBrowser();
      }
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
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      return value ? JSON.parse(value) : [];
    } catch (e) { return []; }
  }
  function persistProjects(value) {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch (e) { console.error(e); }
  }

  const synthRef = useRef(null);
  const contextRef = useRef(null);
  const [file, setFile] = useState(null);
  const [midiBlob, setMidiBlob] = useState(null);
  const [notes, setNotes] = useState([]);
  const [arrangement, setArrangement] = useState([]);
  const [status, setStatus] = useState('Drop audio or click Open to begin');
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
  const playbackStopTimerRef = useRef(null);
  const playbackRafRef = useRef(null);
  const conversionIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (playbackStopTimerRef.current) window.clearTimeout(playbackStopTimerRef.current);
      if (playbackRafRef.current) window.cancelAnimationFrame(playbackRafRef.current);
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
      setStatus('Cleaning notes...'); await yieldToBrowser();
      const fitted = assignRoles(rawNotes, duration || 1);
      if (!fitted.length) throw new Error('No musical notes were detected.');
      fitted.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi);
      setNotes(fitted); setArrangement(fitted); setSelectedNoteId(fitted[0] ? fitted[0].id : null);
      setMidiBlob(makeMidi(fitted)); setProgress(100);
      setStatus('Done — ' + fitted.length + ' notes · 4 tracks' + (usedBackend ? ' (server)' : ' (local)'));
    } catch (error) {
      console.error(error);
      setStatus('Failed — ' + (error && error.message ? error.message : 'unknown error'));
    } finally {
      if (conversionId === conversionIdRef.current) setWorking(false);
    }
  };

  const saveProject = () => {
    if (!arrangement.length) { setStatus('Convert audio first'); return; }
    const project = { id: Date.now(), name: projectName.trim() || 'Untitled Place', sourceName: file ? file.name : 'Unknown audio', notes, arrangement, savedAt: new Date().toISOString() };
    const next = [project, ...projects.filter(item => item.name !== project.name)].slice(0, 25);
    setProjects(next); persistProjects(next); writeCookie(COOKIE_KEY, project.name); setStatus('Project saved');
  };

  const loadProject = project => {
    setProjectName(project.name); setNotes(project.notes || []);
    const loaded = (project.arrangement || []).map((note, index) => ({ ...note, id: note.id || index + 1 }));
    setArrangement(loaded); setSelectedNoteId(loaded[0] ? loaded[0].id : null);
    setMidiBlob(makeMidi(loaded)); writeCookie(COOKIE_KEY, project.name); setShowProjects(false); setStatus('Loaded — ' + project.name);
  };

  const deleteProject = project => {
    const next = projects.filter(item => item.id !== project.id);
    setProjects(next); persistProjects(next); setStatus('Project deleted');
  };

  const updateArrangement = next => { setArrangement(next); setNotes(next); setMidiBlob(makeMidi(next)); };
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
  const quantizeArrangement = () => {
    updateArrangement(arrangement.map(note => ({
      ...note,
      startTimeSeconds: Math.max(0, Math.round(note.startTimeSeconds * 4) / 4),
      durationSeconds: Math.max(0.05, Math.round(note.durationSeconds * 4) / 4),
    })));
    setStatus('Notes quantized');
  };
  const transposeArrangement = amount => {
    updateArrangement(arrangement.map(note => ({ ...note, pitchMidi: Math.max(0, Math.min(127, note.pitchMidi + amount)) })));
    setStatus((amount > 0 ? 'Up ' : 'Down ') + Math.abs(amount) + ' semitones');
  };
  const insertNote = () => {
    const end = arrangement.reduce((max, note) => Math.max(max, note.startTimeSeconds + note.durationSeconds), 0);
    const newNote = { id: Date.now(), pitchMidi: selectedNote ? selectedNote.pitchMidi : 60, startTimeSeconds: end, durationSeconds: 0.25, amplitude: 0.8, role: selectedNote ? selectedNote.role : 'guitar' };
    updateArrangement([...arrangement, newNote]); setSelectedNoteId(newNote.id); setStatus('Note inserted');
  };

  const ensureSynth = async () => {
    if (synthRef.current && contextRef.current) return synthRef.current;
    const context = new AudioContext();
    contextRef.current = context;
    const synth = new WorkletSynthesizer(context);
    await context.audioWorklet.addModule(SPESSA_PROCESSOR_URL);
    await synth.addNewDefaultChannelGroup();
    const sf2 = await fetch(ROBLOX_SF2_URL).then(r => r.arrayBuffer());
    await synth.soundBankManager.addSoundBank(sf2, 'roblox');
    synth.connect(context.destination);
    synthRef.current = synth;
    return synth;
  };

  const stopPlayback = () => {
    if (playbackStopTimerRef.current) { window.clearTimeout(playbackStopTimerRef.current); playbackStopTimerRef.current = null; }
    if (playbackRafRef.current) { window.cancelAnimationFrame(playbackRafRef.current); playbackRafRef.current = null; }
    if (synthRef.current) { try { for (let ch = 0; ch < 16; ch++) synthRef.current.stopAll(ch); } catch (e) {} }
    setPlaying(false);
  };

  const playArrangement = async () => {
    if (!arrangement.length) { setStatus('Nothing to play'); return; }
    try {
      stopPlayback();
      const synth = await ensureSynth();
      if (contextRef.current.state === 'suspended') await contextRef.current.resume();
      synth.systemReset();
      roles.forEach(role => { synth.programChange(role.channel, role.program); });
      synth.setMainVolume(volume);
      const startAt = contextRef.current.currentTime + 0.05;
      let maxEnd = 0;
      arrangement.forEach(note => {
        const role = roles.find(r => r.id === note.role) || roles[2];
        const t = startAt + note.startTimeSeconds;
        const dur = Math.max(0.05, note.durationSeconds);
        maxEnd = Math.max(maxEnd, note.startTimeSeconds + dur);
        const vel = Math.max(1, Math.min(127, Math.round((note.amplitude || 0.8) * 127)));
        synth.noteOn(role.channel, note.pitchMidi, vel, t);
        synth.noteOff(role.channel, note.pitchMidi, t + dur);
      });
      setPlaybackDuration(maxEnd); setPlaybackTime(0); setPlaying(true);
      const t0 = performance.now();
      const tick = () => {
        const elapsed = (performance.now() - t0) / 1000;
        setPlaybackTime(Math.min(elapsed, maxEnd));
        if (elapsed < maxEnd) playbackRafRef.current = requestAnimationFrame(tick);
        else setPlaying(false);
      };
      playbackRafRef.current = requestAnimationFrame(tick);
      playbackStopTimerRef.current = window.setTimeout(() => setPlaying(false), maxEnd * 1000 + 200);
      setStatus('Playing');
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
      style={{
        height: '100%', width: '100%', fontFamily: rbx.font, fontSize: 12, color: rbx.text,
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden', position: 'relative',
        background: '#87ceeb url(' + SKY_URL + ') center / cover no-repeat',
      }}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={onDrop}
    >
      <div style={{ height: 28, background: 'linear-gradient(180deg, #9ec4e8 0%, #6e99c9 100%)', borderBottom: '2px solid #000', display: 'flex', alignItems: 'center', padding: '0 6px', gap: 6, flexShrink: 0, zIndex: 2 }}>
        <span style={{ fontWeight: 'bold', fontSize: 13, color: '#fff', textShadow: '1px 1px 0 #000', marginRight: 8 }}>
          ROBLOX<span style={{ color: rbx.yellow }}>ify</span>
        </span>
        <label style={{ ...btn, display: 'inline-block', margin: 0 }}>
          Open
          <input type="file" accept="audio/*" onChange={onFileInput} disabled={working} style={{ display: 'none' }} />
        </label>
        <button type="button" style={btn} disabled={working || !midiBlob} onClick={() => midiBlob && downloadBlob(midiBlob, 'robloxify.mid')}>Save MIDI</button>
        <button type="button" style={btn} disabled={!arrangement.length || working} onClick={playing ? stopPlayback : playArrangement}>{playing ? 'Stop' : 'Play'}</button>
        <button type="button" style={btnGray} disabled={working || !arrangement.length} onClick={saveProject}>Save</button>
        <button type="button" style={btnGray} onClick={() => setShowProjects(v => !v)}>Places</button>
        <button type="button" style={btnGray} onClick={() => setShowTools(v => !v)}>Tools</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: '#fff', textShadow: '1px 1px 0 #000' }}>{projectName}</span>
          <div style={{ ...btnGray, padding: '2px 8px', fontSize: 10 }}>Menu</div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        <div style={{ width: 44, background: 'rgba(0,0,0,0.35)', borderRight: '2px solid #000', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 0', gap: 6, flexShrink: 0 }}>
          {['1', '2'].map(n => (
            <div key={n} style={{ width: 28, height: 28, background: '#ddd', border: '2px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 12 }}>{n}</div>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div style={{ ...panel, padding: 8 }}>
            <div style={{ background: rbx.blue, color: '#fff', fontWeight: 'bold', fontSize: 11, padding: '2px 6px', margin: '-8px -8px 8px', borderBottom: '2px solid #000', textShadow: '1px 1px 0 #000' }}>Status</div>
            <div style={{ fontSize: 11, marginBottom: 6, minHeight: 16 }}>{status}</div>
            <HealthBar value={progress} max={100} label="Loading" width="100%" height={16} />
            <div style={{ marginTop: 6, fontSize: 10, color: '#333' }}>Max 10 minutes / 50 MB · server or local</div>
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
            <label style={{ fontSize: 11 }}>
              Place{' '}
              <input value={projectName} onChange={e => setProjectName(e.target.value)} style={{ width: 160, border: '2px solid #000', padding: '2px 4px', fontFamily: rbx.font, fontSize: 11 }} />
            </label>
            <span style={{ fontSize: 11 }}>
              <b>D</b>:{roleCounts.drums} <b>B</b>:{roleCounts.bass} <b>G</b>:{roleCounts.guitar} <b>V</b>:{roleCounts.vocals}
            </span>
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
                <thead>
                  <tr style={{ background: '#c5d8ec' }}>
                    <th style={{ textAlign: 'left', padding: '3px 6px', borderBottom: '1px solid #000' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '3px 6px', borderBottom: '1px solid #000' }}>Role</th>
                    <th style={{ textAlign: 'left', padding: '3px 6px', borderBottom: '1px solid #000' }}>Pitch</th>
                    <th style={{ textAlign: 'left', padding: '3px 6px', borderBottom: '1px solid #000' }}>Start</th>
                    <th style={{ textAlign: 'left', padding: '3px 6px', borderBottom: '1px solid #000' }}>Dur</th>
                  </tr>
                </thead>
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
              {!arrangement.length && <div style={{ padding: 16, color: '#555', fontSize: 11 }}>No notes yet — open or drop an audio file.</div>}
            </div>
          </div>
        </div>

        <div style={{ width: 130, flexShrink: 0, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch', background: 'rgba(0,0,0,0.25)', borderLeft: '2px solid #000' }}>
          <div style={{ background: 'rgba(0,0,0,0.55)', border: '2px solid #000', padding: 6, color: '#fff', fontSize: 10, fontWeight: 'bold', textShadow: '1px 1px 0 #000' }}>
            Player List
            <div style={{ marginTop: 4, fontWeight: 'normal' }}>You</div>
          </div>
          <HealthBar value={volume} max={1} label="Health (Volume)" width="100%" height={18} />
          <input type="range" min={0} max={1} step={0.05} value={volume} onChange={e => setVolume(Number(e.target.value))} style={{ width: '100%' }} title="Volume" />
          <HealthBar
            value={playbackDuration > 0 ? playbackTime : 0}
            max={playbackDuration > 0 ? playbackDuration : 1}
            label={'Time ' + (playbackDuration > 0 ? playbackTime.toFixed(1) + ' / ' + playbackDuration.toFixed(1) + 's' : '0 / 0s')}
            width="100%"
            height={18}
          />
          <HealthBar value={progress} max={100} label="Loading" width="100%" height={18} />
        </div>
      </div>

      <div style={{ height: 26, background: 'rgba(0,0,0,0.65)', borderTop: '2px solid #000', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', padding: '0 8px', flexShrink: 0, textShadow: '1px 1px 0 #000' }}>
        <span style={{ opacity: 0.9 }}>To convert, drop audio here or press Open. This game is on BETA, so a lot of stuff may not be working.</span>
      </div>
    </div>
  );
}

export default MusicAI;
