import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Midi } from '@tonejs/midi';
import { WorkletSynthesizer } from 'spessasynth_lib';

const ROBLOX_SF2_URL =
  '/soundfonts/Instruments/WorkingR-Blox/Roblox%20Soundfont-1.sf2';
const SPESSA_PROCESSOR_URL = '/spessasynth_processor.min.js';
const API_BASE = window.RENDERER_API_BASE || 'https://winxp-7yes.onrender.com';
const MAX_SECONDS = 180;
const MAX_BYTES = 25 * 1024 * 1024;

const roles = [
  { id: 'drums', label: 'DRUMS', channel: 9, program: 0, stem: 'drums', percussion: true },
  { id: 'bass', label: 'BASS', channel: 0, program: 34, stem: 'bass' },
  { id: 'guitar', label: 'GUITAR', channel: 1, program: 30, stem: 'other' },
  { id: 'vocals', label: 'VOCALS', channel: 2, program: 86, stem: 'vocals' },
];

const buttonStyle = {
  background: '#777',
  border: '1px solid #222',
  color: '#fff',
  fontFamily: 'Tahoma, Arial, sans-serif',
  fontSize: 11,
  fontWeight: 'bold',
  padding: '4px 9px',
  cursor: 'url("/images/Link Select.cur") 3 3, pointer',
  boxShadow: 'inset 0 1px rgba(255,255,255,.35)',
};

function cleanDetectedNotes(notes, options = {}) {
  const {
    minDuration = 0.08,
    minAmplitude = 0.3,
    minPitch = 0,
    maxPitch = 127,
  } = options;
  const sorted = notes
    .filter(note =>
      Number.isFinite(note.startTimeSeconds) &&
      Number.isFinite(note.durationSeconds) &&
      Number.isFinite(note.pitchMidi) &&
      note.durationSeconds >= minDuration &&
      (note.amplitude == null || note.amplitude >= minAmplitude) &&
      note.pitchMidi >= minPitch &&
      note.pitchMidi <= maxPitch
    )
    .sort((x, y) =>
      x.startTimeSeconds - y.startTimeSeconds || x.pitchMidi - y.pitchMidi
    );
  const result = [];
  const lastByPitch = new Map();
  sorted.forEach(note => {
    const previous = lastByPitch.get(note.pitchMidi);
    if (
      previous &&
      note.startTimeSeconds <=
        previous.startTimeSeconds + previous.durationSeconds + 0.035
    ) {
      const previousEnd = previous.startTimeSeconds + previous.durationSeconds;
      const noteEnd = note.startTimeSeconds + note.durationSeconds;
      previous.durationSeconds = Math.max(previousEnd, noteEnd) - previous.startTimeSeconds;
      previous.amplitude = Math.max(previous.amplitude || 0, note.amplitude || 0);
      return;
    }
    const clean = {
      ...note,
      startTimeSeconds: Math.max(0, note.startTimeSeconds),
      durationSeconds: Math.max(minDuration, note.durationSeconds),
    };
    result.push(clean);
    lastByPitch.set(clean.pitchMidi, clean);
  });
  return result;
}

function assignRoles(detected, duration) {
  const density = detected.length / Math.max(duration, 1);
  return cleanDetectedNotes(detected, {
    minDuration: 0.075,
    minAmplitude: 0.34,
  }).map((note, index) => {
    const pitch = note.pitchMidi;
    const short = note.durationSeconds < 0.18;
    const long = note.durationSeconds > 0.65;
    let role = 'guitar';
    if (pitch < 52 && !short) role = 'bass';
    else if (short && pitch >= 38 && pitch <= 84 && density > 5) role = 'drums';
    else if (pitch >= 68 && (long || pitch >= 82)) role = 'vocals';

    if (role === 'drums') {
      return {
        ...note,
        id: index + 1,
        role,
        pitchMidi: pitch < 48 ? 36 : pitch < 62 ? 38 : pitch < 76 ? 42 : 46,
      };
    }
    return { ...note, id: index + 1, role };
  });
}

