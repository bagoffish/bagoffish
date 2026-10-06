import React, { useEffect, useRef, useState } from 'react';
import { AudioToMidiConverter, audioToMidiDefaults } from '@musicbento/audio-to-midi';
import { createSF2Player } from '@gwegash/sf2-player';

const ROBLOX_SF2_URL =
  '/soundfonts/Instruments/WorkingR-Blox/Roblox%20Soundfont-1.sf2';

const buttonStyle = {
  background: 'linear-gradient(#4f4f4f, #171717)',
  border: '1px solid #8b8b8b',
  borderRightColor: '#111',
  borderBottomColor: '#111',
  color: '#ddd',
  fontFamily: 'Tahoma, Arial, sans-serif',
  fontSize: 11,
  padding: '4px 8px',
  cursor: 'pointer',
};

const roles = [
  { id: 'bass', label: 'BASS', keywords: ['bass', 'fretless', 'synth bass', 'contrabass'], fallback: 32 },
  { id: 'rhythm', label: 'RHYTHM', keywords: ['guitar', 'piano', 'organ', 'harpsichord', 'electric piano'], fallback: 0 },
  { id: 'lead', label: 'LEAD', keywords: ['lead', 'synth', 'violin', 'flute', 'clarinet', 'trumpet'], fallback: 80 },
  { id: 'texture', label: 'TEXTURE', keywords: ['strings', 'pad', 'choir', 'marimba', 'vibraphone'], fallback: 48 },
];

function readU32(data, offset) {
  return (
    data[offset] * 0x1000000 +
    data[offset + 1] * 0x10000 +
    data[offset + 2] * 0x100 +
    data[offset + 3]
  );
}

function readU16(data, offset) {
  return data[offset] * 256 + data[offset + 1];
}

function readVarLen(data, state) {
  let value = 0;
  let byte;
  do {
    byte = data[state.index++];
    value = (value << 7) | (byte & 0x7f);
  } while (byte & 0x80);
  return value;
}

function parseMidi(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (data.length < 14 || String.fromCharCode(...data.slice(0, 4)) !== 'MThd') {
    throw new Error('The converter returned an invalid MIDI file.');
  }

  const tracks = readU16(data, 10);
  const division = readU16(data, 12);
  if (division & 0x8000) {
    throw new Error('SMPTE MIDI timing is not supported.');
  }

  let offset = 14;
  const events = [];
  const tempos = [{ tick: 0, usPerQuarter: 500000 }];

  for (let trackIndex = 0; trackIndex < tracks; trackIndex += 1) {
    if (offset + 8 > data.length || String.fromCharCode(...data.slice(offset, offset + 4)) !== 'MTrk') {
      throw new Error('A MIDI track is missing.');
    }

    const trackLength = readU32(data, offset + 4);
    const end = offset + 8 + trackLength;
    offset += 8;

    let tick = 0;
    let runningStatus = 0;
    const state = { index: offset };
    const active = new Map();

    while (state.index < end) {
      tick += readVarLen(data, state);
      let status = data[state.index++];

      if (status < 0x80) {
        if (!runningStatus) throw new Error('Invalid MIDI running status.');
        state.index -= 1;
        status = runningStatus;
      } else if (status < 0xf0) {
        runningStatus = status;
      }

      if (status === 0xff) {
        const metaType = data[state.index++];
        const length = readVarLen(data, state);
        if (metaType === 0x51 && length === 3) {
          tempos.push({
            tick,
            usPerQuarter:
              (data[state.index] << 16) |
              (data[state.index + 1] << 8) |
              data[state.index + 2],
          });
        }
        state.index += length;
        continue;
      }

      if (status === 0xf0 || status === 0xf7) {
        state.index += readVarLen(data, state);
        continue;
      }

      const command = status & 0xf0;
      const channel = status & 0x0f;
      const first = data[state.index++];
      const second = command === 0xc0 || command === 0xd0 ? 0 : data[state.index++];

      if (command === 0x90 && second > 0) {
        const key = channel + ':' + first;
        const list = active.get(key) || [];
        list.push({ tick, channel, pitch: first, velocity: second });
        active.set(key, list);
      } else if (command === 0x80 || (command === 0x90 && second === 0)) {
        const key = channel + ':' + first;
        const list = active.get(key);
        if (list && list.length) {
          const start = list.shift();
          events.push({
            startTick: start.tick,
            endTick: Math.max(tick, start.tick + 1),
            pitch: start.pitch,
            velocity: start.velocity,
            channel: start.channel,
          });
        }
      }
    }

    offset = end;
  }

  tempos.sort((a, b) => a.tick - b.tick);
  const uniqueTempos = [];
  tempos.forEach(tempo => {
    const last = uniqueTempos[uniqueTempos.length - 1];
    if (last && last.tick === tempo.tick) uniqueTempos[uniqueTempos.length - 1] = tempo;
    else uniqueTempos.push(tempo);
  });

  function tickToSeconds(targetTick) {
    let seconds = 0;
    let lastTick = 0;
    let usPerQuarter = uniqueTempos[0].usPerQuarter;

    for (let i = 1; i < uniqueTempos.length; i += 1) {
      const tempo = uniqueTempos[i];
      if (tempo.tick > targetTick) break;
      seconds +=
        ((tempo.tick - lastTick) * usPerQuarter) /
        1000000 /
        division;
      lastTick = tempo.tick;
      usPerQuarter = tempo.usPerQuarter;
    }

    seconds +=
      ((targetTick - lastTick) * usPerQuarter) /
      1000000 /
      division;

    return seconds;
  }

  return events.map(event => ({
    start: tickToSeconds(event.startTick),
    end: Math.max(tickToSeconds(event.endTick), tickToSeconds(event.startTick) + 0.04),
    pitch: event.pitch,
    velocity: event.velocity,
    channel: event.channel,
  }));
}

