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

const ROBLOX_SF2_URL =
  '/soundfonts/Instruments/WorkingR-Blox/Roblox%20Soundfont-1.sf2';
const BASIC_PITCH_MODEL_URL = '/basic-pitch-model/model.json';
const SPESSA_PROCESSOR_URL = '/spessasynth_processor.min.js';

const roles = [
  { id: 'bass', label: 'BASS', channel: 0, program: 32 },
  { id: 'rhythm', label: 'RHYTHM', channel: 1, program: 0 },
  { id: 'lead', label: 'LEAD', channel: 2, program: 80 },
  { id: 'texture', label: 'TEXTURE', channel: 3, program: 48 },
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

function chooseRole(note, density) {
  const pitch = note.pitchMidi;
  const duration = note.durationSeconds;
  const short = duration < 0.18;
  const long = duration > 0.65;

  const scores = {
    bass: (pitch < 52 ? 5 : 0) + (pitch < 45 ? 3 : 0) + (short ? -1 : 1),
    rhythm:
      (pitch >= 45 && pitch <= 78 ? 4 : 0) +
      (short ? 2 : 0) +
      (density > 8 ? 2 : 0),
    lead:
      (pitch >= 68 ? 5 : 0) +
      (pitch >= 82 ? 3 : 0) +
      (long ? 2 : 0),
    texture:
      (long ? 4 : 0) +
      (pitch >= 55 && pitch <= 90 ? 2 : 0) +
      (density < 6 ? 2 : 0),
  };

  return Object.keys(scores).sort((a, b) => scores[b] - scores[a])[0];
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

  const convert = async inputFile => {
    if (!inputFile || !inputFile.type.startsWith('audio/')) {
      setStatus('CHOOSE AN AUDIO FILE');
      return;
    }

    setFile(inputFile);
    setWorking(true);
    setProgress(0);
    setStatus('LOADING ROBLOXIFY ENGINE...');

    try {
      const bytes = await inputFile.arrayBuffer();
      const decodeContext = new AudioContext();
      const sourceBuffer = await decodeContext.decodeAudioData(bytes);
      setInputSampleRate(sourceBuffer.sampleRate);
      await decodeContext.close();

      // Basic Pitch expects a mono 22050 Hz buffer.
      const targetSampleRate = 22050;
      const targetLength = Math.ceil(sourceBuffer.duration * targetSampleRate);
      const offlineContext = new OfflineAudioContext(
        1,
        targetLength,
        targetSampleRate
      );
      const source = offlineContext.createBufferSource();
      source.buffer = sourceBuffer;
      source.connect(offlineContext.destination);
      source.start(0);
      const audioBuffer = await offlineContext.startRendering();
      setStatus('LOADING ROBLOXIFY MODEL...');
      const model = await tf.loadGraphModel(BASIC_PITCH_MODEL_URL);
      const basicPitch = new BasicPitch(model);

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
          setProgress(Math.round(value * 85));
          setStatus('TRANSCRIBING ' + Math.round(value * 100) + '%');
        }
      );

      const detected = noteFramesToTime(
        addPitchBendsToNoteEvents(
          contours,
          outputToNotesPoly(frames, onsets, 0.25, 0.25, 5)
        )
      );

      if (!detected.length) {
        throw new Error('No musical notes were detected.');
      }

      setNotes(detected);

      const duration = detected.reduce(
        (max, note) =>
          Math.max(max, note.startTimeSeconds + note.durationSeconds),
        0
      );
      const density = detected.length / Math.max(1, duration);

      setStatus('FITTING NOTES TO ROBLOX INSTRUMENTS...');
      const fitted = detected.map(note => ({
        ...note,
        role: chooseRole(note, density),
      }));

      setArrangement(fitted);
      setMidiBlob(makeMidi(fitted));
      setProgress(100);
      setStatus('DONE — ROBLOXIFY ARRANGEMENT READY');
    } catch (error) {
      console.error(error);
      setStatus(
        'CONVERSION FAILED — ' + (error && error.message ? error.message : 'UNKNOWN ERROR')
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
    setArrangement(project.arrangement || []);
    setMidiBlob(makeMidi(project.arrangement || []));
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
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #ff0000',
                  padding: '3px 0',
                  textAlign: 'center',
                }}
              >
                <span>{role.label}</span>
                <span style={{ color: '#aaa' }}>
                  GM {role.program} · {count} notes
                </span>
              </div>
            );
          })}
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
