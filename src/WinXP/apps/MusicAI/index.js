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
        overflow: 'auto',
        background: '#8b3f2f',
        color: '#fff',
        fontFamily: 'Tahoma, Arial, sans-serif',
        fontSize: 11,
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      <div style={{
        height: 29,
        background: 'rgba(90, 90, 90, 0.78)',
        borderBottom: '1px solid #333',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        boxSizing: 'border-box',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{
          width: 31,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#c8c8c8',
          color: '#c00',
          fontWeight: 'bold',
          fontSize: 17,
          textShadow: '1px 1px #fff',
        }}>R</div>
        {['Tools', 'Insert', '× Fullscreen', 'Help...'].map(item => (
          <div key={item} style={{
            minWidth: item === '× Fullscreen' ? 92 : 74,
            padding: '7px 10px',
            boxSizing: 'border-box',
            background: 'rgba(210, 210, 210, 0.28)',
            borderRight: '1px solid rgba(40, 40, 40, 0.35)',
            color: '#eee',
            textShadow: '1px 1px #555',
            textAlign: 'center',
          }}>{item}</div>
        ))}
        {onClose && (
          <button type="button" onClick={onClose} style={{
            border: 0,
            borderLeft: '1px solid rgba(40,40,40,.35)',
            background: 'rgba(120,120,120,.45)',
            color: '#fff',
            padding: '0 17px',
            fontFamily: 'Tahoma, Arial, sans-serif',
            fontSize: 11,
            cursor: 'pointer',
          }}>Exit</button>
        )}
      </div>

      <div style={{ padding: 8, maxWidth: 760, margin: '0 auto', boxSizing: 'border-box', textAlign: 'center' }}>
        <div style={{
          background: 'rgba(75, 45, 39, .72)',
          border: '1px solid rgba(35, 25, 25, .8)',
          boxShadow: 'inset 0 1px rgba(255,255,255,.14)',
          padding: 7,
          marginBottom: 7,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 18, fontWeight: 'bold', letterSpacing: 1, textShadow: '1px 1px #333' }}>
            ROBLOXIFY
          </div>
          <div style={{ color: '#ddd', marginTop: 2 }}>
            AUDIO → ROBLOX MIDI
          </div>
        </div>

        <div
          onDragOver={event => event.preventDefault()}
          onDrop={event => {
            event.preventDefault();
            convert(event.dataTransfer.files && event.dataTransfer.files[0]);
          }}
          style={{
            background: 'rgba(60, 43, 39, .72)',
            border: '1px solid rgba(30,25,25,.9)',
            padding: 9,
            marginBottom: 7,
            textAlign: 'center',
          }}
        >
          <div style={{ marginBottom: 6, fontWeight: 'bold' }}>AUDIO</div>
          <label style={{
            display: 'inline-block',
            background: '#b7b7b7',
            border: '1px solid #333',
            color: '#111',
            padding: '5px 12px',
            boxShadow: 'inset 0 1px #eee',
            cursor: 'pointer',
            textShadow: '0 1px #eee',
          }}>
            CHOOSE AUDIO
            <input
              type="file"
              accept="audio/*"
              onChange={event => convert(event.target.files && event.target.files[0])}
              style={{ display: 'none' }}
            />
          </label>
          {file && (
            <div style={{ marginTop: 6, color: '#eee', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {file.name}
            </div>
          )}
        </div>

        <div style={{
          background: 'rgba(65, 45, 40, .74)',
          border: '1px solid rgba(30,25,25,.9)',
          padding: 8,
          marginBottom: 7,
        }}>
          <div style={{ textAlign: 'center', marginBottom: 6 }}>{status}</div>
          <div style={{
            height: 13,
            background: '#8b1e1e',
            border: '2px solid #555',
            boxShadow: 'inset 0 1px #222',
            cursor: 'pointer',
          }}
            onClick={event => setProgress(Math.max(0, Math.min(100, ((event.clientX - event.currentTarget.getBoundingClientRect().left) / event.currentTarget.getBoundingClientRect().width) * 100)))}
          >
            <div style={{
              width: progress + '%',
              height: '100%',
              background: '#24a52b',
              boxShadow: 'inset 0 1px rgba(255,255,255,.35)',
            }} />
          </div>
        </div>

        <div style={{
          background: 'rgba(50, 40, 39, .76)',
          border: '1px solid rgba(30,25,25,.9)',
          padding: 8,
          marginBottom: 7,
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: 5 }}>PLAYER</div>

          <div style={{
            background: '#6f1f1f',
            border: '2px solid #555',
            height: 16,
            position: 'relative',
            boxSizing: 'border-box',
            marginBottom: 4,
            cursor: 'pointer',
          }}
            onClick={event => setBarFromPointer(event, value => setVolume(value))}
            title="Click to set volume"
          >
            <div style={{
              width: Math.round(volume * 100) + '%',
              height: '100%',
              background: '#24a52b',
              boxShadow: 'inset 0 1px rgba(255,255,255,.45)',
            }} />
            <div style={{
              position: 'absolute',
              inset: 0,
              textAlign: 'center',
              lineHeight: '12px',
              color: '#fff',
              textShadow: '1px 1px #222',
            }}>
              VOLUME {Math.round(volume * 100)}%
            </div>
          </div>

          <div style={{
            background: '#6f1f1f',
            border: '2px solid #555',
            height: 16,
            position: 'relative',
            boxSizing: 'border-box',
            cursor: 'pointer',
          }}
            onClick={event => {
              if (!playbackDuration) return;
              const rect = event.currentTarget.getBoundingClientRect();
              const next = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
              setPlaybackTime(next * playbackDuration);
            }}
            title="Playback time"
          >
            <div style={{
              width: playbackDuration ? Math.min(100, (playbackTime / playbackDuration) * 100) + '%' : '0%',
              height: '100%',
              background: '#24a52b',
              boxShadow: 'inset 0 1px rgba(255,255,255,.45)',
            }} />
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              textShadow: '1px 1px #222',
            }}>
              {formatTime(playbackTime)} / {formatTime(playbackDuration)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 7 }}>
          <button
            type="button"
            disabled={working || !arrangement.length}
            onClick={playArrangement}
            style={buttonStyle}
          >
            {playing ? 'PLAYING...' : 'PLAY'}
          </button>
          <button
            type="button"
            disabled={!playing}
            onClick={stopPlayback}
            style={buttonStyle}
          >
            STOP
          </button>
          <button
            type="button"
            disabled={working || !arrangement.length}
            onClick={saveProject}
            style={buttonStyle}
          >
            SAVE PROJECT
          </button>
          <button
            type="button"
            disabled={!midiBlob || working}
            onClick={() => downloadBlob(
              midiBlob,
              (file ? file.name.replace(/\.[^.]+$/, '') : 'converted') + '.mid'
            )}
            style={buttonStyle}
          >
            SAVE MIDI
          </button>
          <button
            type="button"
            onClick={() => setShowProjects(value => !value)}
            style={buttonStyle}
          >
            {showProjects ? 'HIDE PROJECTS' : 'PROJECTS'}
          </button>
        </div>

        <div style={{
          background: 'rgba(58, 43, 39, .76)',
          border: '1px solid rgba(30,25,25,.9)',
          padding: 8,
          marginBottom: 7,
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: 5, textAlign: 'center' }}>PROJECT</div>
          <input
            value={projectName}
            onChange={event => {
              setProjectName(event.target.value);
              writeCookie(COOKIE_KEY, event.target.value);
            }}
            maxLength={80}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: '#eee',
              color: '#111',
              border: '1px solid #444',
              padding: '4px',
              fontFamily: 'Tahoma, Arial, sans-serif',
              fontSize: 11,
              textAlign: 'center',
            }}
          />
        </div>

        {arrangement.length > 0 && (
          <div style={{
            background: 'rgba(55, 42, 39, .78)',
            border: '1px solid rgba(30,25,25,.9)',
            padding: 8,
            marginBottom: 7,
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: 6 }}>INSTRUMENTS</div>
            {roles.map(role => {
              const count = arrangement.filter(note => note.role === role.id).length;
              return (
                <div key={role.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                  background: 'rgba(185,185,185,.12)',
                  borderTop: '1px solid rgba(255,255,255,.12)',
                  padding: 5,
                  marginBottom: 3,
                }}>
                  <span style={{ minWidth: 60, textAlign: 'center' }}>{role.label}</span>
                  <span style={{ flex: 1, color: '#ddd', textAlign: 'center' }}>{count} notes</span>
                  <button
                    type="button"
                    disabled={!count || working}
                    onClick={() => downloadStemMidi(role.id)}
                    style={buttonStyle}
                  >
                    SAVE
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {arrangement.length > 0 && (
          <div style={{
            background: 'rgba(38, 34, 34, .88)',
            border: '1px solid #333',
            padding: 8,
            marginBottom: 7,
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: 2 }}>MIDI EDITOR</div>
            <div style={{ color: '#ccc', marginBottom: 7 }}>DRUMS · BASS · GUITAR · VOCALS</div>

            <div style={{
              display: 'flex',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: 4,
              marginBottom: 7,
            }}>
              <button type="button" style={buttonStyle} onClick={() => transposeArrangement(-12)}>OCT -</button>
              <button type="button" style={buttonStyle} onClick={() => transposeArrangement(-1)}>NOTE -</button>
              <button type="button" style={buttonStyle} onClick={() => transposeArrangement(1)}>NOTE +</button>
              <button type="button" style={buttonStyle} onClick={() => transposeArrangement(12)}>OCT +</button>
              <button type="button" style={buttonStyle} onClick={quantizeArrangement}>QUANTIZE</button>
            </div>

            {selectedNote && (
              <div style={{
                background: 'rgba(180,180,180,.1)',
                border: '1px solid #555',
                padding: 6,
                marginBottom: 7,
              }}>
                <div style={{ marginBottom: 5 }}>
                  NOTE {selectedNote.pitchMidi} · {selectedNote.role.toUpperCase()}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 4 }}>
                  <button type="button" style={buttonStyle} onClick={() => editSelected({ pitchMidi: Math.max(0, selectedNote.pitchMidi - 1) })}>PITCH -</button>
                  <button type="button" style={buttonStyle} onClick={() => editSelected({ pitchMidi: Math.min(127, selectedNote.pitchMidi + 1) })}>PITCH +</button>
                  <button type="button" style={buttonStyle} onClick={() => editSelected({ startTimeSeconds: Math.max(0, selectedNote.startTimeSeconds - 0.1) })}>START -</button>
                  <button type="button" style={buttonStyle} onClick={() => editSelected({ startTimeSeconds: selectedNote.startTimeSeconds + 0.1 })}>START +</button>
                  <button type="button" style={buttonStyle} onClick={() => editSelected({ durationSeconds: Math.max(0.05, selectedNote.durationSeconds - 0.1) })}>LENGTH -</button>
                  <button type="button" style={buttonStyle} onClick={() => editSelected({ durationSeconds: selectedNote.durationSeconds + 0.1 })}>LENGTH +</button>
                  <select
                    value={selectedNote.role}
                    onChange={event => editSelected({ role: event.target.value })}
                    style={{
                      background: '#eee',
                      color: '#111',
                      border: '1px solid #444',
                      fontFamily: 'Tahoma, Arial, sans-serif',
                      fontSize: 11,
                    }}
                  >
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>{role.label}</option>
                    ))}
                  </select>
                  <button type="button" style={buttonStyle} onClick={removeSelected}>DELETE</button>
                </div>
              </div>
            )}

            <div style={{
              overflowX: 'auto',
              overflowY: 'hidden',
              border: '1px solid #333',
              background: '#222',
            }}>
              <div style={{
                position: 'relative',
                height: 260,
                minWidth: Math.max(650, Math.ceil(
                  arrangement.reduce(
                    (max, note) => Math.max(max, note.startTimeSeconds + note.durationSeconds),
                    0
                  ) * 70 + 120
                )),
              }}>
                {Array.from({ length: 13 }).map((_, row) => {
                  const pitch = 84 - row * 3;
                  return (
                    <div key={pitch} style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: row * 20,
                      height: 20,
                      borderBottom: '1px solid #4b3030',
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

                {arrangement.map(note => {
                  const top = Math.max(0, Math.min(240, (84 - note.pitchMidi) * 6.67));
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
                        height: 16,
                        padding: 0,
                        margin: 0,
                        background: selected ? '#24a52b' : '#a52a2a',
                        border: selected ? '1px solid #8cff8c' : '1px solid #ff6666',
                        cursor: 'pointer',
                      }}
                    />
                  );
                })}
              </div>
            </div>
            <div style={{ color: '#bbb', marginTop: 5 }}>
              CLICK A NOTE TO EDIT
            </div>
          </div>
        )}

        {showProjects && (
          <div style={{
            background: 'rgba(55,42,39,.8)',
            border: '1px solid rgba(30,25,25,.9)',
            padding: 8,
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: 5 }}>PROJECTS</div>
            {projects.length === 0 && (
              <div style={{ color: '#ccc' }}>No saved Robloxify projects.</div>
            )}
            {projects.map(project => (
              <div key={project.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                borderTop: '1px solid rgba(255,255,255,.12)',
                padding: '5px 0',
              }}>
                <button type="button" style={buttonStyle} onClick={() => loadProject(project)}>LOAD</button>
                <span style={{ flex: 1, color: '#fff', textAlign: 'center' }}>
                  {project.name}
                  <span style={{ color: '#bbb', marginLeft: 5 }}>({project.sourceName})</span>
                </span>
                <button type="button" style={buttonStyle} onClick={() => deleteProject(project)}>X</button>
              </div>
            ))}
          </div>
        )}

        {notes.length > 0 && (
          <div style={{ marginTop: 7, textAlign: 'center', color: '#ddd' }}>
            {notes.length} NOTES
          </div>
        )}
      </div>
    </div>
  );

}

export default MusicAI;
