import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  addPitchBendsToNoteEvents,
  noteFramesToTime,
  outputToNotesPoly,
  BasicPitch,
} from '@spotify/basic-pitch';
import * as tf from '@tensorflow/tfjs';
import { Midi } from '@tonejs/midi';
import { WorkletSynthesizer } from 'spessasynth_lib';

const ROBLOX_SF2_URL =
  '/soundfonts/Instruments/WorkingR-Blox/Roblox%20Soundfont-1.sf2';
const BASIC_PITCH_MODEL_URL = '/basic-pitch-model/model.json';
const SPESSA_PROCESSOR_URL = '/spessasynth_processor.min.js';

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
  const transcriptionWorkerRef = useRef(null);
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
  const [volume, setVolume] = useState(0.8);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const playbackTimerRef = useRef(null);
  const playbackStopTimerRef = useRef(null);
  const playbackRafRef = useRef(null);
  const progressFillRef = useRef(null);
  const playbackCurrentRef = useRef(null);
  const playbackDurationRef = useRef(null);
  const conversionIdRef = useRef(0);

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
      if (transcriptionWorkerRef.current) {
        transcriptionWorkerRef.current.terminate();
        transcriptionWorkerRef.current = null;
      }
    };
  }, []);


  const yieldToBrowser = () => new Promise(resolve => {
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      window.requestAnimationFrame(() => setTimeout(resolve, 0));
    } else {
      setTimeout(resolve, 0);
    }
  });

  const transcribeInMainThread = async (samples, sampleRate, onProgress) => {
    await tf.setBackend('cpu');
    await tf.ready();
    const model = await tf.loadGraphModel(BASIC_PITCH_MODEL_URL);
    const basicPitch = new BasicPitch(model);
    const frames = [];
    const onsets = [];
    const contours = [];

    await basicPitch.evaluateModel(
      {
        sampleRate,
        length: samples.length,
        duration: samples.length / sampleRate,
        numberOfChannels: 1,
        getChannelData: () => samples,
      },
      (frameBatch, onsetBatch, contourBatch) => {
        frames.push(...frameBatch);
        onsets.push(...onsetBatch);
        contours.push(...contourBatch);
      },
      value => {
        if (onProgress) onProgress(Math.max(0, Math.min(1, value)));
      }
    );

    return {
      notes: noteFramesToTime(
        addPitchBendsToNoteEvents(
          contours,
          outputToNotesPoly(frames, onsets, 0.34, 0.42, 8)
        )
      ),
    };
  };

  const convert = async inputFile => {
    if (!inputFile || !inputFile.type.startsWith('audio/')) {
      setStatus('CHOOSE AN AUDIO FILE');
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
    setStatus('PREPARING AUDIO...');

    let decodeContext = null;

    try {
      // Keep the UI alive: decode once, down-mix/resample once, then run one
      // transcription pass. Basic Pitch itself is designed to accept arbitrary
      // sample rates and mono input; 22050 Hz is its processing rate.
      const bytes = await inputFile.arrayBuffer();
      await yieldToBrowser();

      decodeContext = new AudioContext();
      const sourceBuffer = await decodeContext.decodeAudioData(bytes);
      if (conversionId !== conversionIdRef.current) return;

      setInputSampleRate(sourceBuffer.sampleRate);
      const duration = sourceBuffer.duration;

      // Accept audio under 10 minutes. Inference runs in a Web Worker so it
      // does not block the Windows XP shell while processing longer files.
      if (duration >= 600) {
        throw new Error('Audio must be shorter than 10 minutes. Please trim it and try again.');
      }

      await decodeContext.close();
      decodeContext = null;

      setStatus('CONVERTING AUDIO TO MONO...');
      await yieldToBrowser();

      const targetRate = 22050;
      const targetLength = Math.ceil(duration * targetRate);
      const offlineContext = new OfflineAudioContext(1, targetLength, targetRate);
      const source = offlineContext.createBufferSource();
      source.buffer = sourceBuffer;
      source.connect(offlineContext.destination);
      source.start(0);
      const audioBuffer = await offlineContext.startRendering();

      if (conversionId !== conversionIdRef.current) return;

      setProgress(8);
      setStatus('STARTING BACKGROUND TRANSCRIPTION...');
      await yieldToBrowser();

      if (transcriptionWorkerRef.current) {
        transcriptionWorkerRef.current.terminate();
      }

      const worker = new Worker(new URL('./robloxify.worker.js', import.meta.url));
      transcriptionWorkerRef.current = worker;

      let result;
      try {
        result = await new Promise((resolve, reject) => {
          let settled = false;

          const finish = (callback, value) => {
            if (settled) return;
            settled = true;
            worker.onmessage = null;
            worker.onerror = null;
            callback(value);
          };

          worker.onmessage = event => {
            const message = event.data || {};
            if (message.type === 'progress') {
              if (conversionId !== conversionIdRef.current) return;
              const percent = Math.round(message.value * 100);
              setProgress(Math.round(10 + message.value * 75));
              setStatus('TRANSCRIBING ' + percent + '%');
              return;
            }

            if (message.type === 'result') {
              finish(resolve, message);
              return;
            }

            if (message.type === 'error') {
              finish(reject, new Error(message.message || 'Background transcription failed.'));
            }
          };

          worker.onerror = error => {
            finish(reject, new Error(error.message || 'Background transcription worker could not load.'));
          };

          const workerSamples = audioBuffer.getChannelData(0).slice();
          worker.postMessage({
            type: 'transcribe',
            samples: workerSamples,
            sampleRate: audioBuffer.sampleRate,
          }, [workerSamples.buffer]);
        });
      } catch (workerError) {
        // A stale/mismatched production deployment can leave the worker's
        // hashed dependency chunk unavailable. Do not make conversion fail
        // completely in that case: use the same Basic Pitch model directly.
        console.warn('Robloxify worker unavailable; using compatibility mode.', workerError);
        if (conversionId !== conversionIdRef.current) return;
        setStatus('WORKER UNAVAILABLE — USING COMPATIBILITY MODE...');
        setProgress(10);
        await yieldToBrowser();

        result = await transcribeInMainThread(
          audioBuffer.getChannelData(0).slice(),
          audioBuffer.sampleRate,
          value => {
            if (conversionId !== conversionIdRef.current) return;
            const percent = Math.round(value * 100);
            setProgress(Math.round(10 + value * 75));
            setStatus('COMPATIBILITY TRANSCRIBING ' + percent + '%');
          }
        );
      } finally {
        worker.terminate();
        if (transcriptionWorkerRef.current === worker) {
          transcriptionWorkerRef.current = null;
        }
      }

      if (conversionId !== conversionIdRef.current) return;

      await yieldToBrowser();
      setStatus('CLEANING NOTES...');

      const detected = Array.isArray(result.notes) ? result.notes : [];

      // Split the clean transcription into useful Roblox tracks. This is much
      // more stable than four consecutive neural-network passes over stems.
      const density = detected.length / Math.max(duration, 1);
      const fitted = cleanDetectedNotes(detected, {
        minDuration: 0.075,
        minAmplitude: 0.34,
      }).map((note, index) => {
        const pitch = note.pitchMidi;
        const short = note.durationSeconds < 0.18;
        const long = note.durationSeconds > 0.65;
        let role = 'guitar';

        if (pitch < 52 && !short) {
          role = 'bass';
        } else if (short && pitch >= 38 && pitch <= 84 && density > 5) {
          role = 'drums';
        } else if (pitch >= 68 && (long || pitch >= 82)) {
          role = 'vocals';
        }

        if (role === 'drums') {
          return {
            ...note,
            id: index + 1,
            role,
            pitchMidi:
              pitch < 48 ? 36 :
              pitch < 62 ? 38 :
              pitch < 76 ? 42 : 46,
          };
        }

        return { ...note, id: index + 1, role };
      });

      if (!fitted.length) {
        throw new Error('No musical notes were detected.');
      }

      fitted.sort((a, b) =>
        a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi
      );

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
      if (decodeContext) {
        try { await decodeContext.close(); } catch (error) { /* cleanup */ }
      }
      if (conversionId === conversionIdRef.current && transcriptionWorkerRef.current) {
        transcriptionWorkerRef.current.terminate();
        transcriptionWorkerRef.current = null;
      }
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

  const setVolumeFromPointer = event => {
    const bar = event.currentTarget;
    const rect = bar.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    setVolume(Math.round((1 - y / rect.height) * 20) / 20);
  };

  const startVolumeDrag = event => {
    event.preventDefault();
    const bar = event.currentTarget;
    const update = moveEvent => {
      const rect = bar.getBoundingClientRect();
      const y = Math.max(0, Math.min(rect.height, moveEvent.clientY - rect.top));
      setVolume(Math.round((1 - y / rect.height) * 20) / 20);
    };
    const stop = () => {
      window.removeEventListener('mousemove', update);
      window.removeEventListener('mouseup', stop);
    };
    window.addEventListener('mousemove', update);
    window.addEventListener('mouseup', stop);
    setVolumeFromPointer(event);
  };

  const formatTime = seconds => {
    const safe = Math.max(0, Math.floor(seconds || 0));
    const minutes = Math.floor(safe / 60);
    const secs = safe % 60;
    return minutes + ':' + String(secs).padStart(2, '0');
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
    setPlaying(false);
    setPlaybackTime(0);
    setStatus('PLAYBACK STOPPED');
  };

  const arrangementDuration = useMemo(() => arrangement.reduce(
    (max, note) => Math.max(max, note.startTimeSeconds + note.durationSeconds),
    0
  ), [arrangement]);

  const notesByRole = useMemo(() => {
    const grouped = {};
    roles.forEach(role => {
      grouped[role.id] = [];
    });
    arrangement.forEach(note => {
      if (grouped[note.role]) {
        grouped[note.role].push(note);
      }
    });
    return grouped;
  }, [arrangement]);

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

      const duration = arrangementDuration;

      setPlaybackDuration(duration);
      setPlaybackTime(0);
      setPlaying(true);
      setStatus('PLAYING WITH ROBLOX SOUNDFONT');

      const playbackStartedAt = performance.now();
      const updatePlaybackDisplay = () => {
        const elapsed = Math.min(duration, (performance.now() - playbackStartedAt) / 1000);
        const ratio = duration > 0 ? Math.min(1, elapsed / duration) : 0;

        if (progressFillRef.current) {
          progressFillRef.current.style.width = (ratio * 100) + '%';
        }
        if (playbackCurrentRef.current) {
          playbackCurrentRef.current.textContent = formatTime(elapsed);
        }
        if (playbackDurationRef.current) {
          playbackDurationRef.current.textContent = formatTime(duration);
        }

        if (elapsed < duration) {
          playbackRafRef.current = window.requestAnimationFrame(updatePlaybackDisplay);
        }
      };
      playbackRafRef.current = window.requestAnimationFrame(updatePlaybackDisplay);

      playbackStopTimerRef.current = window.setTimeout(() => {
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
        playbackStopTimerRef.current = null;
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
        position: 'relative',
      }}
    >
      <div style={{
        position: 'absolute',
        inset: 0,
        background: "url('/images/sky.png') center / cover no-repeat",
        opacity: 0.18,
      }} />

      <div style={{
        position: 'relative',
        zIndex: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          height: 28,
          flex: '0 0 28px',
          display: 'flex',
          alignItems: 'stretch',
          background: 'rgba(45,45,45,.88)',
          borderBottom: '1px solid #111',
        }}>
          <div style={{
            width: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#666',
            fontSize: 15,
            fontWeight: 'bold',
          }}>R</div>

          <button type="button" onClick={() => setShowTools(value => !value)} style={buttonStyle}>Edit</button>
          <button type="button" onClick={() => document.querySelector('[data-robloxify-file]').click()} disabled={working} style={buttonStyle}>Open</button>
          <button type="button" onClick={playing ? stopPlayback : playArrangement} disabled={working || (!playing && !arrangement.length)} style={buttonStyle}>{playing ? 'Stop' : 'Play'}</button>
          <button type="button" onClick={saveProject} disabled={!arrangement.length} style={buttonStyle}>Save</button>
          <button type="button" onClick={() => midiBlob && downloadBlob(midiBlob, 'robloxify.mid')} disabled={!midiBlob} style={buttonStyle}>Export</button>
          <button type="button" onClick={() => setShowProjects(value => !value)} style={buttonStyle}>Projects</button>
          <button type="button" onClick={() => setShowHelp(value => !value)} style={buttonStyle}>Help</button>
        </div>

        {showTools && (
          <div style={{
            position: 'absolute',
            top: 31,
            left: 28,
            zIndex: 20,
            background: '#777',
            border: '2px solid #333',
            padding: 6,
            display: 'flex',
            gap: 4,
            boxShadow: '2px 2px 5px rgba(0,0,0,.6)',
          }}>
            <button type="button" style={buttonStyle} onClick={insertNote}>Insert Note</button>
            <button type="button" style={buttonStyle} onClick={() => transposeArrangement(-12)}>Oct -</button>
            <button type="button" style={buttonStyle} onClick={() => transposeArrangement(-1)}>Note -</button>
            <button type="button" style={buttonStyle} onClick={() => transposeArrangement(1)}>Note +</button>
            <button type="button" style={buttonStyle} onClick={() => transposeArrangement(12)}>Oct +</button>
            <button type="button" style={buttonStyle} onClick={quantizeArrangement}>Quantize</button>
          </div>
        )}

        <input
          data-robloxify-file
          type="file"
          accept="audio/*"
          onChange={event => convert(event.target.files && event.target.files[0])}
          style={{ display: 'none' }}
        />

        <div style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 18px 70px',
          boxSizing: 'border-box',
        }}>
          <div style={{
            width: 'min(860px, 100%)',
            flex: 1,
            minHeight: 0,
            background: 'rgba(70,70,70,.72)',
            border: '2px solid #222',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.12), 3px 3px 8px rgba(0,0,0,.45)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{
              padding: '6px 8px',
              background: 'rgba(35,35,35,.82)',
              borderBottom: '1px solid #222',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontWeight: 'bold' }}>{projectName}</span>
              <span>{status}</span>
            </div>

            <div style={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              padding: 12,
              background: 'rgba(20,20,20,.55)',
            }}>
              {!arrangement.length ? (
                <div style={{
                  height: '100%',
                  minHeight: 180,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px dashed #888',
                  color: '#ddd',
                  textAlign: 'center',
                }}>
                  OPEN AN AUDIO FILE TO CREATE A ROBLOX MIDI ARRANGEMENT
                </div>
              ) : (
                <div>
                  {roles.map(role => {
                    const trackNotes = notesByRole[role.id] || [];
                    return (
                      <div key={role.id} style={{
                        marginBottom: 8,
                        border: '1px solid #555',
                        background: 'rgba(100,100,100,.45)',
                      }}>
                        <div style={{
                          padding: '4px 6px',
                          background: 'rgba(55,55,55,.8)',
                          fontWeight: 'bold',
                        }}>
                          {role.label} · {trackNotes.length} NOTES
                        </div>
                        <div style={{
                          position: 'relative',
                          height: 58,
                          minWidth: Math.max(500, playbackDuration * 55),
                          backgroundImage: 'linear-gradient(to right, rgba(255,255,255,.12) 1px, transparent 1px)',
                          backgroundSize: '55px 100%',
                        }}>
                          {trackNotes.map(note => {
                            const duration = Math.max(playbackDuration, arrangementDuration, 1);
                            const left = note.startTimeSeconds / duration * 100;
                            const width = Math.max(.7, note.durationSeconds / duration * 100);
                            const selected = note.id === selectedNoteId;
                            return (
                              <button
                                type="button"
                                key={note.id}
                                title={'MIDI ' + note.pitchMidi}
                                onClick={() => setSelectedNoteId(note.id)}
                                style={{
                                  position: 'absolute',
                                  left: left + '%',
                                  width: width + '%',
                                  minWidth: 5,
                                  top: 8 + (127 - note.pitchMidi) % 40,
                                  height: 10,
                                  padding: 0,
                                  border: selected ? '2px solid #fff' : '1px solid #222',
                                  background: selected ? '#35c83a' : '#999',
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{
              padding: 6,
              borderTop: '1px solid #222',
              background: 'rgba(55,55,55,.8)',
              display: 'flex',
              gap: 5,
              alignItems: 'center',
            }}>
              <input
                value={projectName}
                onChange={event => setProjectName(event.target.value)}
                style={{
                  flex: 1,
                  minWidth: 100,
                  background: '#ddd',
                  color: '#111',
                  border: '1px solid #333',
                  padding: '3px 5px',
                  fontFamily: 'Tahoma, Arial, sans-serif',
                  fontSize: 11,
                }}
              />
              {selectedNote && (
                <>
                  <button type="button" style={buttonStyle} onClick={() => editSelected({ startTimeSeconds: Math.max(0, selectedNote.startTimeSeconds - .1) })}>◀</button>
                  <button type="button" style={buttonStyle} onClick={() => editSelected({ startTimeSeconds: selectedNote.startTimeSeconds + .1 })}>▶</button>
                  <button type="button" style={buttonStyle} onClick={() => editSelected({ durationSeconds: Math.max(.05, selectedNote.durationSeconds + .1) })}>Length +</button>
                  <button type="button" style={buttonStyle} onClick={removeSelected}>Delete</button>
                </>
              )}
            </div>
          </div>
        </div>

        <div style={{
          position: 'absolute',
          left: '50%',
          bottom: 8,
          transform: 'translateX(-50%)',
          width: 'min(420px, 48%)',
          minWidth: 220,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: 'Tahoma, Arial, sans-serif',
            fontSize: 10,
            fontWeight: 'bold',
            textShadow: '1px 1px #111',
          }}>
            <span ref={playbackCurrentRef}>{formatTime(playbackTime)}</span>
            <span ref={playbackDurationRef}>{formatTime(playbackDuration)}</span>
          </div>
          <div
            role="progressbar"
            aria-label="Playback progress"
            aria-valuemin={0}
            aria-valuemax={playbackDuration || 0}
            aria-valuenow={Math.min(playbackTime, playbackDuration || 0)}
            style={{
              height: 15,
              background: '#b51e1e',
              border: '2px solid #555',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            <div
              ref={progressFillRef}
              style={{
                width: playbackDuration ? Math.min(100, playbackTime / playbackDuration * 100) + '%' : '0%',
                height: '100%',
                background: '#28c52f',
              }}
            />
          </div>
        </div>

        <div style={{
          position: 'absolute',
          right: 12,
          bottom: 58,
          width: 46,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          userSelect: 'none',
        }}>
          <div
            role="slider"
            aria-label="Volume"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(volume * 100)}
            tabIndex={0}
            onMouseDown={startVolumeDrag}
            onClick={setVolumeFromPointer}
            onKeyDown={event => {
              if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
                event.preventDefault();
                setVolume(value => Math.min(1, value + 0.05));
              } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
                event.preventDefault();
                setVolume(value => Math.max(0, value - 0.05));
              }
            }}
            style={{
              position: 'relative',
              width: 16,
              height: 104,
              background: '#c51d1d',
              border: '2px solid #222',
              boxShadow: 'inset 1px 1px rgba(255,255,255,.35), 1px 1px 2px rgba(0,0,0,.7)',
              boxSizing: 'border-box',
              cursor: 'ns-resize',
              overflow: 'hidden',
            }}
          >
            <div style={{
              position: 'absolute',
              left: 2,
              right: 2,
              bottom: 2,
              height: Math.max(0, volume * 100) + '%',
              background: '#19ed24',
              boxShadow: 'inset 1px 0 rgba(255,255,255,.45)',
            }} />
          </div>
          <div style={{
            marginTop: 2,
            color: '#0019cc',
            fontFamily: 'Arial, Tahoma, sans-serif',
            fontSize: 16,
            lineHeight: '16px',
            fontWeight: 'normal',
            textShadow: '1px 1px rgba(255,255,255,.35)',
          }}>
            Vol
          </div>
        </div>

        {showProjects && (
          <div style={{
            position: 'absolute',
            right: 10,
            bottom: 42,
            width: 280,
            maxHeight: 190,
            overflow: 'auto',
            background: 'rgba(100,100,100,.95)',
            border: '2px solid #333',
            padding: 7,
            zIndex: 30,
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: 5 }}>PROJECTS</div>
            {projects.length === 0 && <div>No saved projects.</div>}
            {projects.map(project => (
              <div key={project.id} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 3 }}>
                <button type="button" style={buttonStyle} onClick={() => loadProject(project)}>Load</button>
                <span style={{ flex: 1 }}>{project.name}</span>
                <button type="button" style={buttonStyle} onClick={() => deleteProject(project)}>X</button>
              </div>
            ))}
          </div>
        )}

        {showHelp && (
          <div style={{
            position: 'absolute',
            top: 38,
            right: 12,
            width: 300,
            background: '#bdbdbd',
            color: '#111',
            border: '2px solid #333',
            zIndex: 40,
            textShadow: 'none',
            boxShadow: '3px 3px 7px rgba(0,0,0,.6)',
          }}>
            <div style={{ background: '#555', color: '#fff', padding: '4px 6px', fontWeight: 'bold' }}>ROBLOXIFY HELP</div>
            <div style={{ padding: 8, lineHeight: 1.4 }}>
              Open audio, let Robloxify create the MIDI tracks, then select notes in the editor to move, transpose, quantize, or delete them. Use Export MIDI to save the edited arrangement.
            </div>
            <div style={{ textAlign: 'right', padding: '0 8px 8px' }}>
              <button type="button" style={buttonStyle} onClick={() => setShowHelp(false)}>OK</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

}

export default MusicAI;