function makeMidi(notes, roleFilter) {
  const midi = new Midi();
  midi.name = 'Robloxify Arrangement';
  midi.header.setTempo(120);
  const selectedRoles = roleFilter
    ? roles.filter(role => role.id === roleFilter)
    : roles;
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
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function yieldToBrowser() {
  return new Promise(resolve => {
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      window.requestAnimationFrame(() => setTimeout(resolve, 0));
    } else {
      setTimeout(resolve, 0);
    }
  });
}

async function transcribeOnBackend(file, onStatus) {
  onStatus('UPLOADING TO SERVER...');
  const form = new FormData();
  form.append('audio', file, file.name || 'audio.wav');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000);

  try {
    onStatus('SERVER IS TRANSCRIBING (UI STAYS FREE)...');
    const res = await fetch(API_BASE + '/robloxify', {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || ('Server error ' + res.status));
    }
    if (!Array.isArray(data.notes)) {
      throw new Error('Server returned no notes');
    }
    return { notes: data.notes, duration: data.duration || 0 };
  } finally {
    clearTimeout(timeout);
  }
}

async function transcribeInWorker(file, onStatus, onProgress) {
  onStatus('PREPARING AUDIO LOCALLY...');
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
  if (duration >= MAX_SECONDS) {
    throw new Error('Audio must be under ' + MAX_SECONDS + ' seconds. Please trim it.');
  }

  onStatus('RESAMPLING...');
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

  onStatus('STARTING BACKGROUND WORKER...');
  const worker = new Worker(new URL('./robloxify.worker.js', import.meta.url));

  try {
    const result = await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (cb, value) => {
        if (settled) return;
        settled = true;
        worker.onmessage = null;
        worker.onerror = null;
        cb(value);
      };
      worker.onmessage = event => {
        const message = event.data || {};
        if (message.type === 'progress') {
          onProgress(message.value);
          onStatus('TRANSCRIBING ' + Math.round(message.value * 100) + '%');
          return;
        }
        if (message.type === 'result') return finish(resolve, message);
        if (message.type === 'error') {
          return finish(reject, new Error(message.message || 'Worker failed'));
        }
      };
      worker.onerror = error => {
        finish(reject, new Error(error.message || 'Worker could not load'));
      };
      const samples = audioBuffer.getChannelData(0).slice();
      worker.postMessage(
        { type: 'transcribe', samples, sampleRate: audioBuffer.sampleRate },
        [samples.buffer]
      );
    });
    return { notes: result.notes || [], duration };
  } finally {
    worker.terminate();
  }
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
    document.cookie =
      name + '=' + encodeURIComponent(value) + '; max-age=31536000; path=/; SameSite=Lax';
  }

  function loadProjects() {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      return value ? JSON.parse(value) : [];
    } catch (error) {
      return [];
    }
  }

  function persistProjects(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (error) {
      console.error(error);
    }
  }

  const synthRef = useRef(null);
  const contextRef = useRef(null);
  const [file, setFile] = useState(null);
  const [midiBlob, setMidiBlob] = useState(null);
  const [notes, setNotes] = useState([]);
  const [arrangement, setArrangement] = useState([]);
  const [status, setStatus] = useState('DROP AUDIO TO BEGIN');
  const [progress, setProgress] = useState(0);
  const [working, setWorking] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [projectName, setProjectName] = useState(
    () => readCookie(COOKIE_KEY) || 'Untitled Robloxify Project'
  );
  const [projects, setProjects] = useState(() => loadProjects());
  const [showProjects, setShowProjects] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [showTools, setShowTools] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const playbackStopTimerRef = useRef(null);
  const playbackRafRef = useRef(null);
  const conversionIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (playbackStopTimerRef.current) {
        window.clearTimeout(playbackStopTimerRef.current);
        playbackStopTimerRef.current = null;
      }
      if (playbackRafRef.current) {
        window.cancelAnimationFrame(playbackRafRef.current);
        playbackRafRef.current = null;
      }
      if (synthRef.current) {
        try { synthRef.current.destroy(); } catch (error) { /* cleanup */ }
        synthRef.current = null;
      }
      if (contextRef.current) {
        contextRef.current.close().catch(() => {});
        contextRef.current = null;
      }
    };
  }, []);

  const convert = async inputFile => {
    if (!inputFile || !(inputFile.type || '').startsWith('audio/')) {
      setStatus('CHOOSE AN AUDIO FILE');
      return;
    }
    if (inputFile.size > MAX_BYTES) {
      setStatus('FILE TOO LARGE (MAX 25 MB)');
      return;
    }

    const conversionId = ++conversionIdRef.current;
    if (working) {
      setStatus('ALREADY CONVERTING — PLEASE WAIT');
      return;
    }

    setFile(inputFile);
    setWorking(true);
    setProgress(0);
    setPlaybackTime(0);
    setPlaybackDuration(0);
    setStatus('STARTING...');

    try {
      let rawNotes = [];
      let duration = 0;
      let usedBackend = false;

      try {
        const result = await transcribeOnBackend(inputFile, msg => {
          if (conversionId === conversionIdRef.current) setStatus(msg);
        });
        if (conversionId !== conversionIdRef.current) return;
        rawNotes = result.notes;
        duration = result.duration || 0;
        usedBackend = true;
        setProgress(90);
      } catch (backendError) {
        console.warn('Robloxify backend unavailable, using local worker:', backendError);
        if (conversionId !== conversionIdRef.current) return;
        setStatus('SERVER BUSY — USING LOCAL WORKER...');
        setProgress(5);
        const result = await transcribeInWorker(
          inputFile,
          msg => {
            if (conversionId === conversionIdRef.current) setStatus(msg);
          },
          value => {
            if (conversionId === conversionIdRef.current) {
              setProgress(Math.round(10 + value * 80));
            }
          }
        );
        if (conversionId !== conversionIdRef.current) return;
        rawNotes = result.notes;
        duration = result.duration || 0;
      }

      setStatus('CLEANING NOTES...');
      await yieldToBrowser();

      const fitted = assignRoles(rawNotes, duration || 1);
      if (!fitted.length) {
        throw new Error('No musical notes were detected.');
      }
      fitted.sort(
        (a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi
      );

      setNotes(fitted);
      setArrangement(fitted);
      setSelectedNoteId(fitted[0] ? fitted[0].id : null);
      setMidiBlob(makeMidi(fitted));
      setProgress(100);
      setStatus(
        'DONE — ' +
          fitted.length +
          ' NOTES · 4 TRACKS' +
          (usedBackend ? ' (SERVER)' : ' (LOCAL WORKER)')
      );
    } catch (error) {
      console.error(error);
      setStatus(
        'CONVERSION FAILED — ' + (error && error.message ? error.message : 'UNKNOWN ERROR')
      );
    } finally {
      if (conversionId === conversionIdRef.current) {
        setWorking(false);
      }
    }
  };

  const saveProject = () => {
    if (!arrangement.length) {
      setStatus('CONVERT AUDIO FIRST');
      return;
    }
    const project = {
      id: Date.now(),
      name: projectName.trim() || 'Untitled Robloxify Project',
      sourceName: file ? file.name : 'Unknown audio',
      notes,
      arrangement,
      savedAt: new Date().toISOString(),
    };
    const next = [project, ...projects.filter(item => item.name !== project.name)].slice(0, 25);
    setProjects(next);
    persistProjects(next);
    writeCookie(COOKIE_KEY, project.name);
    setStatus('PROJECT SAVED');
  };

  const loadProject = project => {
    setProjectName(project.name);
    setNotes(project.notes || []);
    const loadedArrangement = (project.arrangement || []).map((note, index) => ({
      ...note,
      id: note.id || index + 1,
    }));
    setArrangement(loadedArrangement);
    setSelectedNoteId(loadedArrangement[0] ? loadedArrangement[0].id : null);
    setMidiBlob(makeMidi(loadedArrangement));
    writeCookie(COOKIE_KEY, project.name);
    setShowProjects(false);
    setStatus('PROJECT LOADED — ' + project.name);
  };

  const deleteProject = project => {
    const next = projects.filter(item => item.id !== project.id);
    setProjects(next);
    persistProjects(next);
    setStatus('PROJECT DELETED');
  };

  const updateArrangement = next => {
    setArrangement(next);
    setNotes(next);
    setMidiBlob(makeMidi(next));
  };

  const selectedNote =
    arrangement.find(note => note.id === selectedNoteId) || arrangement[0] || null;

  const editSelected = changes => {
    if (!selectedNote) return;
    const next = arrangement.map(note =>
      note.id === selectedNote.id ? { ...note, ...changes } : note
    );
    updateArrangement(next);
  };

  const removeSelected = () => {
    if (!selectedNote) return;
    const next = arrangement.filter(note => note.id !== selectedNote.id);
    updateArrangement(next);
    setSelectedNoteId(next[0] ? next[0].id : null);
    setStatus('NOTE DELETED');
  };

  const quantizeArrangement = () => {
    const next = arrangement.map(note => ({
      ...note,
      startTimeSeconds: Math.max(0, Math.round(note.startTimeSeconds * 4) / 4),
      durationSeconds: Math.max(0.05, Math.round(note.durationSeconds * 4) / 4),
    }));
    updateArrangement(next);
    setStatus('NOTES QUANTIZED');
  };

  const transposeArrangement = amount => {
    const next = arrangement.map(note => ({
      ...note,
      pitchMidi: Math.max(0, Math.min(127, note.pitchMidi + amount)),
    }));
    updateArrangement(next);
    setStatus((amount > 0 ? 'UP ' : 'DOWN ') + Math.abs(amount) + ' SEMITONES');
  };

  const insertNote = () => {
    const end = arrangement.reduce(
      (max, note) => Math.max(max, note.startTimeSeconds + note.durationSeconds),
      0
    );
    const newNote = {
      id: Date.now(),
      pitchMidi: selectedNote ? selectedNote.pitchMidi : 60,
      startTimeSeconds: end,
      durationSeconds: 0.25,
      amplitude: 0.8,
      role: selectedNote ? selectedNote.role : 'guitar',
    };
    const next = [...arrangement, newNote];
    updateArrangement(next);
    setSelectedNoteId(newNote.id);
    setStatus('NOTE INSERTED');
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
    if (playbackStopTimerRef.current) {
      window.clearTimeout(playbackStopTimerRef.current);
      playbackStopTimerRef.current = null;
    }
    if (playbackRafRef.current) {
      window.cancelAnimationFrame(playbackRafRef.current);
      playbackRafRef.current = null;
    }
    if (synthRef.current) {
      try {
        for (let ch = 0; ch < 16; ch++) synthRef.current.stopAll(ch);
      } catch (e) { /* ignore */ }
    }
    setPlaying(false);
  };

  const playArrangement = async () => {
    if (!arrangement.length) {
      setStatus('NOTHING TO PLAY');
      return;
    }
    try {
      stopPlayback();
      const synth = await ensureSynth();
      if (contextRef.current.state === 'suspended') await contextRef.current.resume();
      synth.systemReset();
      roles.forEach(role => {
        synth.programChange(role.channel, role.program);
      });
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

      setPlaybackDuration(maxEnd);
      setPlaybackTime(0);
      setPlaying(true);
      const t0 = performance.now();
      const tick = () => {
        const elapsed = (performance.now() - t0) / 1000;
        setPlaybackTime(Math.min(elapsed, maxEnd));
        if (elapsed < maxEnd) {
          playbackRafRef.current = requestAnimationFrame(tick);
        } else {
          setPlaying(false);
        }
      };
      playbackRafRef.current = requestAnimationFrame(tick);
      playbackStopTimerRef.current = window.setTimeout(() => {
        setPlaying(false);
      }, maxEnd * 1000 + 200);
      setStatus('PLAYING');
    } catch (error) {
      console.error(error);
      setStatus('PLAYBACK FAILED — ' + (error.message || 'unknown'));
      setPlaying(false);
    }
  };

  const onDrop = e => {
    e.preventDefault();
    e.stopPropagation();
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
    arrangement.forEach(n => {
      if (counts[n.role] != null) counts[n.role]++;
    });
    return counts;
  }, [arrangement]);

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        background: '#ece9d8',
        fontFamily: 'Tahoma, Arial, sans-serif',
        fontSize: 12,
        color: '#000',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
      onDragOver={e => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={onDrop}
    >
      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: '6px 8px',
          borderBottom: '1px solid #808080',
          background: 'linear-gradient(#fff, #d4d0c8)',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <label style={{ ...buttonStyle, display: 'inline-block' }}>
          OPEN AUDIO
          <input
            type="file"
            accept="audio/*"
            onChange={onFileInput}
            disabled={working}
            style={{ display: 'none' }}
          />
        </label>
        <button type="button" style={buttonStyle} disabled={working || !midiBlob} onClick={() => midiBlob && downloadBlob(midiBlob, 'robloxify.mid')}>
          SAVE MIDI
        </button>
        <button type="button" style={buttonStyle} disabled={!arrangement.length || working} onClick={playing ? stopPlayback : playArrangement}>
          {playing ? 'STOP' : 'PLAY'}
        </button>
        <button type="button" style={buttonStyle} disabled={working || !arrangement.length} onClick={saveProject}>
          SAVE PROJECT
        </button>
        <button type="button" style={buttonStyle} onClick={() => setShowProjects(v => !v)}>
          PROJECTS
        </button>
        <button type="button" style={buttonStyle} onClick={() => setShowTools(v => !v)}>
          TOOLS
        </button>
        <button type="button" style={buttonStyle} onClick={() => setShowHelp(v => !v)}>
          HELP
        </button>
        <span style={{ marginLeft: 'auto', opacity: 0.7 }}>Robloxify</span>
      </div>

      <div style={{ padding: '6px 8px', borderBottom: '1px solid #b0b0b0' }}>
        <div style={{ marginBottom: 4, fontWeight: 'bold' }}>{status}</div>
        <div
          style={{
            height: 14,
            border: '1px solid #808080',
            background: '#fff',
            boxShadow: 'inset 1px 1px 0 #808080',
          }}
        >
          <div
            style={{
              height: '100%',
              width: progress + '%',
              background: working
                ? 'linear-gradient(90deg, #08f, #0af)'
                : 'linear-gradient(90deg, #0a0, #0c0)',
              transition: 'width 0.15s linear',
            }}
          />
        </div>
        <div style={{ marginTop: 4, fontSize: 11, color: '#333' }}>
          Transcription runs on the server when possible so the rest of the desktop stays smooth.
          Max {MAX_SECONDS}s / 25&nbsp;MB. Drag & drop audio anywhere in this window.
        </div>
      </div>

      {showHelp && (
        <div style={{ padding: 8, background: '#ffffe1', borderBottom: '1px solid #808080' }}>
          Robloxify turns a song into a 4-track Roblox-style MIDI (drums / bass / guitar / vocals).
          Heavy analysis is done on the backend so your browser does not freeze. If the server is
          busy, a local Web Worker is used instead (still off the UI thread).
        </div>
      )}

      {showTools && (
        <div style={{ padding: 8, display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid #808080' }}>
          <button type="button" style={buttonStyle} disabled={!arrangement.length} onClick={quantizeArrangement}>QUANTIZE</button>
          <button type="button" style={buttonStyle} disabled={!arrangement.length} onClick={() => transposeArrangement(1)}>+1 ST</button>
          <button type="button" style={buttonStyle} disabled={!arrangement.length} onClick={() => transposeArrangement(-1)}>-1 ST</button>
          <button type="button" style={buttonStyle} disabled={!arrangement.length} onClick={insertNote}>INSERT NOTE</button>
          <button type="button" style={buttonStyle} disabled={!selectedNote} onClick={removeSelected}>DELETE NOTE</button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            VOL
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={e => setVolume(Number(e.target.value))}
            />
          </label>
        </div>
      )}

      {showProjects && (
        <div style={{ padding: 8, borderBottom: '1px solid #808080', maxHeight: 120, overflow: 'auto' }}>
          {projects.length === 0 && <div>No saved projects.</div>}
          {projects.map(p => (
            <div key={p.id} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
              <button type="button" style={buttonStyle} onClick={() => loadProject(p)}>LOAD</button>
              <button type="button" style={buttonStyle} onClick={() => deleteProject(p)}>DEL</button>
              <span>{p.name}</span>
              <span style={{ opacity: 0.6, fontSize: 11 }}>{p.sourceName}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: '6px 8px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <label>
          Project{' '}
          <input
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            style={{ width: 220, border: '1px solid #808080', padding: '2px 4px' }}
          />
        </label>
        <span style={{ fontSize: 11 }}>
          D:{roleCounts.drums} B:{roleCounts.bass} G:{roleCounts.guitar} V:{roleCounts.vocals}
        </span>
        {playbackDuration > 0 && (
          <span style={{ fontSize: 11, marginLeft: 'auto' }}>
            {playbackTime.toFixed(1)}s / {playbackDuration.toFixed(1)}s
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {selectedNote && (
          <div style={{ marginBottom: 8, padding: 6, border: '1px solid #808080', background: '#fff' }}>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Selected note #{selectedNote.id}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label>
                Pitch{' '}
                <input
                  type="number"
                  min={0}
                  max={127}
                  value={selectedNote.pitchMidi}
                  onChange={e => editSelected({ pitchMidi: Number(e.target.value) })}
                  style={{ width: 56 }}
                />
              </label>
              <label>
                Start{' '}
                <input
                  type="number"
                  step={0.01}
                  min={0}
                  value={Number(selectedNote.startTimeSeconds.toFixed(3))}
                  onChange={e => editSelected({ startTimeSeconds: Number(e.target.value) })}
                  style={{ width: 72 }}
                />
              </label>
              <label>
                Dur{' '}
                <input
                  type="number"
                  step={0.01}
                  min={0.05}
                  value={Number(selectedNote.durationSeconds.toFixed(3))}
                  onChange={e => editSelected({ durationSeconds: Number(e.target.value) })}
                  style={{ width: 72 }}
                />
              </label>
              <label>
                Role{' '}
                <select
                  value={selectedNote.role}
                  onChange={e => editSelected({ role: e.target.value })}
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}

        <div style={{ border: '1px solid #808080', background: '#fff', minHeight: 120 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#d4d0c8' }}>
                <th style={{ textAlign: 'left', padding: 4 }}>#</th>
                <th style={{ textAlign: 'left', padding: 4 }}>Role</th>
                <th style={{ textAlign: 'left', padding: 4 }}>Pitch</th>
                <th style={{ textAlign: 'left', padding: 4 }}>Start</th>
                <th style={{ textAlign: 'left', padding: 4 }}>Dur</th>
              </tr>
            </thead>
            <tbody>
              {arrangement.slice(0, 200).map(note => (
                <tr
                  key={note.id}
                  onClick={() => setSelectedNoteId(note.id)}
                  style={{
                    background: note.id === selectedNoteId ? '#316ac5' : 'transparent',
                    color: note.id === selectedNoteId ? '#fff' : '#000',
                    cursor: 'url("/images/Link Select.cur") 3 3, pointer',
                  }}
                >
                  <td style={{ padding: 4 }}>{note.id}</td>
                  <td style={{ padding: 4 }}>{note.role}</td>
                  <td style={{ padding: 4 }}>{note.pitchMidi}</td>
                  <td style={{ padding: 4 }}>{note.startTimeSeconds.toFixed(2)}</td>
                  <td style={{ padding: 4 }}>{note.durationSeconds.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {arrangement.length > 200 && (
            <div style={{ padding: 6, opacity: 0.7 }}>Showing first 200 of {arrangement.length} notes</div>
          )}
          {!arrangement.length && (
            <div style={{ padding: 16, opacity: 0.7 }}>No notes yet — open or drop an audio file.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MusicAI;
