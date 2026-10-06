import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import {
  BasicPitch,
  addPitchBendsToNoteEvents,
  noteFramesToTime,
  outputToNotesPoly,
} from '@spotify/basic-pitch';
import { Midi } from '@tonejs/midi';
import { WorkletSynthesizer } from 'spessasynth_lib';
import * as ort from 'onnxruntime-web';
import { DemucsProcessor } from 'demucs-web';

const ROBLOX_SF2_URL =
  '/soundfonts/Instruments/WorkingR-Blox/Roblox%20Soundfont-1.sf2';
const BASIC_PITCH_MODEL_URL = '/basic-pitch-model/model.json';
const SPESSA_PROCESSOR_URL = '/spessasynth_processor.min.js';
const DEMUCS_MODEL_URL = 'https://huggingface.co/timcsy/demucs-web-onnx/resolve/main/htdemucs_embedded.onnx';

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
  cursor: 'pointer',
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
      note.amplitude >= minAmplitude &&
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
      const previousEnd =
        previous.startTimeSeconds + previous.durationSeconds;
      const noteEnd = note.startTimeSeconds + note.durationSeconds;
      previous.durationSeconds = Math.max(previousEnd, noteEnd) - previous.startTimeSeconds;
      previous.amplitude = Math.max(previous.amplitude, note.amplitude);
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

