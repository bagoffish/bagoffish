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
  background: '#000',
  border: '1px solid #ff0000',
  color: '#fff',
  fontFamily: 'Tahoma, Arial, sans-serif',
  fontSize: 11,
  padding: '4px 8px',
  cursor: 'pointer',
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
function makeMidi(notes) {
  const midi = new Midi();
  midi.header.setTempo(120);

  const tracks = {};
  roles.forEach(role => {
    tracks[role.id] = midi.addTrack();
    tracks[role.id].channel = role.channel;
    tracks[role.id].instrument.number = role.program;
  });

  notes.forEach(note => {
    const role = roles.find(item => item.id === note.role) || roles[1];
    tracks[role.id].addNote({
      midi: note.pitchMidi,
      time: note.startTimeSeconds,
      duration: Math.max(0.04, note.durationSeconds),
      velocity: Math.max(0.01, Math.min(1, note.amplitude || 0.8)),
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

  useEffect(() => {
    return () => {
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

    const processor = new DemucsProcessor({
      ort,
      onDownloadProgress: (loaded, total) => {
        if (total) {
          setProgress(Math.round((loaded / total) * 18));
          setStatus('LOADING STEM MODEL ' + Math.round((loaded / total) * 100) + '%');
        }
      },
    });

    await processor.loadModel(DEMUCS_MODEL_URL);
    demucsRef.current = processor;
    return processor;
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
          Math.min(127, Math.round((note.amplitude || 0.8) * 127))
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

      setPlaying(true);
      setStatus('PLAYING WITH ROBLOX SOUNDFONT');

      window.setTimeout(() => {
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
        background: '#101010',
        color: '#ddd',
        fontFamily: 'Tahoma, Arial, sans-serif',
        fontSize: 11,
        padding: 10,
        textAlign: 'center',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          background: '#000',
          border: '1px solid #ff0000',
          color: '#fff',
          fontWeight: 'bold',
          letterSpacing: 1,
          padding: '5px 7px',
          marginBottom: 8,
        }}
      >
        ROBLOXIFY
      </div>

      <div
        onDragOver={event => event.preventDefault()}
        onDrop={event => {
          event.preventDefault();
          convert(event.dataTransfer.files && event.dataTransfer.files[0]);
        }}
        style={{
          border: '1px solid #ff0000',
          background: '#000',
          padding: 14,
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        <div style={{ color: '#8bdcff', marginBottom: 6 }}>AUDIO</div>
        <div style={{ marginBottom: 8 }}>
          AUDIO TO MIDI
        </div>
        <label style={buttonStyle}>
          CHOOSE AUDIO
          <input
            type="file"
            accept="audio/*"
            onChange={event =>
              convert(event.target.files && event.target.files[0])
            }
            style={{ display: 'none' }}
          />
        </label>
        {file && (
          <div style={{ marginTop: 7, color: '#aaa' }}>
            {file.name}
          </div>
        )}
      </div>

      <div
        style={{
          background: '#000',
          border: '1px solid #ff0000',
          padding: 7,
          color: '#fff',
          marginBottom: 8,
        }}
      >
        {status}
      </div>

      {working && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ height: 7, background: '#000', border: '1px inset #555' }}>
            <div
              style={{
                width: progress + '%',
                height: '100%',
                background: '#ff0000',
              }}
            />
          </div>
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <div style={{ color: '#ffcf70', marginBottom: 4 }}>PROJECT</div>
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
            background: '#000',
            color: '#fff',
            border: '1px solid #ff0000',
            padding: '4px',
            fontFamily: 'Tahoma, Arial, sans-serif',
            fontSize: 11,
            textAlign: 'center',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
        <button
          type="button"
          style={buttonStyle}
          disabled={working || !arrangement.length}
          onClick={playArrangement}
        >
          {playing ? 'PLAYING...' : 'PLAY WITH ROBLOX SF2'}
        </button>

        <button
          type="button"
          style={buttonStyle}
          disabled={working || !arrangement.length}
          onClick={saveProject}
        >
          SAVE PROJECT
        </button>

        <button
          type="button"
          style={buttonStyle}
          disabled={!midiBlob || working}
          onClick={() =>
            downloadBlob(
              midiBlob,
              (file ? file.name.replace(/\.[^.]+$/, '') : 'converted') + '.mid'
            )
          }
        >
          SAVE MIDI
        </button>

        <button
          type="button"
          style={buttonStyle}
          onClick={() => setShowProjects(value => !value)}
        >
          {showProjects ? 'HIDE PROJECTS' : 'PROJECTS'}
        </button>

        {onClose && (
          <button type="button" style={buttonStyle} onClick={onClose}>
            CLOSE
          </button>
        )}
      </div>

      {arrangement.length > 0 && (
        <div style={{ marginTop: 8, borderTop: '1px solid #555', paddingTop: 7 }}>
          <div style={{ color: '#ffcf70', marginBottom: 5 }}>INSTRUMENTS</div>
          {roles.map(role => {
            const count = arrangement.filter(note => note.role === role.id).length;
            return (
              <div
                key={role.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 5,
                  borderBottom: '1px solid #ff0000',
                  padding: '4px 0',
                  textAlign: 'center',
                }}
              >
                <span>{role.label}</span>
                <span style={{ color: '#aaa' }}>
                  {count} notes
                </span>
                <button
                  type="button"
                  style={buttonStyle}
                  disabled={!count || working}
                  onClick={() => downloadStemMidi(role.id)}
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
          marginTop: 8,
          border: '1px solid #ff0000',
          background: '#000',
          padding: 7,
          textAlign: 'center',
        }}>
          <div style={{ color: '#ff0000', marginBottom: 3 }}>MIDI EDITOR</div>
          <div style={{ color: '#888', marginBottom: 6 }}>DRUMS · BASS · GUITAR · VOCALS</div>

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
              border: '1px solid #ff0000',
              padding: 6,
              marginBottom: 7,
              color: '#fff',
            }}>
              <div style={{ marginBottom: 5 }}>
                NOTE {selectedNote.pitchMidi} · {selectedNote.role.toUpperCase()}
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: 4,
              }}>
                <button type="button" style={buttonStyle}
                  onClick={() => editSelected({ pitchMidi: Math.max(0, selectedNote.pitchMidi - 1) })}>
                  PITCH -
                </button>
                <button type="button" style={buttonStyle}
                  onClick={() => editSelected({ pitchMidi: Math.min(127, selectedNote.pitchMidi + 1) })}>
                  PITCH +
                </button>
                <button type="button" style={buttonStyle}
                  onClick={() => editSelected({
                    startTimeSeconds: Math.max(0, selectedNote.startTimeSeconds - 0.1),
                  })}>
                  START -
                </button>
                <button type="button" style={buttonStyle}
                  onClick={() => editSelected({
                    startTimeSeconds: selectedNote.startTimeSeconds + 0.1,
                  })}>
                  START +
                </button>
                <button type="button" style={buttonStyle}
                  onClick={() => editSelected({
                    durationSeconds: Math.max(0.05, selectedNote.durationSeconds - 0.1),
                  })}>
                  LENGTH -
                </button>
                <button type="button" style={buttonStyle}
                  onClick={() => editSelected({
                    durationSeconds: selectedNote.durationSeconds + 0.1,
                  })}>
                  LENGTH +
                </button>
                <select
                  value={selectedNote.role}
                  onChange={event => editSelected({ role: event.target.value })}
                  style={{
                    background: '#000',
                    color: '#fff',
                    border: '1px solid #ff0000',
                    fontFamily: 'Tahoma, Arial, sans-serif',
                    fontSize: 11,
                  }}
                >
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.label}</option>
                  ))}
                </select>
                <button type="button" style={buttonStyle} onClick={removeSelected}>
                  DELETE
                </button>
              </div>
            </div>
          )}

          <div style={{
            overflowX: 'auto',
            overflowY: 'hidden',
            border: '1px solid #ff0000',
            background: '#050505',
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
                    borderBottom: '1px solid #550000',
                    color: '#777',
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
                      background: selected ? '#ff0000' : '#550000',
                      border: '1px solid #ff0000',
                      cursor: 'pointer',
                    }}
                  />
                );
              })}
            </div>
          </div>
          <div style={{ color: '#aaa', marginTop: 5 }}>
            CLICK A NOTE TO EDIT
          </div>
        </div>
      )}

      {showProjects && (
        <div style={{
          marginTop: 8,
          border: '1px solid #ff0000',
          background: '#000',
          padding: 7,
        }}>
          <div style={{ color: '#ffcf70', marginBottom: 5 }}>PROJECTS</div>
          {projects.length === 0 && (
            <div style={{ color: '#aaa' }}>No saved Robloxify projects.</div>
          )}
          {projects.map(project => (
            <div key={project.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              borderBottom: '1px solid #ff0000',
              padding: '4px 0',
            }}>
              <button type="button" style={buttonStyle} onClick={() => loadProject(project)}>
                LOAD
              </button>
              <span style={{ flex: 1, color: '#fff' }}>
                {project.name}
                <span style={{ color: '#aaa', marginLeft: 5 }}>({project.sourceName})</span>
              </span>
              <button type="button" style={buttonStyle} onClick={() => deleteProject(project)}>
                X
              </button>
            </div>
          ))}
        </div>
      )}

      {notes.length > 0 && (
        <div style={{ marginTop: 8, color: '#888' }}>
          {notes.length} NOTES
        </div>
      )}
    </div>
  );
}

export default MusicAI;