function scoreRole(note, density) {
  const pitch = note.pitch;
  const duration = note.end - note.start;
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

function findProgram(programs, role) {
  const target = roles.find(item => item.id === role);
  if (!target || !programs.length) return 0;

  let best = programs[0];
  let bestScore = -Infinity;

  programs.forEach(program => {
    const name = String(program.name || '').toLowerCase();
    let score = 0;

    target.keywords.forEach(keyword => {
      if (name.includes(keyword)) score += 20;
    });

    const distance = Math.abs((program.program || 0) - target.fallback);
    score -= distance * 0.05;

    if (score > bestScore) {
      bestScore = score;
      best = program;
    }
  });

  return best.index;
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
  const converterRef = useRef(null);
  const contextRef = useRef(null);
  const playersRef = useRef([]);
  const [file, setFile] = useState(null);
  const [midiBlob, setMidiBlob] = useState(null);
  const [notes, setNotes] = useState([]);
  const [arrangement, setArrangement] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [status, setStatus] = useState('DROP AUDIO TO BEGIN');
  const [progress, setProgress] = useState(0);
  const [working, setWorking] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return () => {
      playersRef.current.forEach(player => {
        try { player.dispose(); } catch (error) { /* ignore cleanup errors */ }
      });
      playersRef.current = [];
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
    setStatus('LOADING BASIC PITCH AI...');

    try {
      if (!converterRef.current) {
        converterRef.current = new AudioToMidiConverter(audioToMidiDefaults);
      }

      const result = await converterRef.current.convert(inputFile, {
        onStatus: value => setStatus(String(value).replace(/-/g, ' ').toUpperCase()),
        onProgress: value => setProgress(Math.round(value * 100)),
      });

      const parsed = parseMidi(result.midiBytes);
      setMidiBlob(result.midiBlob);
      setNotes(parsed);

      setStatus('AI ARRANGING ' + parsed.length + ' NOTES...');
      const density = parsed.length / Math.max(1, parsed.length ? parsed[parsed.length - 1].end : 1);
      const arranged = parsed.map(note => ({
        ...note,
        role: scoreRole(note, density),
      }));
      setArrangement(arranged);

      setProgress(100);
      setStatus('DONE — MIDI + AI FIT READY');
    } catch (error) {
      console.error(error);
      setStatus('CONVERSION FAILED — ' + (error.message || 'UNKNOWN ERROR'));
    } finally {
      setWorking(false);
    }
  };

  const playArrangement = async () => {
    if (!arrangement.length) {
      setStatus('CONVERT AUDIO FIRST');
      return;
    }

    setWorking(true);
    setStatus('LOADING ROBLOX SOUNDFONT...');
    setPlaying(false);

    try {
      if (contextRef.current) {
        await contextRef.current.close();
      }

      playersRef.current.forEach(player => {
        try { player.dispose(); } catch (error) { /* ignore */ }
      });
      playersRef.current = [];

      const context = new AudioContext();
      contextRef.current = context;
      await context.resume();

      const players = [];
      const roleMap = {};

      for (let i = 0; i < roles.length; i += 1) {
        const role = roles[i];
        const player = await createSF2Player(context, ROBLOX_SF2_URL);
        player.output.connect(context.destination);
        const programIndex = findProgram(player.programs, role.id);
        player.selectProgram(programIndex);
        players.push(player);
        roleMap[role.id] = {
          player,
          program: player.programs[programIndex],
        };
      }

      playersRef.current = players;
      setPrograms(
        roles.map(role => ({
          role: role.label,
          program: roleMap[role.id].program
            ? roleMap[role.id].program.name
            : 'Default',
        }))
      );

      const startTime = context.currentTime + 0.12;
      arrangement.forEach(note => {
        const target = roleMap[note.role] || roleMap.rhythm;
        const velocity = Math.max(1, Math.min(127, Math.round(note.velocity || 90)));
        target.player.noteOn(note.pitch, velocity, startTime + note.start);
        target.player.noteOff(note.pitch, startTime + note.end);
      });

      const duration = arrangement.reduce((max, note) => Math.max(max, note.end), 0);
      setPlaying(true);
      setStatus('PLAYING WITH ROBLOX SOUNDFONT');

      window.setTimeout(() => {
        setPlaying(false);
        setStatus('PLAYBACK FINISHED');
      }, Math.ceil((duration + 0.5) * 1000));
    } catch (error) {
      console.error(error);
      setStatus('SOUNDFONT PLAYBACK FAILED — ' + (error.message || 'UNKNOWN ERROR'));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div style={{
      height: '100%',
      overflow: 'auto',
      background: '#101010',
      color: '#ddd',
      fontFamily: 'Tahoma, Arial, sans-serif',
      fontSize: 11,
      padding: 10,
      boxSizing: 'border-box',
    }}>
      <div style={{
        background: 'linear-gradient(#4b4b4b, #111)',
        border: '1px solid #777',
        color: '#fff',
        fontWeight: 'bold',
        letterSpacing: 1,
        padding: '5px 7px',
        marginBottom: 8,
      }}>
        ROBLOX MIDI AI // MUSIC LAB
      </div>

      <div
        onDragOver={event => event.preventDefault()}
        onDrop={event => {
          event.preventDefault();
          convert(event.dataTransfer.files && event.dataTransfer.files[0]);
        }}
        style={{
          border: '1px dashed #777',
          background: '#050505',
          padding: 14,
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        <div style={{ color: '#8bdcff', marginBottom: 6 }}>AUDIO → MIDI</div>
        <div style={{ marginBottom: 8 }}>
          MP3 / WAV / FLAC / OGG / M4A / AAC / WEBM
        </div>
        <label style={buttonStyle}>
          CHOOSE AUDIO
          <input
            type="file"
            accept="audio/*"
            onChange={event => convert(event.target.files && event.target.files[0])}
            style={{ display: 'none' }}
          />
        </label>
        {file && (
          <div style={{ marginTop: 7, color: '#aaa' }}>
            {file.name}
          </div>
        )}
      </div>

      <div style={{
        background: '#080808',
        border: '1px inset #555',
        padding: 7,
        color: '#9dff9d',
        marginBottom: 8,
      }}>
        {status}
      </div>

      {working && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ height: 7, background: '#000', border: '1px inset #555' }}>
            <div style={{
              width: progress + '%',
              height: '100%',
              background: '#5eff5e',
            }} />
          </div>
        </div>
      )}

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
          disabled={!midiBlob || working}
          onClick={() => downloadBlob(
            midiBlob,
            (file ? file.name.replace(/\.[^.]+$/, '') : 'converted') + '.mid'
          )}
        >
          SAVE MIDI
        </button>
      </div>

      {programs.length > 0 && (
        <div style={{
          borderTop: '1px solid #555',
          paddingTop: 7,
          marginTop: 8,
        }}>
          <div style={{ color: '#ffcf70', marginBottom: 5 }}>
            AI INSTRUMENT FIT
          </div>
          {programs.map(item => (
            <div key={item.role} style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderBottom: '1px dotted #333',
              padding: '3px 0',
            }}>
              <span>{item.role}</span>
              <span style={{ color: '#aaa' }}>{item.program}</span>
            </div>
          ))}
        </div>
      )}

      {notes.length > 0 && (
        <div style={{ marginTop: 8, color: '#888', lineHeight: '15px' }}>
          {notes.length} notes detected. Basic Pitch performs the AI transcription
          locally in your browser; the fit engine then scores each note by pitch,
          duration, density, and instrument suitability before rendering it with
          the Roblox SoundFont.
        </div>
      )}
    </div>
  );
}

export default MusicAI;