function MusicAI({ onClose }) {
  const STORAGE_KEY = 'robloxify-projects-v1';
  const COOKIE_KEY = 'robloxify-last-project';

  function readCookie(name) {
    const prefix = name + '=';
    const item = document.cookie.split('; ').find(value => value.indexOf(prefix) === 0);
    return item ? decodeURIComponent(item.slice(prefix.length)) : '';
  }

  function writeCookie(name, value) {
    document.cookie = name + '=' + encodeURIComponent(value) +
      '; max-age=31536000; path=/; SameSite=Lax';
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
  const basicPitchRef = useRef(null);
  const demucsRef = useRef(null);
  const [file, setFile] = useState(null);
  const [midiBlob, setMidiBlob] = useState(null);
  const [notes, setNotes] = useState([]);
  const [arrangement, setArrangement] = useState([]);
  const [status, setStatus] = useState('DROP AUDIO TO BEGIN');
  const [progress, setProgress] = useState(0);
  const [inputSampleRate, setInputSampleRate] = useState(null);
  const [working, setWorking] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [projectName, setProjectName] = useState(() => readCookie(COOKIE_KEY) || 'Untitled Robloxify Project');
  const [projects, setProjects] = useState(() => loadProjects());
  const [showProjects, setShowProjects] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [showTools, setShowTools] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const playbackTimerRef = useRef(null);
  const playbackStopTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (playbackTimerRef.current) {
        window.clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
      if (playbackStopTimerRef.current) {
        window.clearTimeout(playbackStopTimerRef.current);
        playbackStopTimerRef.current = null;
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

  const getBasicPitch = async () => {
    if (basicPitchRef.current) return basicPitchRef.current;
    setStatus('LOADING NOTE MODEL...');
    await tf.setBackend('cpu');
    await tf.ready();
    const model = await tf.loadGraphModel(BASIC_PITCH_MODEL_URL);
    basicPitchRef.current = new BasicPitch(model);
    return basicPitchRef.current;
  };

  const getDemucs = async () => {
    if (demucsRef.current) return demucsRef.current;
    setStatus('LOADING STEM MODEL...');

    if (ort.env.wasm) {
      ort.env.wasm.numThreads = window.crossOriginIsolated
        ? Math.max(1, Math.min(4, navigator.hardwareConcurrency || 4))
        : 1;
    }

    const createProcessor = providers => new DemucsProcessor({
      ort,
      sessionOptions: {
        executionProviders: providers,
        graphOptimizationLevel: 'basic',
      },
      onDownloadProgress: (loaded, total) => {
        if (total) {
          setProgress(Math.round((loaded / total) * 18));
          setStatus('LOADING STEM MODEL ' + Math.round((loaded / total) * 100) + '%');
        }
      },
    });

    try {
      const processor = createProcessor(['webgpu', 'wasm']);
      await processor.loadModel(DEMUCS_MODEL_URL);
      demucsRef.current = processor;
      return processor;
    } catch (webgpuError) {
      console.warn('WebGPU stem processing failed; retrying with WASM.', webgpuError);
      const processor = createProcessor(['wasm']);
      await processor.loadModel(DEMUCS_MODEL_URL);
      demucsRef.current = processor;
      return processor;
    }
  };

  const resampleStemToMono = async stem => {
    const sourceRate = 44100;
    const targetRate = 22050;
    const frameCount = Math.max(stem.left.length, stem.right.length);
    const sourceContext = new OfflineAudioContext(2, frameCount, sourceRate);
    const sourceBuffer = sourceContext.createBuffer(2, frameCount, sourceRate);
    sourceBuffer.copyToChannel(stem.left, 0);
    sourceBuffer.copyToChannel(stem.right, 1);

    const targetLength = Math.ceil((frameCount / sourceRate) * targetRate);
    const targetContext = new OfflineAudioContext(1, targetLength, targetRate);
    const source = targetContext.createBufferSource();
    source.buffer = sourceBuffer;
    source.connect(targetContext.destination);
    source.start(0);
    return targetContext.startRendering();
  };

  const transcribeStem = async (stem, role, index, total) => {
    const basicPitch = await getBasicPitch();
    const audioBuffer = await resampleStemToMono(stem);
    const frames = [];
    const onsets = [];
    const contours = [];

    await basicPitch.evaluateModel(
      audioBuffer,
      (frameBatch, onsetBatch, contourBatch) => {
        frames.push(...frameBatch);
        onsets.push(...onsetBatch);
        contours.push(...contourBatch);
      },
      value => {
        const base = 20 + (index / total) * 65;
        const span = 65 / total;
        setProgress(Math.round(base + value * span));
        setStatus('TRANSCRIBING ' + role.label + ' ' + Math.round(value * 100) + '%');
      }
    );

    const settings = {
      drums: { onset: 0.62, frame: 0.38, minFreq: 35, maxFreq: 1200, minDuration: 0.045, minAmplitude: 0.3 },
      bass: { onset: 0.55, frame: 0.34, minFreq: 30, maxFreq: 280, minDuration: 0.09, minAmplitude: 0.28 },
      guitar: { onset: 0.55, frame: 0.34, minFreq: 65, maxFreq: 1800, minDuration: 0.07, minAmplitude: 0.3 },
      vocals: { onset: 0.58, frame: 0.36, minFreq: 70, maxFreq: 1400, minDuration: 0.11, minAmplitude: 0.32 },
    }[role.id];

    const detected = noteFramesToTime(
      outputToNotesPoly(
        frames,
        onsets,
        settings.onset,
        settings.frame,
        7,
        true,
        settings.maxFreq,
        settings.minFreq,
        true,
        9
      )
    );

    let cleaned = cleanDetectedNotes(detected, settings);

    if (role.id === 'drums') {
      cleaned = cleaned.map(note => ({
        ...note,
        pitchMidi:
          note.pitchMidi < 48 ? 36 :
          note.pitchMidi < 62 ? 38 :
          note.pitchMidi < 76 ? 42 : 46,
      }));
    }

    return cleaned.map(note => ({ ...note, role: role.id }));
  };

  const convert = async inputFile => {
    if (!inputFile || !inputFile.type.startsWith('audio/')) {
      setStatus('CHOOSE AN AUDIO FILE');
      return;
    }

    setFile(inputFile);
    setWorking(true);
    setProgress(0);
    setStatus('PREPARING AUDIO...');

    try {
      const bytes = await inputFile.arrayBuffer();
      const decodeContext = new AudioContext();
      const sourceBuffer = await decodeContext.decodeAudioData(bytes);
      setInputSampleRate(sourceBuffer.sampleRate);
      await decodeContext.close();

      // Demucs works on 44.1 kHz stereo and separates the mix before transcription.
      const targetRate = 44100;
      const targetLength = Math.ceil(sourceBuffer.duration * targetRate);
      const offlineContext = new OfflineAudioContext(2, targetLength, targetRate);
      const source = offlineContext.createBufferSource();
      source.buffer = sourceBuffer;
      source.connect(offlineContext.destination);
      source.start(0);
      const stereoBuffer = await offlineContext.startRendering();

      const demucs = await getDemucs();
      setStatus('SEPARATING DRUMS / BASS / GUITAR / VOCALS...');

      const separation = await demucs.separate(
        stereoBuffer.getChannelData(0),
        stereoBuffer.getChannelData(stereoBuffer.numberOfChannels > 1 ? 1 : 0)
      );

      const stemOrder = [
        { id: 'drums', label: 'DRUMS', data: separation.drums },
        { id: 'bass', label: 'BASS', data: separation.bass },
        { id: 'guitar', label: 'GUITAR', data: separation.other },
        { id: 'vocals', label: 'VOCALS', data: separation.vocals },
      ];

      const allNotes = [];

      for (let index = 0; index < stemOrder.length; index++) {
        const stem = stemOrder[index];
        setStatus('READING ' + stem.label + ' STEM...');
        const role = roles.find(item => item.id === stem.id);
        const stemNotes = await transcribeStem(
          stem.data,
          role,
          index,
          stemOrder.length
        );
        allNotes.push(...stemNotes);
      }

      if (!allNotes.length) {
        throw new Error('No musical notes were detected.');
      }

      allNotes.sort((x, y) =>
        x.startTimeSeconds - y.startTimeSeconds ||
        x.pitchMidi - y.pitchMidi
      );

      const fitted = allNotes.map((note, index) => ({
        ...note,
        id: index + 1,
      }));

      setNotes(fitted);
      setArrangement(fitted);
      setSelectedNoteId(fitted[0] ? fitted[0].id : null);
      setMidiBlob(makeMidi(fitted));
      setProgress(100);
      setStatus('DONE — ' + fitted.length + ' NOTES · 4 TRACKS READY');
    } catch (error) {
      console.error(error);
      setStatus(
        'CONVERSION FAILED — ' +
        (error && error.message ? error.message : 'UNKNOWN ERROR')
      );
    } finally {
      setWorking(false);
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

  const downloadStemMidi = roleId => {
    if (!arrangement.length) return;
    const role = roles.find(item => item.id === roleId);
    if (!role) return;
    const blob = makeMidi(arrangement, roleId);
    const base = file
      ? file.name.replace(/\\.[^.]+$/, '')
      : 'robloxify';
    downloadBlob(blob, base + '-' + role.id + '.mid');
  };

  const transposeArrangement = amount => {
    const next = arrangement.map(note => ({
      ...note,
      pitchMidi: Math.max(0, Math.min(127, note.pitchMidi + amount)),
    }));
    updateArrangement(next);
    setStatus((amount > 0 ? 'UP ' : 'DOWN ') + Math.abs(amount) + ' SEMITONES');
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      setIsFullscreen(value => !value);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

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

  const formatTime = seconds => {
    const safe = Math.max(0, Math.floor(seconds || 0));
    const minutes = Math.floor(safe / 60);
    const secs = safe % 60;
    return minutes + ':' + String(secs).padStart(2, '0');
  };

  const setBarFromPointer = (event, setter) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const value = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    setter(value);
  };

  const stopPlayback = () => {
    if (playbackTimerRef.current) {
      window.clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    if (playbackStopTimerRef.current) {
      window.clearTimeout(playbackStopTimerRef.current);
      playbackStopTimerRef.current = null;
    }
    if (synthRef.current) {
      try { synthRef.current.destroy(); } catch (error) { /* cleanup */ }
      synthRef.current = null;
    }
    if (contextRef.current) {
      contextRef.current.close().catch(() => {});
      contextRef.current = null;
    }
    setPlaying(false);
    setPlaybackTime(0);
    setStatus('PLAYBACK STOPPED');
  };

  const playArrangement = async () => {
    if (!arrangement.length) {
      setStatus('CONVERT AUDIO FIRST');
      return;
    }

    setWorking(true);
    setPlaying(false);
    setStatus('LOADING ROBLOX SOUNDFONT...');

    try {
      if (synthRef.current) {
        try { synthRef.current.destroy(); } catch (error) { /* cleanup */ }
        synthRef.current = null;
      }
      if (contextRef.current) {
        await contextRef.current.close();
      }

      const context = new AudioContext();
      contextRef.current = context;

      await context.audioWorklet.addModule(SPESSA_PROCESSOR_URL);

      const synth = new WorkletSynthesizer(context);
      synthRef.current = synth;

      const soundfontResponse = await fetch(ROBLOX_SF2_URL);
      if (!soundfontResponse.ok) {
        throw new Error('Roblox SoundFont could not be loaded.');
      }

      const soundfont = await soundfontResponse.arrayBuffer();
      await synth.soundBankManager.addSoundBank(soundfont, 'roblox');
      await synth.isReady;
      await context.resume();

      roles.forEach(role => {
        synth.programChange(role.channel, role.program);
      });

      const startTime = context.currentTime + 0.15;

      arrangement.forEach(note => {
        const role = roles.find(item => item.id === note.role) || roles[1];
        const velocity = Math.max(
          1,
          Math.min(127, Math.round((note.amplitude || 0.8) * 127 * volume))
        );

        const onTime = startTime + note.startTimeSeconds;
        const offTime =
          onTime + Math.max(0.04, note.durationSeconds);

        synth.noteOn(role.channel, note.pitchMidi, velocity, onTime);
        synth.noteOff(role.channel, note.pitchMidi, offTime);
      });

      const duration = arrangement.reduce(
        (max, note) =>
          Math.max(max, note.startTimeSeconds + note.durationSeconds),
        0
      );

      setPlaybackDuration(duration);
      setPlaybackTime(0);
      setPlaying(true);
      setStatus('PLAYING WITH ROBLOX SOUNDFONT');

      const playbackStartedAt = performance.now();
      playbackTimerRef.current = window.setInterval(() => {
        const elapsed = Math.min(duration, (performance.now() - playbackStartedAt) / 1000);
        setPlaybackTime(elapsed);
      }, 50);

      playbackStopTimerRef.current = window.setTimeout(() => {
        if (playbackTimerRef.current) {
          window.clearInterval(playbackTimerRef.current);
          playbackTimerRef.current = null;
        }
        setPlaybackTime(duration);
        setPlaying(false);
        setStatus('PLAYBACK FINISHED');
      }, Math.ceil((duration + 0.7) * 1000));
    } catch (error) {
      console.error(error);
      setStatus(
        'SOUNDFONT PLAYBACK FAILED — ' +
          (error && error.message ? error.message : 'UNKNOWN ERROR')
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        background: '#1b1b1b',
        color: '#fff',
        fontFamily: 'Tahoma, Arial, sans-serif',
        fontSize: 11,
        boxSizing: 'border-box',
        position: 'relative',
        textShadow: '1px 1px #333',
      }}
    >
      <div style={{
        position: 'absolute',
        inset: 0,
        background: "url('/images/bliss.png') center / cover no-repeat",
        opacity: 0.18,
      }} />

      <div style={{
        position: 'relative',
        zIndex: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Classic Roblox-style top HUD with real app controls */}
        <div style={{
          height: 25,
          flex: '0 0 25px',
          display: 'flex',
          alignItems: 'stretch',
          background: 'rgba(185,185,185,.58)',
          borderBottom: '1px solid rgba(40,40,40,.75)',
          boxShadow: '0 1px 3px rgba(0,0,0,.45)',
        }}>
          <div style={{
            width: 25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(220,220,220,.68)',
            color: '#c40000',
            fontSize: 15,
            fontWeight: 'bold',
            textShadow: '1px 1px #fff',
          }}>R</div>

          <button type="button" onClick={() => setShowTools(value => !value)} style={{
            border: 0,
            borderRight: '1px solid rgba(80,80,80,.25)',
            background: showTools ? 'rgba(255,255,255,.38)' : 'rgba(210,210,210,.22)',
            color: '#fff',
            padding: '0 14px',
            fontFamily: 'Tahoma, Arial, sans-serif',
            fontSize: 10,
            cursor: 'pointer',
            textShadow: '1px 1px #555',
          }}>Tools</button>

          <button type="button" onClick={insertNote} disabled={working} style={{
            border: 0,
            borderRight: '1px solid rgba(80,80,80,.25)',
            background: 'rgba(210,210,210,.22)',
            color: '#fff',
            padding: '0 14px',
            fontFamily: 'Tahoma, Arial, sans-serif',
            fontSize: 10,
            cursor: working ? 'default' : 'pointer',
            textShadow: '1px 1px #555',
            opacity: working ? .6 : 1,
          }}>Insert</button>

          <button type="button" onClick={toggleFullscreen} style={{
            border: 0,
            borderRight: '1px solid rgba(80,80,80,.25)',
            background: isFullscreen ? 'rgba(255,255,255,.38)' : 'rgba(210,210,210,.22)',
            color: '#fff',
            padding: '0 14px',
            fontFamily: 'Tahoma, Arial, sans-serif',
            fontSize: 10,
            cursor: 'pointer',
            textShadow: '1px 1px #555',
          }}>{isFullscreen ? '× Window' : 'Fullscreen'}</button>

          <button type="button" onClick={() => setShowHelp(value => !value)} style={{
            border: 0,
            borderRight: '1px solid rgba(80,80,80,.25)',
            background: showHelp ? 'rgba(255,255,255,.38)' : 'rgba(210,210,210,.22)',
            color: '#fff',
            padding: '0 14px',
            fontFamily: 'Tahoma, Arial, sans-serif',
            fontSize: 10,
            cursor: 'pointer',
            textShadow: '1px 1px #555',
          }}>Help...</button>

          <div style={{ flex: 1 }} />

          <button type="button" onClick={onClose} style={{
            border: 0,
            background: 'rgba(180,180,180,.34)',
            color: '#fff',
            padding: '0 17px',
            fontFamily: 'Tahoma, Arial, sans-serif',
            fontSize: 10,
            cursor: 'pointer',
            textShadow: '1px 1px #555',
          }}>Exit</button>
        </div>

        <div style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
        }}>
          {/* Classic chat panel */}
          <div style={{
            position: 'absolute',
            left: 10,
            top: 8,
            width: 190,
            maxHeight: 90,
            overflow: 'hidden',
            background: 'rgba(80,80,80,.38)',
            border: '1px solid rgba(255,255,255,.18)',
            padding: 5,
            boxSizing: 'border-box',
            textAlign: 'left',
          }}>
            <div style={{ color: '#ddd' }}>ROBLOXIFY CHAT</div>
            <div style={{ color: '#ffea00' }}>System: Audio ready.</div>
            <div style={{ color: '#fff' }}>{status}</div>
          </div>

          {/* Player list / track list */}
          <div style={{
            position: 'absolute',
            right: 10,
            top: 8,
            width: 145,
            background: 'rgba(170,170,170,.48)',
            border: '1px solid rgba(255,255,255,.2)',
            padding: 6,
            boxSizing: 'border-box',
            textAlign: 'left',
          }}>
            <div style={{ color: '#fff', marginBottom: 4 }}>TRACKS</div>
            {roles.map(role => {
              const count = arrangement.filter(note => note.role === role.id).length;
              return (
                <div
                  key={role.id}
                  style={{
                    color: role.id === 'drums' ? '#ffff00' : '#fff',
                    lineHeight: '15px',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    const first = arrangement.find(note => note.role === role.id);
                    if (first) setSelectedNoteId(first.id);
                  }}
                >
                  {role.label} {count}
                </div>
              );
            })}
          </div>

          {/* Health-style vertical volume meter */}
          <div style={{
            position: 'absolute',
            right: 13,
            top: 108,
            width: 16,
            height: 170,
            background: 'rgba(80,80,80,.5)',
            border: '1px solid rgba(255,255,255,.35)',
            boxSizing: 'border-box',
            cursor: 'pointer',
          }}
            onClick={event => {
              const rect = event.currentTarget.getBoundingClientRect();
              const value = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
              setVolume(value);
            }}
            title="Volume"
          >
            <div style={{
              position: 'absolute',
              left: 2,
              right: 2,
              bottom: 2,
              height: Math.round(volume * 164),
              background: '#27c52f',
              boxShadow: '0 0 2px #fff',
            }} />
            <div style={{
              position: 'absolute',
              left: 20,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#00f',
              whiteSpace: 'nowrap',
              textShadow: '1px 1px #fff',
            }}>Volume</div>
          </div>

          {/* Main MIDI editor */}
          <div style={{
            position: 'absolute',
            left: 155,
            right: 155,
            top: 44,
            bottom: 78,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 220,
            background: 'rgba(30,30,30,.58)',
            border: '1px solid rgba(255,255,255,.28)',
            boxShadow: '0 2px 8px rgba(0,0,0,.45)',
          }}>
            <div style={{
              height: 28,
              flex: '0 0 28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(190,190,190,.48)',
              borderBottom: '1px solid rgba(0,0,0,.5)',
              fontWeight: 'bold',
            }}>
              ROBLOXIFY · MIDI EDITOR
            </div>

            <div style={{
              padding: 5,
              display: 'flex',
              justifyContent: 'center',
              gap: 3,
              flexWrap: 'wrap',
              background: 'rgba(70,70,70,.4)',
            }}>
              {[
                ['OCT -', () => transposeArrangement(-12)],
                ['NOTE -', () => transposeArrangement(-1)],
                ['NOTE +', () => transposeArrangement(1)],
                ['OCT +', () => transposeArrangement(12)],
                ['QUANTIZE', quantizeArrangement],
              ].map(([label, action]) => (
                <button key={label} type="button" onClick={action} style={buttonStyle}>{label}</button>
              ))}
            </div>

            <div style={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              background: 'rgba(10,25,10,.86)',
              borderTop: '1px solid rgba(255,255,255,.2)',
            }}>
              {!arrangement.length ? (
                <div
                  onDragOver={event => event.preventDefault()}
                  onDrop={event => {
                    event.preventDefault();
                    convert(event.dataTransfer.files && event.dataTransfer.files[0]);
                  }}
                  style={{
                    height: '100%',
                    minHeight: 260,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    color: '#ddd',
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>ROBLOXIFY</div>
                  <div style={{ marginBottom: 10 }}>DROP AUDIO HERE</div>
                  <label style={{
                    background: '#aaa',
                    color: '#111',
                    border: '1px solid #333',
                    padding: '5px 12px',
                    cursor: 'pointer',
                    boxShadow: 'inset 0 1px #eee',
                  }}>
                    CHOOSE AUDIO
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={event => convert(event.target.files && event.target.files[0])}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              ) : (
                <div style={{
                  position: 'relative',
                  height: 390,
                  minWidth: Math.max(700, Math.ceil(
                    arrangement.reduce(
                      (max, note) => Math.max(max, note.startTimeSeconds + note.durationSeconds),
                      0
                    ) * 70 + 100
                  )),
                }}>
                  {Array.from({ length: 25 }).map((_, row) => {
                    const pitch = 96 - row * 2;
                    return (
                      <div key={pitch} style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: row * 16,
                        height: 16,
                        borderBottom: '1px solid rgba(255,255,255,.1)',
                        background: row % 2 ? 'rgba(255,255,255,.025)' : 'transparent',
                        color: '#aaa',
                        fontSize: 9,
                        textAlign: 'left',
                        paddingLeft: 3,
                        boxSizing: 'border-box',
                      }}>
                        {pitch}
                      </div>
                    );
                  })}

                  {Array.from({
                    length: Math.ceil(
                      arrangement.reduce(
                        (max, note) => Math.max(max, note.startTimeSeconds + note.durationSeconds),
                        0
                      )
                    ) + 1,
                  }).map((_, second) => (
                    <div key={second} style={{
                      position: 'absolute',
                      left: second * 70 + 28,
                      top: 0,
                      bottom: 0,
                      width: 1,
                      background: 'rgba(255,255,255,.18)',
                    }} />
                  ))}

                  {arrangement.map(note => {
                    const top = Math.max(0, Math.min(374, (96 - note.pitchMidi) * 8));
                    const left = note.startTimeSeconds * 70 + 28;
                    const width = Math.max(5, note.durationSeconds * 70);
                    const selected = note.id === selectedNoteId;
                    return (
                      <button
                        key={note.id}
                        type="button"
                        title={note.role.toUpperCase() + ' ' + note.pitchMidi}
                        onClick={() => setSelectedNoteId(note.id)}
                        style={{
                          position: 'absolute',
                          left,
                          top,
                          width,
                          height: 13,
                          padding: 0,
                          margin: 0,
                          background: selected ? '#28c52f' : '#d22',
                          border: selected ? '1px solid #fff' : '1px solid #900',
                          cursor: 'pointer',
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{
              height: 22,
              flex: '0 0 22px',
              background: 'rgba(190,190,190,.38)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}>
              <span>{formatTime(playbackTime)}</span>
              <span>/</span>
              <span>{formatTime(playbackDuration)}</span>
              <span>{status}</span>
            </div>
          </div>

          {showTools && (
            <div style={{
              position: 'absolute',
              left: 10,
              top: 42,
              zIndex: 8,
              width: 205,
              background: 'rgba(110,110,110,.88)',
              border: '1px solid #333',
              boxShadow: '2px 2px 5px rgba(0,0,0,.55)',
              padding: 6,
              boxSizing: 'border-box',
              textAlign: 'center',
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: 5 }}>TOOLS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 3 }}>
                <button type="button" style={buttonStyle} onClick={() => quantizeArrangement()}>QUANTIZE</button>
                <button type="button" style={buttonStyle} onClick={() => transposeArrangement(-12)}>OCT −</button>
                <button type="button" style={buttonStyle} onClick={() => transposeArrangement(12)}>OCT +</button>
                <button type="button" style={buttonStyle} onClick={removeSelected}>DELETE NOTE</button>
              </div>
            </div>
          )}

          {showHelp && (
            <div style={{
              position: 'absolute',
              left: '50%',
              top: 42,
              transform: 'translateX(-50%)',
              zIndex: 9,
              width: 300,
              background: 'rgba(90,90,90,.92)',
              border: '1px solid #333',
              boxShadow: '2px 2px 6px rgba(0,0,0,.55)',
              padding: 8,
              boxSizing: 'border-box',
              textAlign: 'center',
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: 6 }}>ROBLOXIFY HELP</div>
              <div>CLICK A NOTE TO SELECT IT</div>
              <div>INSERT ADDS A NOTE</div>
              <div>DRAG THE MIDI AREA TO SCROLL</div>
              <div>TOOLS HAS EDITING COMMANDS</div>
              <div>GREEN = SELECTED / PLAYBACK</div>
              <div>RED = NOTE / EMPTY HEALTH</div>
            </div>
          )}

          {/* Bottom-left Roblox-style tools */}
          <div style={{
            position: 'absolute',
            left: 10,
            bottom: 10,
            display: 'flex',
            gap: 3,
            background: 'rgba(150,150,150,.34)',
            padding: 3,
          }}>
            {[
              ['AUDIO', () => document.querySelector('[data-robloxify-file]')?.click()],
              ['PLAY', playArrangement],
              ['STOP', stopPlayback],
              ['SAVE', saveProject],
            ].map(([label, action], index) => (
              <button
                key={label}
                type="button"
                onClick={action}
                style={{
                  width: 52,
                  height: 42,
                  background: index === 1 ? '#28c52f' : '#aaa',
                  color: '#111',
                  border: '2px solid #333',
                  boxShadow: 'inset 1px 1px #eee',
                  fontFamily: 'Tahoma, Arial, sans-serif',
                  fontSize: 9,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  textShadow: 'none',
                }}
              >
                <div style={{ fontSize: 14, marginBottom: 2 }}>{index + 1}</div>
                {label}
              </button>
            ))}
            <input
              data-robloxify-file
              type="file"
              accept="audio/*"
              onChange={event => convert(event.target.files && event.target.files[0])}
              style={{ display: 'none' }}
            />
          </div>

          {/* Bottom-right classic HUD controls */}
          <div style={{
            position: 'absolute',
            right: 10,
            bottom: 10,
            width: 74,
            textAlign: 'center',
          }}>
            <button
              type="button"
              onClick={() => setShowProjects(value => !value)}
              style={{
                width: 64,
                height: 22,
                background: 'rgba(210,210,210,.75)',
                border: '1px solid #555',
                color: '#111',
                fontFamily: 'Tahoma, Arial, sans-serif',
                fontSize: 10,
                fontWeight: 'bold',
                cursor: 'pointer',
                textShadow: 'none',
              }}
            >{showProjects ? 'CLOSE' : 'PROJECTS'}</button>
            <div style={{
              marginTop: 3,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 2,
            }}>
              <button type="button" onClick={() => setVolume(Math.min(1, volume + .1))} style={buttonStyle}>+</button>
              <button type="button" onClick={() => setVolume(Math.max(0, volume - .1))} style={buttonStyle}>−</button>
            </div>
          </div>

          {/* Playback bar: green/red like classic Health */}
          <div style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: 12,
            width: 'min(340px, 45%)',
            height: 14,
            background: '#b51e1e',
            border: '2px solid #555',
            boxSizing: 'border-box',
            cursor: 'pointer',
          }}
            onClick={event => {
              if (!playbackDuration) return;
              const rect = event.currentTarget.getBoundingClientRect();
              const next = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
              setPlaybackTime(next * playbackDuration);
            }}
          >
            <div style={{
              width: playbackDuration ? Math.min(100, playbackTime / playbackDuration * 100) + '%' : '0%',
              height: '100%',
              background: '#28c52f',
            }} />
          </div>

          {selectedNote && (
            <div style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: 45,
              background: 'rgba(80,80,80,.7)',
              border: '1px solid rgba(255,255,255,.25)',
              padding: 4,
              display: 'flex',
              gap: 3,
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'nowrap',
            }}>
              <span>NOTE {selectedNote.pitchMidi} · {selectedNote.role.toUpperCase()}</span>
              <button type="button" style={buttonStyle} onClick={() => editSelected({ pitchMidi: Math.max(0, selectedNote.pitchMidi - 1) })}>−</button>
              <button type="button" style={buttonStyle} onClick={() => editSelected({ pitchMidi: Math.min(127, selectedNote.pitchMidi + 1) })}>+</button>
              <button type="button" style={buttonStyle} onClick={removeSelected}>X</button>
            </div>
          )}

          {showProjects && (
            <div style={{
              position: 'absolute',
              right: 90,
              bottom: 45,
              width: 250,
              maxHeight: 190,
              overflow: 'auto',
              background: 'rgba(100,100,100,.82)',
              border: '1px solid #333',
              padding: 7,
              boxSizing: 'border-box',
              textAlign: 'center',
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: 5 }}>PROJECTS</div>
              {projects.length === 0 && <div>No saved projects.</div>}
              {projects.map(project => (
                <div key={project.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  justifyContent: 'center',
                  marginBottom: 3,
                }}>
                  <button type="button" style={buttonStyle} onClick={() => loadProject(project)}>LOAD</button>
                  <span style={{ flex: 1 }}>{project.name}</span>
                  <button type="button" style={buttonStyle} onClick={() => deleteProject(project)}>X</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );



}

export default MusicAI;
