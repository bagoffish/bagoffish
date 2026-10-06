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
  const conversionIdRef = useRef(0);

  useEffect(() => {
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

          <button type="button" onClick={() => setShowTools(value => !value)} style={buttonStyle}>Tools</button>
          <button type="button" onClick={() => document.querySelector('[data-robloxify-file]').click()} disabled={working} style={buttonStyle}>Open Audio</button>
          <button type="button" onClick={playArrangement} disabled={working || !arrangement.length} style={buttonStyle}>Play</button>
          <button type="button" onClick={stopPlayback} disabled={!playing} style={buttonStyle}>Stop</button>
          <button type="button" onClick={saveProject} disabled={!arrangement.length} style={buttonStyle}>Save</button>
          <button type="button" onClick={() => midiBlob && downloadBlob(midiBlob, 'robloxify.mid')} disabled={!midiBlob} style={buttonStyle}>Export MIDI</button>
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
                    const trackNotes = arrangement.filter(note => note.role === role.id);
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
                            const duration = Math.max(playbackDuration, arrangement.reduce(
                              (max, item) => Math.max(max, item.startTimeSeconds + item.durationSeconds), 0
                            ), 1);
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
          bottom: 10,
          transform: 'translateX(-50%)',
          width: 'min(360px, 45%)',
          height: 15,
          background: '#b51e1e',
          border: '2px solid #555',
          boxSizing: 'border-box',
        }}>
          <div
            style={{
              width: playbackDuration ? Math.min(100, playbackTime / playbackDuration * 100) + '%' : '0%',
              height: '100%',
              background: '#28c52f',
            }}
          />
        </div>

        <div style={{
          position: 'absolute',
          right: 10,
          bottom: 8,
          display: 'flex',
          gap: 3,
          alignItems: 'center',
        }}>
          <span>VOL</span>
          <button type="button" style={buttonStyle} onClick={() => setVolume(Math.min(1, volume + .1))}>+</button>
          <button type="button" style={buttonStyle} onClick={() => setVolume(Math.max(0, volume - .1))}>−</button>
          <button type="button" style={buttonStyle} onClick={() => setShowProjects(value => !value)}>Projects</button>
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
